from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Trade


class LeaderboardService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_leaderboard(
        self,
        type_: str,
        *,
        period: str = "week",
        limit: int = 10,
    ) -> list[dict]:
        start_time = self._period_start(period)

        if type_ == "invite":
            return await self._invite_leaderboard(start_time, limit)
        if type_ == "bet":
            return await self._bet_leaderboard(start_time, limit)
        if type_ == "topic":
            return await self._topic_leaderboard(start_time, limit)
        return []

    def _period_start(self, period: str) -> datetime:
        now = datetime.now(UTC)
        if period == "day":
            return now.replace(hour=0, minute=0, second=0, microsecond=0)
        if period == "week":
            days_since_monday = now.weekday()
            return (now - timedelta(days=days_since_monday)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
        if period == "month":
            return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return datetime(1970, 1, 1, tzinfo=UTC)

    async def _invite_leaderboard(self, start_time: datetime, limit: int) -> list[dict]:
        stmt = text("""
            SELECT inviter_address, COUNT(*) AS invitee_count
            FROM referrals
            WHERE registered_at >= :start_time
            GROUP BY inviter_address
            ORDER BY invitee_count DESC, inviter_address
            LIMIT :limit
        """)
        result = await self.session.execute(stmt, {"start_time": start_time, "limit": limit})
        rows = result.fetchall()
        return [
            {
                "rank": i + 1,
                "address": r.inviter_address,
                "nickname": None,
                "avatar": None,
                "score": r.invitee_count,
            }
            for i, r in enumerate(rows)
        ]

    async def _bet_leaderboard(self, start_time: datetime, limit: int) -> list[dict]:
        stmt = (
            select(
                Trade.user_address,
                func.count(Trade.id).label("bet_count"),
                func.sum(Trade.amount).label("total_wagered"),
            )
            .where(Trade.created_at >= start_time)
            .group_by(Trade.user_address)
            .order_by(func.sum(Trade.amount).desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        rows = result.fetchall()
        return [
            {
                "rank": i + 1,
                "address": r.user_address,
                "nickname": None,
                "avatar": None,
                "score": round((r.total_wagered or 0) / 1_000_000, 2),
            }
            for i, r in enumerate(rows)
        ]

    async def _topic_leaderboard(self, start_time: datetime, limit: int) -> list[dict]:
        stmt = text("""
            SELECT
                e.creator_address,
                e.id AS event_id,
                e.title AS event_title,
                COUNT(DISTINCT t.user_address) AS participant_count,
                COALESCE(SUM(t.amount), 0) AS total_wagered
            FROM events e
            LEFT JOIN markets m ON m.event_id = e.id
            LEFT JOIN trades t ON t.market_id = m.id
            WHERE e.created_at >= :start_time
            GROUP BY e.creator_address, e.id, e.title
            ORDER BY total_wagered DESC
            LIMIT :limit
        """)
        result = await self.session.execute(stmt, {"start_time": start_time, "limit": limit})
        rows = result.fetchall()
        return [
            {
                "rank": i + 1,
                "address": r.creator_address,
                "nickname": None,
                "avatar": None,
                "score": round(r.total_wagered / 1_000_000, 2),
            }
            for i, r in enumerate(rows)
        ]
