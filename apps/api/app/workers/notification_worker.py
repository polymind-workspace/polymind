"""Notification worker.

Generates in-app notification rows from on-chain events.

Usage:
    cd apps/api
    uv run python -m app.workers.notification_worker
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.db.session import AsyncSessionLocal
from app.models.chain_event_log import ChainEventLog
from app.models.market import Market
from app.models.notification import Notification
from app.models.position import Position
from app.services.indexer_service import get_worker_cursor, set_worker_cursor

logger = logging.getLogger(__name__)

NOTIFICATION_CURSOR_ID = 3
DEFAULT_POLL_INTERVAL_SECONDS = 30

EVENT_TYPES = (
    "Bet",
    "OutcomeProposed",
    "Finalized",
    "BondDeposited",
    "CreatorSlashed",
    # Champion module events.
    "BetPlaced",
    "Paid",
    "CampaignFinalized",
    "CampaignCancelled",
)


async def _champion_campaign_creator(db: Any, campaign_id: str) -> str | None:
    """Find the creator address from a CampaignCreated event."""
    result = await db.execute(
        select(ChainEventLog.payload)
        .where(
            ChainEventLog.module == "champion",
            ChainEventLog.kind == "CampaignCreated",
            ChainEventLog.subject == campaign_id,
        )
        .order_by(ChainEventLog.id.asc())
        .limit(1)
    )
    payload = result.scalar_one_or_none()
    if isinstance(payload, dict):
        return payload.get("creator")
    return None


async def _champion_participants(db: Any, campaign_id: str) -> set[str]:
    """Return distinct actor addresses that placed bets on a campaign."""
    result = await db.execute(
        select(ChainEventLog.actor)
        .where(
            ChainEventLog.module == "champion",
            ChainEventLog.kind == "BetPlaced",
            ChainEventLog.subject == campaign_id,
        )
        .distinct()
    )
    return {row for row in result.scalars().all() if row}


async def _handle_champion_bet(event: ChainEventLog, db: Any) -> None:
    payload = event.payload or {}
    campaign_id = payload.get("campaign_id") or event.subject
    user = payload.get("user")
    amount = payload.get("amount", 0)
    if not campaign_id:
        return

    creator = await _champion_campaign_creator(db, campaign_id)
    if not creator:
        return

    await _notify_user(
        db,
        user_address=creator,
        type_="champion_bet",
        title="New campaign bet",
        body=f"{user[:8] if user else 'Someone'} bet {amount} on your campaign",
        market_id=None,
        action_url=f"/campaigns/{campaign_id}",
    )


async def _handle_champion_paid(event: ChainEventLog, db: Any) -> None:
    payload = event.payload or {}
    campaign_id = payload.get("campaign_id") or event.subject
    user = payload.get("user")
    amount = payload.get("amount", 0)
    if not campaign_id or not user:
        return

    await _notify_user(
        db,
        user_address=user,
        type_="champion_paid",
        title="Campaign reward paid",
        body=f"You received {amount} from campaign {campaign_id}",
        market_id=None,
        action_url=f"/campaigns/{campaign_id}",
    )


async def _handle_champion_finalized(event: ChainEventLog, db: Any) -> None:
    payload = event.payload or {}
    campaign_id = payload.get("campaign_id") or event.subject
    winning_option = payload.get("winning_option")
    if not campaign_id:
        return

    participants = await _champion_participants(db, campaign_id)
    for user_address in participants:
        await _notify_user(
            db,
            user_address=user_address,
            type_="champion_finalized",
            title="Campaign settled",
            body=f"Campaign {campaign_id} was settled (winning option {winning_option})",
            market_id=None,
            action_url=f"/campaigns/{campaign_id}",
        )


async def _handle_champion_cancelled(event: ChainEventLog, db: Any) -> None:
    payload = event.payload or {}
    campaign_id = payload.get("campaign_id") or event.subject
    reason = payload.get("reason", "")
    if not campaign_id:
        return

    participants = await _champion_participants(db, campaign_id)
    for user_address in participants:
        await _notify_user(
            db,
            user_address=user_address,
            type_="champion_cancelled",
            title="Campaign cancelled",
            body=f"Campaign {campaign_id} was cancelled. {reason}",
            market_id=None,
            action_url=f"/campaigns/{campaign_id}",
        )


async def _get_market_by_onchain_ids(
    db: Any,
    event_id: int,
    market_idx: int,
) -> Market | None:
    result = await db.execute(
        select(Market)
        .join(Market.event)
        .options(joinedload(Market.event))
        .where(
            Market.event.has(onchain_event_id=str(event_id)),
            Market.market_idx == market_idx,
        )
    )
    return result.unique().scalar_one_or_none()


async def _notify_user(
    db: Any,
    *,
    user_address: str,
    type_: str,
    title: str,
    body: str | None,
    market_id: int | None,
    action_url: str | None,
) -> None:
    notification = Notification(
        user_address=user_address,
        type=type_,
        title=title,
        body=body,
        market_id=market_id,
        action_url=action_url,
    )
    db.add(notification)


async def _participant_addresses(db: Any, market_id: int) -> set[str]:
    result = await db.execute(
        select(Position.user_address).where(Position.market_id == market_id)
    )
    return {row for row in result.scalars().all() if row}


async def _handle_bet(event: ChainEventLog, db: Any) -> None:
    payload = event.payload or {}
    event_id = payload.get("event_id")
    market_idx = payload.get("market_idx")
    user = payload.get("user")
    amount = payload.get("amount", 0)
    if event_id is None or market_idx is None:
        return

    market = await _get_market_by_onchain_ids(db, int(event_id), int(market_idx))
    if market is None:
        return

    await _notify_user(
        db,
        user_address=market.creator_address,
        type_="bet",
        title="New bet on your market",
        body=f"{user[:8] if user else 'Someone'} bet {amount} on {market.title}",
        market_id=market.id,
        action_url=f"/markets/{market.slug}",
    )


async def _handle_proposed(event: ChainEventLog, db: Any) -> None:
    payload = event.payload or {}
    event_id = payload.get("event_id")
    market_idx = payload.get("market_idx")
    outcome = payload.get("outcome")
    if event_id is None or market_idx is None or outcome is None:
        return

    market = await _get_market_by_onchain_ids(db, int(event_id), int(market_idx))
    if market is None:
        return

    outcome_str = {1: "Yes", 2: "No", 3: "Void"}.get(int(outcome), "Unknown")
    participants = await _participant_addresses(db, market.id)
    for user_address in participants:
        await _notify_user(
            db,
            user_address=user_address,
            type_="proposed",
            title="Outcome proposed",
            body=f"{outcome_str} was proposed for {market.title}",
            market_id=market.id,
            action_url=f"/markets/{market.slug}",
        )


async def _handle_finalized(event: ChainEventLog, db: Any) -> None:
    payload = event.payload or {}
    event_id = payload.get("event_id")
    market_idx = payload.get("market_idx")
    outcome = payload.get("outcome")
    if event_id is None or market_idx is None or outcome is None:
        return

    market = await _get_market_by_onchain_ids(db, int(event_id), int(market_idx))
    if market is None:
        return

    outcome_str = {1: "Yes", 2: "No", 3: "Void"}.get(int(outcome), "Unknown")
    participants = await _participant_addresses(db, market.id)
    for user_address in participants:
        await _notify_user(
            db,
            user_address=user_address,
            type_="finalized",
            title="Market settled",
            body=f"{market.title} was settled with outcome {outcome_str}",
            market_id=market.id,
            action_url=f"/markets/{market.slug}",
        )


async def _handle_dispute_filed(event: ChainEventLog, db: Any) -> None:
    payload = event.payload or {}
    event_id = payload.get("event_id")
    market_idx = payload.get("market_idx")
    disputer = payload.get("disputer")
    if event_id is None or market_idx is None:
        return

    market = await _get_market_by_onchain_ids(db, int(event_id), int(market_idx))
    if market is None:
        return

    participants = await _participant_addresses(db, market.id)
    recipients = {market.creator_address} | participants
    recipients.discard(disputer)

    for user_address in recipients:
        await _notify_user(
            db,
            user_address=user_address,
            type_="dispute_filed",
            title="Dispute filed",
            body=f"A dispute was filed for {market.title}",
            market_id=market.id,
            action_url=f"/markets/{market.slug}",
        )


async def _handle_creator_slashed(event: ChainEventLog, db: Any) -> None:
    payload = event.payload or {}
    event_id = payload.get("event_id")
    market_idx = payload.get("market_idx")
    creator = payload.get("creator")
    if event_id is None or market_idx is None or not creator:
        return

    market = await _get_market_by_onchain_ids(db, int(event_id), int(market_idx))
    if market is None:
        return

    await _notify_user(
        db,
        user_address=creator,
        type_="creator_slashed",
        title="Creator stake slashed",
        body=f"Your stake on {market.title} was slashed for missing the propose deadline",
        market_id=market.id,
        action_url=f"/markets/{market.slug}",
    )


HANDLERS: dict[str, Any] = {
    "Bet": _handle_bet,
    "OutcomeProposed": _handle_proposed,
    "Finalized": _handle_finalized,
    "BondDeposited": _handle_dispute_filed,
    "CreatorSlashed": _handle_creator_slashed,
    "BetPlaced": _handle_champion_bet,
    "Paid": _handle_champion_paid,
    "CampaignFinalized": _handle_champion_finalized,
    "CampaignCancelled": _handle_champion_cancelled,
}


async def run_notification_worker() -> None:
    """Main worker loop."""
    logger.info("Starting notification worker")

    while True:
        try:
            async with AsyncSessionLocal() as db:
                cursor_str = await get_worker_cursor(db, NOTIFICATION_CURSOR_ID)
                last_id = int(cursor_str or "0")

                events_result = await db.execute(
                    select(ChainEventLog)
                    .where(ChainEventLog.kind.in_(EVENT_TYPES))
                    .where(ChainEventLog.id > last_id)
                    .order_by(ChainEventLog.id)
                    .limit(200)
                )
                events = events_result.scalars().all()

                if not events:
                    logger.debug("No new notification events; sleeping")
                    await asyncio.sleep(DEFAULT_POLL_INTERVAL_SECONDS)
                    continue

                new_last_id = last_id
                for event in events:
                    handler = HANDLERS.get(event.kind)
                    if handler is not None:
                        await handler(event, db)
                    new_last_id = max(new_last_id, event.id)

                await set_worker_cursor(
                    db,
                    NOTIFICATION_CURSOR_ID,
                    signature=str(new_last_id),
                )
                await db.commit()

                logger.info(
                    "Processed %d notification events up to id %s",
                    len(events),
                    new_last_id,
                )

        except Exception:
            logger.exception("Notification worker error; retrying after interval")
            await asyncio.sleep(DEFAULT_POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_notification_worker())
