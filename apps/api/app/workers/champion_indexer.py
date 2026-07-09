"""Champion program indexer.

Polls the Champion Solana program for transactions and persists raw events to
``chain_event_log`` with ``module='champion'``.  The campaigns router and web
notification worker consume these rows.

Usage:
    cd apps/api
    uv run python -m app.workers.champion_indexer
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import asdict
from typing import Any

from app.clients.solana import SolanaClient
from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.indexer_cursor import IndexerCursor as IndexerCursorModel
from app.services.champion_parser import (
    ChampionEvent,
    fetch_and_parse_champion_transaction,
)
from app.services.indexer_service import persist_chain_event

logger = logging.getLogger(__name__)

DEFAULT_POLL_INTERVAL_SECONDS = 3
CHAMPION_CURSOR_ID = 4


def _extract_subject(event: ChampionEvent) -> str | None:
    """Pull the campaign id out of a champion event payload."""
    payload = event.payload
    if hasattr(payload, "campaign_id"):
        return str(payload.campaign_id)
    return None


def _extract_actor(event: ChampionEvent) -> str | None:
    """Pull the human actor out of a champion event payload."""
    payload = event.payload
    if hasattr(payload, "user"):
        return str(payload.user)
    if hasattr(payload, "creator"):
        return str(payload.creator)
    return None


async def process_signature(client: SolanaClient, signature: str, db: Any) -> int:
    """Fetch one transaction and persist every Champion event."""
    parsed = await fetch_and_parse_champion_transaction(signature, client=client)

    for event in parsed["events"]:
        await persist_chain_event(
            db,
            program_id=settings.solana_champion_program_id or settings.solana_program_id,
            signature=signature,
            slot=parsed["slot"],
            block_time=parsed["block_time"],
            event_index=event.event_index,
            kind=event.type.value,
            actor=_extract_actor(event),
            payload=asdict(event.payload),
            module="champion",
            subject=_extract_subject(event),
        )

    return parsed["slot"]


async def run_champion_indexer() -> None:
    """Main indexer loop for the Champion program."""
    program_id = settings.solana_champion_program_id
    if not program_id:
        logger.warning(
            "SOLANA_CHAMPION_PROGRAM_ID is not set; champion indexer will idle"
        )
        while True:
            await asyncio.sleep(60)

    client = SolanaClient()

    while True:
        try:
            async with AsyncSessionLocal() as db:
                cursor_row = await db.get(IndexerCursorModel, CHAMPION_CURSOR_ID)
                until_signature = cursor_row.signature if cursor_row else None

                signatures = await client.get_signatures_for_address(
                    account=program_id,
                    until=until_signature,
                    limit=1000,
                )

                if not signatures:
                    logger.debug(
                        "No new champion signatures until %s; sleeping %ss",
                        until_signature,
                        DEFAULT_POLL_INTERVAL_SECONDS,
                    )
                    await asyncio.sleep(DEFAULT_POLL_INTERVAL_SECONDS)
                    continue

                logger.info(
                    "Fetched %d new champion signatures (until=%s)",
                    len(signatures),
                    until_signature,
                )

                new_signature = until_signature
                new_slot = cursor_row.slot if cursor_row else 0
                for signature in reversed(signatures):
                    slot = await process_signature(client, signature, db)
                    new_signature = signature
                    new_slot = slot

                if new_signature != until_signature:
                    if cursor_row is None:
                        cursor_row = IndexerCursorModel(
                            id=CHAMPION_CURSOR_ID,
                            slot=new_slot,
                            signature=new_signature,
                        )
                        db.add(cursor_row)
                    else:
                        cursor_row.signature = new_signature
                        cursor_row.slot = new_slot

                await db.commit()

        except Exception:
            logger.exception("Champion indexer loop error; retrying after poll interval")
            await asyncio.sleep(DEFAULT_POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_champion_indexer())
