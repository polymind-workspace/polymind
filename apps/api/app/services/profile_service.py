from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models import CreatorReward, Position, Trade, User
from app.utils.token import format_token_amount


class ProfileService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_profile(self, user_address: str) -> dict | None:
        stmt = select(User).where(User.address == user_address)
        result = await self.session.execute(stmt)
        user = result.scalar_one_or_none()
        if not user:
            return None

        bets = await self._count_bets(user_address)
        staked = await self._total_staked(user_address)
        markets = await self._markets_participated(user_address)
        winnings = await self._total_winnings(user_address)

        return {
            "address": user.address,
            "nickname": user.nickname,
            "avatar": user.avatar,
            "invite_code": user.invite_code,
            "stats": {
                "bets": bets,
                "staked": format_token_amount(staked),
                "markets": markets,
                "winnings": format_token_amount(winnings),
            },
        }

    async def get_creator_rewards(
        self,
        user_address: str,
        *,
        page: int = 1,
        limit: int = 24,
    ) -> dict:
        stmt = (
            select(CreatorReward)
            .options(joinedload(CreatorReward.market))
            .where(CreatorReward.creator_address == user_address)
            .order_by(CreatorReward.created_at.desc())
        )

        total_result = await self.session.execute(
            select(func.count()).select_from(stmt.subquery())
        )
        total = total_result.scalar() or 0

        stmt = stmt.offset((page - 1) * limit).limit(limit)
        result = await self.session.execute(stmt)
        items = [
            {
                "id": r.id,
                "market_id": r.market_id,
                "market_slug": r.market.slug if r.market else None,
                "market_title": r.market.title if r.market else None,
                "amount": format_token_amount(r.amount),
                "status": r.status,
                "claim_tx_signature": r.claim_tx_signature,
                "claimed_at": r.claimed_at.isoformat() if r.claimed_at else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in result.unique().scalars().all()
        ]

        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "hasMore": page * limit < total,
        }

    async def _count_bets(self, user_address: str) -> int:
        stmt = select(func.count(Trade.id)).where(Trade.user_address == user_address)
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def _total_staked(self, user_address: str) -> int:
        stmt = select(func.sum(Trade.amount)).where(Trade.user_address == user_address)
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def _markets_participated(self, user_address: str) -> int:
        stmt = select(func.count(func.distinct(Position.market_id))).where(
            Position.user_address == user_address
        )
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def _total_winnings(self, user_address: str) -> int:
        stmt = select(func.sum(Position.payout_amount)).where(Position.user_address == user_address)
        result = await self.session.execute(stmt)
        return result.scalar() or 0
