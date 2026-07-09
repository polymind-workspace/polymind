"""Referral reward worker.

Listens for MarketFinalized events and creates pending referral rewards for
bettors who were referred by another user.

Usage:
    cd apps/api
    uv run python -m app.workers.referral_reward_worker
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.chain_event_log import ChainEventLog
from app.models.config import Config
from app.models.invite import InviteReward
from app.models.market import Market
from app.models.referral import Referral
from app.models.referral_reward import ReferralReward
from app.models.trade import Trade
from app.services.indexer_service import get_worker_cursor, set_worker_cursor

logger = logging.getLogger(__name__)

# Worker cursor id in indexer_cursor table.
REFERRAL_REWARD_CURSOR_ID = 2
DEFAULT_POLL_INTERVAL_SECONDS = 60


async def _get_config_int(db: Any, key: str, default: int = 0) -> int:
    result = await db.execute(select(Config.value).where(Config.key == key))
    value = result.scalar_one_or_none()
    if isinstance(value, dict):
        return int(value.get("value", default))
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        return int(value)
    return default


async def _get_market_by_onchain_ids(
    db: Any,
    event_id: int,
    market_idx: int,
) -> Market | None:
    from sqlalchemy.orm import joinedload

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


async def _upsert_legacy_invite_reward(
    db: Any,
    *,
    referral: Referral,
    market: Market,
    trade: Trade,
    reward: int,
    event_id: int,
    market_idx: int,
) -> bool:
    """Mirror a ReferralReward into the legacy invite_rewards / invite_balances tables.

    Keeps the admin invite UI working while the native ReferralReward model is
    the source of truth. Returns True when a new legacy row was inserted.
    """
    existing = await db.execute(
        select(InviteReward.id).where(
            InviteReward.onchain_event_id == event_id,
            InviteReward.market_idx == market_idx,
            InviteReward.bet_tx_version == trade.tx_signature,
            InviteReward.bet_tx_index == 0,
        )
    )
    if existing.scalar_one_or_none() is not None:
        return False

    db.add(
        InviteReward(
            inviter_luffa_id=referral.inviter_address,
            invitee_luffa_id=referral.invitee_address,
            invitee_address=trade.user_address,
            onchain_event_id=event_id,
            market_idx=market_idx,
            bet_tx_version=trade.tx_signature,
            bet_tx_index=0,
            bet_amount_base=str(trade.amount),
            reward_base=str(reward),
            status="pending",
        )
    )

    # Bump inviter pending balance (PostgreSQL upsert).
    from sqlalchemy import text

    await db.execute(
        text("""
            INSERT INTO invite_balances (inviter_luffa_id, pending_base, paid_base)
            VALUES (:uid, :delta, '0')
            ON CONFLICT (inviter_luffa_id) DO UPDATE
            SET pending_base = CAST(invite_balances.pending_base AS BIGINT) + :delta
        """),
        {"uid": referral.inviter_address, "delta": str(reward)},
    )
    return True


async def _process_finalized_event(event: ChainEventLog, db: Any) -> None:
    payload = event.payload or {}
    outcome = payload.get("outcome")
    if outcome == 3:  # VOID
        logger.debug("Skipping VOID finalized event %s", event.id)
        return

    event_id = payload.get("event_id")
    market_idx = payload.get("market_idx")
    if event_id is None or market_idx is None:
        logger.warning("Finalized event missing event_id/market_idx: %s", event.id)
        return

    market = await _get_market_by_onchain_ids(db, int(event_id), int(market_idx))
    if market is None:
        logger.warning("Market not found for finalized event %s", event.id)
        return

    # No platform rake means no referral reward pool.
    if market.platform_rake <= 0:
        logger.debug("Market %s has no platform rake; skipping rewards", market.id)
        return

    referral_bps = await _get_config_int(db, "referral_reward_bps", 0)
    referral_max = await _get_config_int(db, "referral_reward_max", 0)
    if referral_bps <= 0:
        logger.debug("Referral rewards disabled")
        return

    trades_result = await db.execute(
        select(Trade).where(Trade.market_id == market.id)
    )
    trades = trades_result.scalars().all()

    created = 0
    for trade in trades:
        if trade.block_time is None:
            continue

        referral_result = await db.execute(
            select(Referral).where(
                Referral.invitee_address == trade.user_address,
                Referral.registered_at
                < datetime.fromtimestamp(trade.block_time, UTC),
                Referral.status == "active",
            )
        )
        referral = referral_result.scalar_one_or_none()
        if referral is None:
            continue

        # Idempotency: one reward per (referral, market, trade).
        existing = await db.execute(
            select(ReferralReward.id).where(
                ReferralReward.referral_id == referral.id,
                ReferralReward.market_id == market.id,
                ReferralReward.tx_signature == trade.tx_signature,
            )
        )
        if existing.scalar_one_or_none() is not None:
            continue

        reward = trade.amount * referral_bps // 10_000
        reward = min(reward, referral_max)
        if reward <= 0:
            continue

        db.add(
            ReferralReward(
                referral_id=referral.id,
                market_id=market.id,
                amount=reward,
                status="pending",
                tx_signature=trade.tx_signature,
            )
        )
        await _upsert_legacy_invite_reward(
            db,
            referral=referral,
            market=market,
            trade=trade,
            reward=reward,
            event_id=int(event_id),
            market_idx=int(market_idx),
        )
        created += 1

    logger.info(
        "Referral rewards processed for market %s: %s created",
        market.id,
        created,
    )


async def run_referral_reward_worker() -> None:
    """Main worker loop."""
    logger.info("Starting referral reward worker")

    while True:
        try:
            async with AsyncSessionLocal() as db:
                cursor_str = await get_worker_cursor(db, REFERRAL_REWARD_CURSOR_ID)
                last_id = int(cursor_str or "0")

                events_result = await db.execute(
                    select(ChainEventLog)
                    .where(ChainEventLog.kind == "Finalized")
                    .where(ChainEventLog.id > last_id)
                    .order_by(ChainEventLog.id)
                    .limit(100)
                )
                events = events_result.scalars().all()

                if not events:
                    logger.debug("No new finalized events; sleeping")
                    await asyncio.sleep(DEFAULT_POLL_INTERVAL_SECONDS)
                    continue

                new_last_id = last_id
                for event in events:
                    await _process_finalized_event(event, db)
                    new_last_id = max(new_last_id, event.id)

                await set_worker_cursor(
                    db,
                    REFERRAL_REWARD_CURSOR_ID,
                    signature=str(new_last_id),
                )
                await db.commit()

                logger.info(
                    "Processed %d finalized events up to id %s",
                    len(events),
                    new_last_id,
                )

        except Exception:
            logger.exception("Referral reward worker error; retrying after interval")
            await asyncio.sleep(DEFAULT_POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_referral_reward_worker())
