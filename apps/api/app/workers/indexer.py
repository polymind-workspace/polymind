"""Python indexer for the PolyMind parimutuel program.

Polls Solana RPC for transactions that touch the PolyMind program, parses
program logs/events, and writes the resulting state into PostgreSQL.

Usage:
    cd apps/api
    uv run python -m app.workers.indexer
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.clients.solana import SignatureNotFoundError, SolanaClient
from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.dispute import Dispute
from app.models.event import Event
from app.models.indexer_cursor import IndexerCursor as IndexerCursorModel
from app.models.market import Market
from app.models.position import Position
from app.models.trade import Trade
from app.services.chain_parser import (
    OUTCOME_NO,
    OUTCOME_VOID,
    OUTCOME_YES,
    SIDE_NO,
    SIDE_YES,
    BetPayload,
    BondDepositedPayload,
    BondRefundedPayload,
    BondSlashedPayload,
    ClaimedPayload,
    CreatorSlashedPayload,
    DisputeActiveSetPayload,
    DisputeResolvedPayload,
    EventCreatedPayload,
    FinalizedPayload,
    MarketCreatedPayload,
    OutcomeProposedPayload,
    PolyMindEvent,
    PolyMindEventType,
    fetch_and_parse_transaction,
)
from app.services.chain_parser import ChainParserError
from app.services.indexer_service import persist_chain_event
from app.utils.slugify import unique_event_slug, unique_market_slug

logger = logging.getLogger(__name__)

# How often we poll for new signatures when there is nothing to process.
DEFAULT_POLL_INTERVAL_SECONDS = 3


class IndexerCursor:
    """Tracks the last processed Solana slot/signature using the indexer_cursor table.

    NEW schema stores a single global cursor (slot + signature). For robustness
    we use the signature as the primary pagination key and the slot as metadata.
    """

    def __init__(self, signature: str | None = None, slot: int = 0) -> None:
        self.signature = signature
        self.slot = slot

    async def load(self, db: Any) -> None:
        """Load the latest cursor row from DB."""
        row = await db.get(IndexerCursorModel, 1)
        if row is not None:
            self.signature = row.signature
            self.slot = row.slot

    async def save(self, db: Any, signature: str | None, slot: int) -> None:
        """Persist cursor, overwriting the single global row."""
        self.signature = signature
        self.slot = slot

        row = await db.get(IndexerCursorModel, 1)
        if row is None:
            row = IndexerCursorModel(id=1, slot=slot, signature=signature)
            db.add(row)
        else:
            row.slot = slot
            row.signature = signature
        await db.flush()


async def handle_event(
    event: PolyMindEvent,
    signature: str,
    slot: int,
    block_time: int | None,
    db: Any,
    signer: str | None = None,
) -> None:
    """Dispatch a parsed event to the appropriate DB writer."""
    handler = EVENT_HANDLERS.get(event.type)
    if handler is None:
        logger.warning("No handler for event type %s", event.type)
        return
    await handler(event, signature, slot, block_time, db, signer)


async def _noop_handler(
    event: PolyMindEvent,
    signature: str,
    slot: int,
    block_time: int | None,
    _db: Any,
    _signer: str | None = None,
) -> None:
    """Placeholder handler that just logs the event."""
    logger.info(
        "%s: signature=%s slot=%s payload=%s",
        event.type.value,
        signature,
        slot,
        event.payload,
    )


def _extract_actor(event: PolyMindEvent) -> str | None:
    """Pull the human actor out of a parsed event payload."""
    payload = event.payload
    if isinstance(payload, EventCreatedPayload):
        return payload.creator
    if isinstance(payload, BetPayload):
        return payload.user
    if isinstance(payload, OutcomeProposedPayload):
        return payload.proposed_by
    if isinstance(payload, ClaimedPayload):
        return payload.user
    if isinstance(payload, CreatorSlashedPayload):
        return payload.creator
    if isinstance(payload, BondDepositedPayload):
        return payload.disputer
    if isinstance(payload, DisputeResolvedPayload):
        return payload.disputer
    return None


def _event_to_dict(payload: Any) -> dict[str, Any]:
    """Convert a frozen payload dataclass to a plain dict."""
    from dataclasses import asdict

    return asdict(payload)


def _outcome_to_str(outcome: int) -> str | None:
    """Map numeric outcome to stored string."""
    if outcome == OUTCOME_YES:
        return "yes"
    if outcome == OUTCOME_NO:
        return "no"
    if outcome == OUTCOME_VOID:
        return "void"
    return None


async def _get_market_by_onchain_ids(
    db: Any,
    event_id: int,
    market_idx: int,
) -> Market | None:
    """Load a Market together with its parent Event by on-chain ids."""
    result = await db.execute(
        select(Market)
        .join(Event)
        .options(joinedload(Market.event))
        .where(
            Event.onchain_event_id == str(event_id),
            Market.market_idx == market_idx,
        )
    )
    return result.unique().scalar_one_or_none()


async def _handle_bet(
    event: PolyMindEvent,
    signature: str,
    slot: int,
    block_time: int | None,
    db: Any,
    _signer: str | None = None,
) -> None:
    """Handle a Bet event: insert trade, update pool, position, and event aggregates."""
    payload = event.payload
    if not isinstance(payload, BetPayload):
        logger.warning("Bet handler received non-Bet payload: %s", type(payload))
        return

    # Locate the market by its on-chain event id + market index.
    market = await _get_market_by_onchain_ids(db, payload.event_id, payload.market_idx)
    if market is None:
        logger.warning(
            "Bet event for unknown market: event_id=%s market_idx=%s",
            payload.event_id,
            payload.market_idx,
        )
        return

    # Idempotency guard: a trade row already exists for this signature.
    existing = await db.execute(select(Trade.id).where(Trade.tx_signature == signature))
    if existing.scalar_one_or_none() is not None:
        logger.debug("Trade already exists for signature %s", signature)
        return

    if payload.side == SIDE_YES:
        side_str = "yes"
    elif payload.side == SIDE_NO:
        side_str = "no"
    else:
        logger.warning("Invalid bet side %s for signature %s", payload.side, signature)
        return

    # 1. Record the trade.
    db.add(
        Trade(
            market_id=market.id,
            user_address=payload.user,
            side=side_str,
            amount=payload.amount,
            tx_signature=signature,
            slot=slot,
            block_time=block_time,
        )
    )

    # 2. Update market pools using on-chain absolute values.
    market.yes_pool = payload.new_yes_pool
    market.no_pool = payload.new_no_pool
    market.volume += payload.amount

    # 3. Upsert the user's position for this market.
    position_result = await db.execute(
        select(Position).where(
            Position.market_id == market.id,
            Position.user_address == payload.user,
        )
    )
    position: Position | None = position_result.scalar_one_or_none()
    is_new_market_player = position is None
    if position is None:
        position = Position(market_id=market.id, user_address=payload.user)
        db.add(position)
        market.players_count += 1

    if payload.side == SIDE_YES:
        position.yes_amount += payload.amount
    else:
        position.no_amount += payload.amount

    # 4. Update event aggregates.
    event_obj = market.event
    event_markets_result = await db.execute(
        select(Market).where(Market.event_id == event_obj.id)
    )
    event_markets = event_markets_result.scalars().all()
    event_obj.total_yes_pool = sum(m.yes_pool for m in event_markets)
    event_obj.total_no_pool = sum(m.no_pool for m in event_markets)
    event_obj.volume += payload.amount

    # Event-level unique player count.
    if is_new_market_player:
        other_position = await db.execute(
            select(Position.id)
            .join(Market)
            .where(
                Market.event_id == event_obj.id,
                Market.id != market.id,
                Position.user_address == payload.user,
            )
        )
        if other_position.scalar_one_or_none() is None:
            event_obj.players_count += 1

    logger.info(
        "Bet handled: market_id=%s user=%s side=%s amount=%s",
        market.id,
        payload.user,
        side_str,
        payload.amount,
    )


async def _handle_event_created(
    event: PolyMindEvent,
    signature: str,
    slot: int,
    block_time: int | None,
    db: Any,
    _signer: str | None = None,
) -> None:
    """Handle an EventCreated event: create the Event row if it does not exist."""
    payload = event.payload
    if not isinstance(payload, EventCreatedPayload):
        logger.warning(
            "EventCreated handler received wrong payload: %s", type(payload)
        )
        return

    onchain_event_id = str(payload.event_id)
    existing = await db.execute(
        select(Event.id).where(Event.onchain_event_id == onchain_event_id)
    )
    if existing.scalar_one_or_none() is not None:
        logger.debug("Event %s already exists", onchain_event_id)
        return

    title = payload.question or f"Event {onchain_event_id}"
    slug = await unique_event_slug(db, title, onchain_event_id)

    event_obj = Event(
        onchain_event_id=onchain_event_id,
        slug=slug,
        creator_address=payload.creator,
        title=title,
        description=payload.question,
        source="user",
        status="open",
        can_bet=True,
        can_share=True,
    )
    db.add(event_obj)
    logger.info(
        "EventCreated handled: onchain_event_id=%s slug=%s", onchain_event_id, slug
    )


async def _handle_market_created(
    event: PolyMindEvent,
    signature: str,
    slot: int,
    block_time: int | None,
    db: Any,
    _signer: str | None = None,
) -> None:
    """Handle a MarketCreated event: create the Market row under its Event."""
    payload = event.payload
    if not isinstance(payload, MarketCreatedPayload):
        logger.warning(
            "MarketCreated handler received wrong payload: %s", type(payload)
        )
        return

    onchain_event_id = str(payload.event_id)
    event_result = await db.execute(
        select(Event).where(Event.onchain_event_id == onchain_event_id)
    )
    event_obj: Event | None = event_result.scalar_one_or_none()
    if event_obj is None:
        logger.warning(
            "MarketCreated event before EventCreated: event_id=%s market_idx=%s",
            payload.event_id,
            payload.market_idx,
        )
        return

    existing = await db.execute(
        select(Market.id).where(
            Market.event_id == event_obj.id,
            Market.market_idx == payload.market_idx,
        )
    )
    if existing.scalar_one_or_none() is not None:
        logger.debug(
            "Market event_id=%s idx=%s already exists", payload.event_id, payload.market_idx
        )
        return

    title = payload.title or f"Market {payload.market_idx}"
    slug = await unique_market_slug(db, title, event_obj.slug, payload.market_idx)

    deadline_dt: datetime | None = None
    if payload.deadline:
        deadline_dt = datetime.fromtimestamp(payload.deadline, UTC)

    seed_side_str: str | None = None
    if payload.seed_amount > 0:
        seed_side_str = "yes" if payload.seed_side == SIDE_YES else "no"

    yes_pool = payload.seed_amount if seed_side_str == "yes" else 0
    no_pool = payload.seed_amount if seed_side_str == "no" else 0

    market = Market(
        event_id=event_obj.id,
        creator_address=event_obj.creator_address,
        market_idx=payload.market_idx,
        slug=slug,
        title=title,
        deadline=deadline_dt,
        status="open",
        yes_pool=yes_pool,
        no_pool=no_pool,
        volume=payload.seed_amount,
        creator_seed_bet_amount=payload.seed_amount,
        creator_seed_bet_side=seed_side_str,
        creator_seed_bet_tx=signature,
    )
    db.add(market)

    # Seed bet creates a position for the creator if there is stake.
    if payload.seed_amount > 0 and seed_side_str is not None:
        position = Position(
            market_id=market.id,
            user_address=event_obj.creator_address,
            yes_amount=yes_pool,
            no_amount=no_pool,
        )
        db.add(position)
        market.players_count = 1
        event_obj.players_count = 1
        event_obj.total_yes_pool += yes_pool
        event_obj.total_no_pool += no_pool
        event_obj.volume += payload.seed_amount

    logger.info(
        "MarketCreated handled: event_id=%s market_idx=%s slug=%s",
        payload.event_id,
        payload.market_idx,
        slug,
    )


async def _handle_outcome_proposed(
    event: PolyMindEvent,
    signature: str,
    slot: int,
    block_time: int | None,
    db: Any,
    _signer: str | None = None,
) -> None:
    """Handle OutcomeProposed: move market to proposed state."""
    payload = event.payload
    if not isinstance(payload, OutcomeProposedPayload):
        logger.warning("OutcomeProposed handler wrong payload: %s", type(payload))
        return

    market = await _get_market_by_onchain_ids(db, payload.event_id, payload.market_idx)
    if market is None:
        logger.warning(
            "OutcomeProposed for unknown market: event_id=%s market_idx=%s",
            payload.event_id,
            payload.market_idx,
        )
        return

    outcome_str = _outcome_to_str(payload.outcome)
    if outcome_str is None:
        logger.warning("Invalid proposed outcome %s", payload.outcome)
        return

    market.proposed_outcome = outcome_str
    market.proposed_by = payload.proposed_by
    if payload.proposed_at:
        market.proposed_at = datetime.fromtimestamp(payload.proposed_at, UTC)
    market.status = "proposed"
    logger.info(
        "OutcomeProposed handled: market_id=%s outcome=%s by=%s",
        market.id,
        outcome_str,
        payload.proposed_by,
    )


async def _handle_finalized(
    event: PolyMindEvent,
    signature: str,
    slot: int,
    block_time: int | None,
    db: Any,
    signer: str | None = None,
) -> None:
    """Handle Finalized: close market, store fees and distributable pool."""
    payload = event.payload
    if not isinstance(payload, FinalizedPayload):
        logger.warning("Finalized handler wrong payload: %s", type(payload))
        return

    market = await _get_market_by_onchain_ids(db, payload.event_id, payload.market_idx)
    if market is None:
        logger.warning(
            "Finalized for unknown market: event_id=%s market_idx=%s",
            payload.event_id,
            payload.market_idx,
        )
        return

    outcome_str = _outcome_to_str(payload.outcome)
    if outcome_str is None:
        logger.warning("Invalid finalized outcome %s", payload.outcome)
        return

    market.finalized_outcome = outcome_str
    # The transaction signer is the account that finalized the market. For
    # admin_finalize (path 2) this records which admin performed the action.
    market.finalized_by = signer
    if payload.finalized_at:
        market.finalized_at = datetime.fromtimestamp(payload.finalized_at, UTC)
    market.finalization_path = payload.path
    market.admin_reason = payload.admin_reason or market.admin_reason
    market.creator_performed = payload.creator_performed
    market.platform_rake = payload.platform_rake
    market.creator_reward = payload.creator_reward
    market.distributable_pool = payload.distributable_pool
    market.dispute_active = False
    market.status = "void" if outcome_str == "void" else "finalized"
    logger.info(
        "Finalized handled: market_id=%s outcome=%s path=%s",
        market.id,
        outcome_str,
        payload.path,
    )


async def _handle_claimed(
    event: PolyMindEvent,
    signature: str,
    slot: int,
    block_time: int | None,
    db: Any,
    _signer: str | None = None,
) -> None:
    """Handle Claimed: update position payout/claimed amounts."""
    payload = event.payload
    if not isinstance(payload, ClaimedPayload):
        logger.warning("Claimed handler wrong payload: %s", type(payload))
        return

    market = await _get_market_by_onchain_ids(db, payload.event_id, payload.market_idx)
    if market is None:
        logger.warning(
            "Claimed for unknown market: event_id=%s market_idx=%s",
            payload.event_id,
            payload.market_idx,
        )
        return

    position_result = await db.execute(
        select(Position).where(
            Position.market_id == market.id,
            Position.user_address == payload.user,
        )
    )
    position: Position | None = position_result.scalar_one_or_none()
    if position is None:
        logger.warning(
            "Claimed for missing position: market_id=%s user=%s",
            market.id,
            payload.user,
        )
        return

    position.claimed_amount += payload.payout
    position.payout_amount = payload.payout
    logger.info(
        "Claimed handled: market_id=%s user=%s payout=%s",
        market.id,
        payload.user,
        payload.payout,
    )


async def _handle_creator_slashed(
    event: PolyMindEvent,
    signature: str,
    slot: int,
    block_time: int | None,
    db: Any,
    _signer: str | None = None,
) -> None:
    """Handle CreatorSlashed: move creator stake into bonus pool."""
    payload = event.payload
    if not isinstance(payload, CreatorSlashedPayload):
        logger.warning("CreatorSlashed handler wrong payload: %s", type(payload))
        return

    market = await _get_market_by_onchain_ids(db, payload.event_id, payload.market_idx)
    if market is None:
        logger.warning(
            "CreatorSlashed for unknown market: event_id=%s market_idx=%s",
            payload.event_id,
            payload.market_idx,
        )
        return

    position_result = await db.execute(
        select(Position).where(
            Position.market_id == market.id,
            Position.user_address == payload.creator,
        )
    )
    position: Position | None = position_result.scalar_one_or_none()
    if position is None:
        logger.warning(
            "CreatorSlashed for missing creator position: market_id=%s creator=%s",
            market.id,
            payload.creator,
        )
        return

    slash_yes = position.yes_amount
    slash_no = position.no_amount
    position.yes_amount = 0
    position.no_amount = 0
    position.claimed_amount = 0

    market.yes_pool -= slash_yes
    market.no_pool -= slash_no
    market.bonus_pool += payload.amount

    # Recompute event aggregates.
    event_obj = market.event
    event_markets_result = await db.execute(
        select(Market).where(Market.event_id == event_obj.id)
    )
    event_markets = event_markets_result.scalars().all()
    event_obj.total_yes_pool = sum(m.yes_pool for m in event_markets)
    event_obj.total_no_pool = sum(m.no_pool for m in event_markets)

    # Auto-void if one side is empty after slash.
    if market.yes_pool == 0 or market.no_pool == 0:
        market.status = "void"
        market.finalized_outcome = "void"
        market.finalized_at = datetime.now(UTC)
        market.finalization_path = 4  # slash automatic VOID

    logger.info(
        "CreatorSlashed handled: market_id=%s amount=%s",
        market.id,
        payload.amount,
    )


async def _handle_dispute_active_set(
    event: PolyMindEvent,
    signature: str,
    slot: int,
    block_time: int | None,
    db: Any,
    _signer: str | None = None,
) -> None:
    """Handle DisputeActiveSet: flip market dispute flag."""
    payload = event.payload
    if not isinstance(payload, DisputeActiveSetPayload):
        logger.warning("DisputeActiveSet handler wrong payload: %s", type(payload))
        return

    market = await _get_market_by_onchain_ids(db, payload.event_id, payload.market_idx)
    if market is None:
        logger.warning(
            "DisputeActiveSet for unknown market: event_id=%s market_idx=%s",
            payload.event_id,
            payload.market_idx,
        )
        return

    market.dispute_active = payload.active
    logger.info(
        "DisputeActiveSet handled: market_id=%s active=%s",
        market.id,
        payload.active,
    )


async def _handle_bond_deposited(
    event: PolyMindEvent,
    signature: str,
    slot: int,
    block_time: int | None,
    db: Any,
    _signer: str | None = None,
) -> None:
    """Handle BondDeposited: create a dispute record."""
    payload = event.payload
    if not isinstance(payload, BondDepositedPayload):
        logger.warning("BondDeposited handler wrong payload: %s", type(payload))
        return

    market = await _get_market_by_onchain_ids(db, payload.event_id, payload.market_idx)
    if market is None:
        logger.warning(
            "BondDeposited for unknown market: event_id=%s market_idx=%s",
            payload.event_id,
            payload.market_idx,
        )
        return

    # Idempotency guard.
    existing = await db.execute(
        select(Dispute.id).where(Dispute.bond_tx_signature == signature)
    )
    if existing.scalar_one_or_none() is not None:
        logger.debug("Dispute already exists for signature %s", signature)
        return

    outcome_str = _outcome_to_str(payload.claimed_outcome)
    dispute = Dispute(
        market_id=market.id,
        disputer_address=payload.disputer,
        claimed_outcome=outcome_str,
        bond_amount=payload.amount,
        bond_tx_signature=signature,
        reason=payload.reason,
        status="active",
    )
    db.add(dispute)
    market.dispute_active = True
    logger.info(
        "BondDeposited handled: market_id=%s disputer=%s outcome=%s",
        market.id,
        payload.disputer,
        outcome_str,
    )


async def _handle_dispute_resolved(
    event: PolyMindEvent,
    signature: str,
    slot: int,
    block_time: int | None,
    db: Any,
    _signer: str | None = None,
) -> None:
    """Handle DisputeResolved: close the active dispute record."""
    payload = event.payload
    if not isinstance(payload, DisputeResolvedPayload):
        logger.warning("DisputeResolved handler wrong payload: %s", type(payload))
        return

    market = await _get_market_by_onchain_ids(db, payload.event_id, payload.market_idx)
    if market is None:
        logger.warning(
            "DisputeResolved for unknown market: event_id=%s market_idx=%s",
            payload.event_id,
            payload.market_idx,
        )
        return

    result = await db.execute(
        select(Dispute)
        .where(
            Dispute.market_id == market.id,
            Dispute.disputer_address == payload.disputer,
        )
        .order_by(Dispute.created_at.desc())
        .limit(1)
    )
    dispute: Dispute | None = result.scalar_one_or_none()
    if dispute is None:
        logger.warning(
            "DisputeResolved for missing dispute: market_id=%s disputer=%s",
            market.id,
            payload.disputer,
        )
        return

    resolved_outcome_str = _outcome_to_str(payload.resolved_outcome)
    dispute.resolved_outcome = resolved_outcome_str
    dispute.resolved_reason = payload.admin_reason
    dispute.resolved_at = datetime.now(UTC)
    dispute.status = "refunded" if payload.refunded else "slashed"
    logger.info(
        "DisputeResolved handled: dispute_id=%s outcome=%s refunded=%s",
        dispute.id,
        resolved_outcome_str,
        payload.refunded,
    )


async def _handle_bond_refunded(
    event: PolyMindEvent,
    signature: str,
    slot: int,
    block_time: int | None,
    db: Any,
    _signer: str | None = None,
) -> None:
    """Handle BondRefunded: mark the latest matching dispute as refunded."""
    payload = event.payload
    if not isinstance(payload, BondRefundedPayload):
        logger.warning("BondRefunded handler wrong payload: %s", type(payload))
        return

    market = await _get_market_by_onchain_ids(db, payload.event_id, payload.market_idx)
    if market is None:
        logger.warning(
            "BondRefunded for unknown market: event_id=%s market_idx=%s",
            payload.event_id,
            payload.market_idx,
        )
        return

    result = await db.execute(
        select(Dispute)
        .where(
            Dispute.market_id == market.id,
            Dispute.disputer_address == payload.disputer,
        )
        .order_by(Dispute.created_at.desc())
        .limit(1)
    )
    dispute: Dispute | None = result.scalar_one_or_none()
    if dispute is None:
        logger.warning(
            "BondRefunded for missing dispute: market_id=%s disputer=%s",
            market.id,
            payload.disputer,
        )
        return

    dispute.status = "refunded"
    logger.info(
        "BondRefunded handled: dispute_id=%s amount=%s",
        dispute.id,
        payload.amount,
    )


async def _handle_bond_slashed(
    event: PolyMindEvent,
    signature: str,
    slot: int,
    block_time: int | None,
    db: Any,
    _signer: str | None = None,
) -> None:
    """Handle BondSlashed: mark the latest matching dispute as slashed."""
    payload = event.payload
    if not isinstance(payload, BondSlashedPayload):
        logger.warning("BondSlashed handler wrong payload: %s", type(payload))
        return

    market = await _get_market_by_onchain_ids(db, payload.event_id, payload.market_idx)
    if market is None:
        logger.warning(
            "BondSlashed for unknown market: event_id=%s market_idx=%s",
            payload.event_id,
            payload.market_idx,
        )
        return

    result = await db.execute(
        select(Dispute)
        .where(
            Dispute.market_id == market.id,
            Dispute.disputer_address == payload.disputer,
        )
        .order_by(Dispute.created_at.desc())
        .limit(1)
    )
    dispute: Dispute | None = result.scalar_one_or_none()
    if dispute is None:
        logger.warning(
            "BondSlashed for missing dispute: market_id=%s disputer=%s",
            market.id,
            payload.disputer,
        )
        return

    dispute.status = "slashed"
    logger.info(
        "BondSlashed handled: dispute_id=%s amount=%s",
        dispute.id,
        payload.amount,
    )


EVENT_HANDLERS: dict[PolyMindEventType, Any] = {
    PolyMindEventType.EVENT_CREATED: _handle_event_created,
    PolyMindEventType.MARKET_CREATED: _handle_market_created,
    PolyMindEventType.BET: _handle_bet,
    PolyMindEventType.OUTCOME_PROPOSED: _handle_outcome_proposed,
    PolyMindEventType.FINALIZED: _handle_finalized,
    PolyMindEventType.CLAIMED: _handle_claimed,
    PolyMindEventType.CREATOR_SLASHED: _handle_creator_slashed,
    PolyMindEventType.DISPUTE_ACTIVE_SET: _handle_dispute_active_set,
    PolyMindEventType.BOND_DEPOSITED: _handle_bond_deposited,
    PolyMindEventType.DISPUTE_RESOLVED: _handle_dispute_resolved,
    PolyMindEventType.BOND_REFUNDED: _handle_bond_refunded,
    PolyMindEventType.BOND_SLASHED: _handle_bond_slashed,
    # Config/admin events are read by the indexer but rarely need DB writes.
    PolyMindEventType.CONFIG_UPDATED: _noop_handler,
    PolyMindEventType.SPONSOR_FLAGS_UPDATED: _noop_handler,
    PolyMindEventType.MIN_BET_UPDATED: _noop_handler,
    PolyMindEventType.PLATFORM_RAKE_WITHDRAWN: _noop_handler,
    PolyMindEventType.CREATOR_REWARD_CLAIMED: _noop_handler,
    PolyMindEventType.BOND_AMOUNT_UPDATED: _noop_handler,
    PolyMindEventType.DISPUTE_SPONSOR_FLAGS_UPDATED: _noop_handler,
}


async def process_signature(client: SolanaClient, signature: str, _db: Any) -> int:
    """Fetch one transaction, persist every PolyMind event, then dispatch handlers."""
    parsed = await fetch_and_parse_transaction(signature, client=client)

    for event in parsed.polymind_events:
        # Step 1: idempotently persist raw event.
        inserted = await persist_chain_event(
            _db,
            program_id=settings.solana_program_id,
            signature=signature,
            slot=parsed.slot,
            block_time=parsed.block_time,
            event_index=event.event_index,
            kind=event.type.value,
            actor=_extract_actor(event),
            payload=_event_to_dict(event.payload),
        )

        # Step 2: only run business handler if this is a new event.
        if inserted:
            await handle_event(event, signature, parsed.slot, parsed.block_time, _db, parsed.signer)

    return parsed.slot


async def run_indexer() -> None:
    """Main indexer loop."""
    client = SolanaClient()
    cursor = IndexerCursor()

    logger.info(
        "Starting PolyMind Python indexer for program %s",
        settings.solana_program_id,
    )

    while True:
        try:
            async with AsyncSessionLocal() as db:
                await cursor.load(db)

                try:
                    signatures = await client.get_signatures_for_address(
                        account=settings.solana_program_id,
                        until=cursor.signature,
                        limit=1000,
                    )
                except SignatureNotFoundError as exc:
                    logger.warning("%s; resetting indexer cursor", exc)
                    cursor.signature = None
                    cursor.slot = 0
                    await cursor.save(db, signature=None, slot=0)
                    await db.commit()
                    continue

                if not signatures:
                    logger.debug(
                        "No new signatures until %s; sleeping %ss",
                        cursor.signature,
                        DEFAULT_POLL_INTERVAL_SECONDS,
                    )
                    await asyncio.sleep(DEFAULT_POLL_INTERVAL_SECONDS)
                    continue

                logger.info(
                    "Fetched %d new signatures (until=%s)",
                    len(signatures),
                    cursor.signature,
                )

                # get_signatures_for_address returns newest-first;
                # process oldest-first so cursor always moves forward monotonically.
                for signature in reversed(signatures):
                    try:
                        slot = await process_signature(client, signature, db)
                    except ChainParserError as exc:
                        logger.warning("Skipping signature %s: %s", signature, exc)
                        slot = cursor.slot
                    await cursor.save(db, signature=signature, slot=slot)

                await db.commit()

        except Exception:
            logger.exception("Indexer loop error; retrying after poll interval")
            await asyncio.sleep(DEFAULT_POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_indexer())
