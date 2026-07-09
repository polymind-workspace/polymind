"""Champion program event parsing utilities.

This module parses on-chain events from the PolyMind Champion program.
The concrete event layouts are placeholders until the Solana program is
finalized; the schemas mirror the OLD Move champion module events.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from app.clients.solana import SolanaClient


class ChampionEventType(StrEnum):
    """Known Champion program events.

    Mirrors the OLD Move champion module events.  The on-wire discriminators
    are placeholders until the Anchor IDL is finalized.
    """

    CAMPAIGN_CREATED = "CampaignCreated"
    CAMPAIGN_UPDATED = "CampaignUpdated"
    CAMPAIGN_FINALIZED = "CampaignFinalized"
    CAMPAIGN_CANCELLED = "CampaignCancelled"
    BET_PLACED = "BetPlaced"
    PAID = "Paid"


# Placeholder discriminators.  Replace with sha256("event:<EventName>")[:8]
# once the Anchor IDL is available.
CHAMPION_EVENT_DISCRIMINATORS: dict[ChampionEventType, bytes] = {
    ChampionEventType.CAMPAIGN_CREATED: b"\x00\x00\x00\x00\x00\x00\x00\x00",
    ChampionEventType.CAMPAIGN_UPDATED: b"\x00\x00\x00\x00\x00\x00\x00\x00",
    ChampionEventType.CAMPAIGN_FINALIZED: b"\x00\x00\x00\x00\x00\x00\x00\x00",
    ChampionEventType.CAMPAIGN_CANCELLED: b"\x00\x00\x00\x00\x00\x00\x00\x00",
    ChampionEventType.BET_PLACED: b"\x00\x00\x00\x00\x00\x00\x00\x00",
    ChampionEventType.PAID: b"\x00\x00\x00\x00\x00\x00\x00\x00",
}

DISCRIMINATOR_LENGTH = 8


# ---------------------------------------------------------------------------
# Event payload dataclasses (schema from OLD Move champion module)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class CampaignCreatedPayload:
    """Move event: champion::CampaignCreated"""

    campaign_id: str
    creator: str
    question: str
    option_count: int
    start_time: int
    end_time: int
    min_bet: int


@dataclass(frozen=True)
class CampaignUpdatedPayload:
    """Move event: champion::CampaignUpdated"""

    campaign_id: str
    question: str
    option_count: int
    start_time: int
    end_time: int
    min_bet: int


@dataclass(frozen=True)
class CampaignFinalizedPayload:
    """Move event: champion::CampaignFinalized"""

    campaign_id: str
    winning_option: int
    total_pool: int


@dataclass(frozen=True)
class CampaignCancelledPayload:
    """Move event: champion::CampaignCancelled"""

    campaign_id: str
    reason: str


@dataclass(frozen=True)
class ChampionBetPlacedPayload:
    """Move event: champion::BetPlaced"""

    campaign_id: str
    user: str
    name: str
    option_idx: int
    amount: int


@dataclass(frozen=True)
class PaidPayload:
    """Move event: champion::Paid"""

    campaign_id: str
    user: str
    option_idx: int
    amount: int


EVENT_PAYLOAD_TYPES: dict[ChampionEventType, type] = {
    ChampionEventType.CAMPAIGN_CREATED: CampaignCreatedPayload,
    ChampionEventType.CAMPAIGN_UPDATED: CampaignUpdatedPayload,
    ChampionEventType.CAMPAIGN_FINALIZED: CampaignFinalizedPayload,
    ChampionEventType.CAMPAIGN_CANCELLED: CampaignCancelledPayload,
    ChampionEventType.BET_PLACED: ChampionBetPlacedPayload,
    ChampionEventType.PAID: PaidPayload,
}


@dataclass(frozen=True)
class ChampionEvent:
    """A parsed Champion program event."""

    type: ChampionEventType
    event_index: int
    payload: Any


# ---------------------------------------------------------------------------
# Low-level helpers
# ---------------------------------------------------------------------------


def _match_champion_event(discriminator: bytes) -> ChampionEventType | None:
    for evt, disc in CHAMPION_EVENT_DISCRIMINATORS.items():
        if disc == discriminator:
            return evt
    return None


def _decode_champion_payload(event_type: ChampionEventType, raw_payload: bytes) -> Any:
    """Decode raw Borsh bytes into a typed payload dataclass.

    TODO: implement real Borsh decoding once the Anchor IDL is stable.
    Until then, return a dataclass with type-appropriate default values.
    """
    payload_cls = EVENT_PAYLOAD_TYPES.get(event_type)
    if payload_cls is None:
        return {"_raw": raw_payload.hex()}

    fields: dict[str, Any] = {}
    for name, f in payload_cls.__dataclass_fields__.items():
        ftype = f.type
        if ftype is int or ftype == "int":
            fields[name] = 0
        elif ftype is bool or ftype == "bool":
            fields[name] = False
        else:
            fields[name] = ""
    return payload_cls(**fields)  # type: ignore[call-arg]


def parse_champion_logs(logs: list[str] | None) -> list[ChampionEvent]:
    """Scan Solana program logs for Champion ``Program data:`` events."""
    import base64

    events: list[ChampionEvent] = []
    if not logs:
        return events

    prefix = "Program data: "
    event_index = 0
    for log in logs or []:
        if not log.startswith(prefix):
            continue
        encoded = log[len(prefix) :].strip()
        try:
            data = base64.b64decode(encoded)
        except Exception:
            continue
        if len(data) < DISCRIMINATOR_LENGTH:
            continue
        discriminator = data[:DISCRIMINATOR_LENGTH]
        raw_payload = data[DISCRIMINATOR_LENGTH:]
        event_type = _match_champion_event(discriminator)
        if event_type is None:
            continue
        payload = _decode_champion_payload(event_type, raw_payload)
        events.append(
            ChampionEvent(type=event_type, event_index=event_index, payload=payload)
        )
        event_index += 1
    return events


async def fetch_and_parse_champion_transaction(
    signature: str,
    client: SolanaClient | None = None,
) -> dict[str, Any]:
    """Fetch a transaction and parse Champion events from its logs.

    Returns a dict with keys: signature, slot, block_time, success, events.
    """
    own_client = client is None
    active_client = SolanaClient() if own_client else client
    try:
        tx_json = await active_client.get_transaction(signature)
    finally:
        if own_client:
            await active_client.close()

    if tx_json is None:
        raise ValueError(f"transaction not found: {signature}")

    meta = tx_json.get("meta", {})
    err = meta.get("err")
    if err is not None:
        raise ValueError(f"transaction failed: {err}")

    return {
        "signature": signature,
        "slot": tx_json.get("slot", 0),
        "block_time": tx_json.get("blockTime"),
        "success": True,
        "events": parse_champion_logs(meta.get("logMessages", [])),
    }
