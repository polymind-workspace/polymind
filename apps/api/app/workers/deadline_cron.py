"""Deadline reminder cron.

Time-based reminders for market deadlines and creator propose windows.
Unlike the OLD notify_cron.py, this does not send Luffa/SA push messages;
it only writes Notification rows for the web app to display.

Usage:
    cd apps/api
    uv run python -m app.workers.deadline_cron
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.market import Market
from app.models.notification import Notification

logger = logging.getLogger(__name__)

DEFAULT_INTERVAL_SECONDS = 60

# Time windows used to avoid duplicate notifications.
NOTIFICATION_WINDOW_SECONDS = 90


async def _notify_if_missing(
    db: Any,
    *,
    user_address: str,
    type_: str,
    title: str,
    body: str,
    market_id: int,
    action_url: str,
) -> None:
    """Create a notification only if one of the same type/market does not exist."""
    existing = await db.execute(
        select(Notification.id).where(
            Notification.user_address == user_address,
            Notification.type == type_,
            Notification.market_id == market_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        return

    db.add(
        Notification(
            user_address=user_address,
            type=type_,
            title=title,
            body=body,
            market_id=market_id,
            action_url=action_url,
        )
    )


async def _scan_markets(db: Any) -> None:
    now = datetime.now(UTC)
    window_start = now - timedelta(seconds=NOTIFICATION_WINDOW_SECONDS)

    stmt = select(Market).where(Market.status.not_in(("finalized", "void")))
    result = await db.execute(stmt)
    markets = result.scalars().all()

    for market in markets:
        if market.deadline is None:
            continue

        action_url = f"/markets/{market.slug}"

        # Deadline just passed -> creator can now propose.
        if window_start <= market.deadline <= now:
            await _notify_if_missing(
                db,
                user_address=market.creator_address,
                type_="deadline_passed",
                title="Market deadline passed",
                body=f"{market.title} has ended. Please propose an outcome.",
                market_id=market.id,
                action_url=action_url,
            )
            continue

        # Creator propose window expired -> participants can takeover/void.
        propose_deadline = market.deadline + timedelta(
            seconds=market.creator_propose_timeout
        )
        if window_start <= propose_deadline <= now:
            if market.proposed_outcome is None:
                await _notify_if_missing(
                    db,
                    user_address=market.creator_address,
                    type_="propose_window_expired",
                    title="Propose window expired",
                    body=(
                        f"You missed the propose window for {market.title}. "
                        f"Participants can now takeover or void the market."
                    ),
                    market_id=market.id,
                    action_url=action_url,
                )
            continue

        # In review window expired -> anyone can finalize.
        if market.proposed_at is not None and market.proposed_outcome is not None:
            review_deadline = market.proposed_at + timedelta(
                seconds=market.dispute_window_secs
            )
            if window_start <= review_deadline <= now:
                await _notify_if_missing(
                    db,
                    user_address=market.creator_address,
                    type_="review_window_expired",
                    title="Review window expired",
                    body=f"{market.title} can now be finalized.",
                    market_id=market.id,
                    action_url=action_url,
                )

            admin_deadline = market.proposed_at + timedelta(
                seconds=market.admin_timeout_secs
            )
            if window_start <= admin_deadline <= now:
                await _notify_if_missing(
                    db,
                    user_address=market.creator_address,
                    type_="emergency_void_available",
                    title="Emergency void available",
                    body=(
                        f"No admin action was taken on {market.title}. "
                        f"Anyone can now trigger an emergency void."
                    ),
                    market_id=market.id,
                    action_url=action_url,
                )


async def run_deadline_cron() -> None:
    """Main cron loop."""
    logger.info("Starting deadline reminder cron")

    while True:
        try:
            async with AsyncSessionLocal() as db:
                await _scan_markets(db)
                await db.commit()
        except Exception:
            logger.exception("Deadline cron error; retrying after interval")

        await asyncio.sleep(DEFAULT_INTERVAL_SECONDS)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_deadline_cron())
