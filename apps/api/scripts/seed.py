"""Seed script for Phase 2 MVP development data.

Usage:
    cd apps/api
    uv run python scripts/seed.py
"""

import asyncio
import os
import sys

# Make `app` importable when running this script directly.
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models import (  # noqa: E402
    AdminAccount,
    Config,
    EventCategory,
    User,
)

DEFAULT_CATEGORIES = [
    {"slug": "all", "name": "All", "display_order": 0, "icon": "LayoutGrid"},
    {"slug": "politics", "name": "Politics", "display_order": 1, "icon": "Landmark"},
    {"slug": "crypto", "name": "Crypto", "display_order": 2, "icon": "Bitcoin"},
    {"slug": "sports", "name": "Sports", "display_order": 3, "icon": "Trophy"},
    {"slug": "trending", "name": "Trending", "display_order": 4, "icon": "TrendingUp"},
]

DEFAULT_CONFIGS = {
    "platform_fee_bps": {
        "value": 300,
        "memo": "Platform fee in basis points (3%)",
        "is_public": True,
    },
    "platform_fee_max": {
        "value": 10_000_000,
        "memo": "Platform fee cap in micro-USDC (10 USDC)",
        "is_public": True,
    },
    "creator_reward_bps": {
        "value": 500,
        "memo": "Creator reward in basis points (5%)",
        "is_public": True,
    },
    "creator_reward_max": {
        "value": 5_000_000,
        "memo": "Creator reward cap in micro-USDC (5 USDC)",
        "is_public": True,
    },
    "creator_propose_timeout_seconds": {
        "value": 259_200,
        "memo": "3 days",
        "is_public": True,
    },
    "dispute_window_seconds": {
        "value": 86_400,
        "memo": "1 day",
        "is_public": True,
    },
    "admin_timeout_seconds": {
        "value": 604_800,
        "memo": "7 days",
        "is_public": True,
    },
    "min_bet_micro_usdc": {
        "value": 1_000_000,
        "memo": "Minimum bet in micro-USDC (1 USDC)",
        "is_public": True,
    },
    "dispute_bond_micro_usdc": {
        "value": 1_000_000,
        "memo": "Dispute bond in micro-USDC (1 USDC)",
        "is_public": True,
    },
    "referral_reward_bps": {
        "value": 100,
        "memo": "Referral reward in basis points (1%)",
        "is_public": True,
    },
    "referral_reward_max": {
        "value": 1_000_000,
        "memo": "Referral reward cap in micro-USDC (1 USDC)",
        "is_public": True,
    },
    "expired_propose_mode": {
        "value": 0,
        "memo": "0 = participant takeover, 1 = slash",
        "is_public": True,
    },
    "single_side_only": {
        "value": False,
        "memo": "If true, only one side can be bet on",
        "is_public": True,
    },
}


async def seed_categories(session: AsyncSession) -> None:
    for cat in DEFAULT_CATEGORIES:
        existing = await session.execute(
            select(EventCategory).where(EventCategory.slug == cat["slug"])
        )
        if existing.scalar_one_or_none() is None:
            session.add(EventCategory(**cat))
    await session.commit()


async def seed_configs(session: AsyncSession) -> None:
    for key, cfg in DEFAULT_CONFIGS.items():
        existing = await session.execute(select(Config).where(Config.key == key))
        if existing.scalar_one_or_none() is None:
            session.add(
                Config(
                    key=key,
                    value=cfg["value"],
                    memo=cfg["memo"],
                    is_public=cfg.get("is_public", False),
                )
            )
    await session.commit()


async def seed_admin(session: AsyncSession) -> None:
    raw = os.getenv("BACKEND_ADMIN_BOOTSTRAP", "").strip()
    if not raw:
        print("BACKEND_ADMIN_BOOTSTRAP not set; skipping admin seed.")
        return

    addresses = [a.strip() for a in raw.split(",") if a.strip()]
    for address in addresses:
        existing = await session.execute(
            select(AdminAccount).where(AdminAccount.address == address)
        )
        if existing.scalar_one_or_none() is None:
            session.add(
                AdminAccount(
                    address=address,
                    nickname="bootstrap",
                    label="bootstrap",
                    added_by="env",
                    permissions=["*"],
                )
            )
    await session.commit()


async def seed_default_user(session: AsyncSession) -> None:
    address = "7c7Btev54kA36Nx5iq6LrzBhT9K4p6hKD1Tv4CjZ7qAv"  # placeholder dev user/admin address; replace with real keypair in production
    existing = await session.execute(select(User).where(User.address == address))
    if existing.scalar_one_or_none() is None:
        session.add(
            User(
                address=address,
                nickname="Default User",
                avatar="",
                is_admin=True,
                invite_code="DEFAULT",
            )
        )
        await session.commit()


async def main() -> None:
    async with AsyncSessionLocal() as session:
        await seed_categories(session)
        await seed_configs(session)
        await seed_admin(session)
        await seed_default_user(session)
    print("Seed completed.")


if __name__ == "__main__":
    asyncio.run(main())
