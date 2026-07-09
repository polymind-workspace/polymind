"""Dashboard statistics service."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models import DashboardStats, Dispute, Market, Position, Trade, User
from app.utils.token import format_token_amount


class DashboardService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def overview(self) -> dict:
        # Prefer pre-aggregated row for today if available.
        today = date.today()
        result = await self.session.execute(
            select(DashboardStats).where(DashboardStats.stat_date == today)
        )
        stats = result.scalar_one_or_none()
        if stats:
            return {
                "total_users": stats.total_users,
                "total_markets": stats.total_markets,
                "total_bet_amount": format_token_amount(stats.total_bet_amount),
                "total_claim_amount": format_token_amount(stats.total_claim_amount),
                "total_disputes": stats.total_disputes,
                "pending_disputes": stats.pending_disputes,
                "as_of": stats.updated_at.isoformat() if stats.updated_at else None,
                "source": "pre_aggregated",
            }

        # Fallback to live queries for MVP before the indexer/cron is ready.
        total_users = await self._count_total_users()
        total_markets = await self._count_total_markets()
        total_bet_amount = await self._sum_total_bets()
        total_claim_amount = await self._sum_total_claims()
        total_disputes = await self._count_total_disputes()
        pending_disputes = await self._count_pending_disputes()

        return {
            "total_users": total_users,
            "total_markets": total_markets,
            "total_bet_amount": format_token_amount(total_bet_amount),
            "total_claim_amount": format_token_amount(total_claim_amount),
            "total_disputes": total_disputes,
            "pending_disputes": pending_disputes,
            "as_of": datetime.now(UTC).isoformat(),
            "source": "live_query",
        }

    async def trend(
        self,
        *,
        days: int = 30,
        end_date: date | None = None,
    ) -> list[dict]:
        end = end_date or date.today()
        start = end - timedelta(days=days - 1)

        # Try pre-aggregated table first.
        stmt = (
            select(DashboardStats)
            .where(DashboardStats.stat_date >= start)
            .where(DashboardStats.stat_date <= end)
            .order_by(DashboardStats.stat_date.asc())
        )
        result = await self.session.execute(stmt)
        rows = result.scalars().all()
        if rows:
            return [self._serialize_stats_row(r) for r in rows]

        # Fallback: build daily aggregates from live tables.
        return await self._trend_from_live(start, end)

    async def _trend_from_live(self, start: date, end: date) -> list[dict]:
        start_ts = int(datetime.combine(start, datetime.min.time(), tzinfo=UTC).timestamp())
        end_ts = int(datetime.combine(end, datetime.max.time(), tzinfo=UTC).timestamp())

        # New users per day.
        user_stmt = (
            select(
                func.date_trunc("day", User.created_at).label("day"),
                func.count(User.id).label("cnt"),
            )
            .where(User.created_at >= datetime.fromtimestamp(start_ts, tz=UTC))
            .where(User.created_at <= datetime.fromtimestamp(end_ts, tz=UTC))
            .group_by("day")
        )
        user_result = await self.session.execute(user_stmt)
        users_by_day = {row.day.date(): row.cnt for row in user_result.mappings().all()}

        # New markets per day.
        market_stmt = (
            select(
                func.date_trunc("day", Market.created_at).label("day"),
                func.count(Market.id).label("cnt"),
            )
            .where(Market.created_at >= datetime.fromtimestamp(start_ts, tz=UTC))
            .where(Market.created_at <= datetime.fromtimestamp(end_ts, tz=UTC))
            .group_by("day")
        )
        market_result = await self.session.execute(market_stmt)
        markets_by_day = {row.day.date(): row.cnt for row in market_result.mappings().all()}

        # Bet amount per day.
        bet_stmt = (
            select(
                func.date_trunc("day", Trade.created_at).label("day"),
                func.sum(Trade.amount).label("amount"),
            )
            .where(Trade.created_at >= datetime.fromtimestamp(start_ts, tz=UTC))
            .where(Trade.created_at <= datetime.fromtimestamp(end_ts, tz=UTC))
            .group_by("day")
        )
        bet_result = await self.session.execute(bet_stmt)
        bets_by_day = {
            row.day.date(): row.amount or 0 for row in bet_result.mappings().all()
        }

        items = []
        current = start
        while current <= end:
            items.append(
                {
                    "date": current.isoformat(),
                    "new_users": users_by_day.get(current, 0),
                    "new_markets": markets_by_day.get(current, 0),
                    "bet_amount": format_token_amount(bets_by_day.get(current, 0)),
                    "claim_amount": 0,  # claim 事件暂无独立表，后续由 indexer 填充
                }
            )
            current += timedelta(days=1)

        return items

    def _serialize_stats_row(self, stats: DashboardStats) -> dict:
        return {
            "date": stats.stat_date.isoformat() if stats.stat_date else None,
            "total_users": stats.total_users,
            "new_users": stats.new_users,
            "total_markets": stats.total_markets,
            "new_markets": stats.new_markets,
            "bet_amount": format_token_amount(stats.total_bet_amount),
            "claim_amount": format_token_amount(stats.total_claim_amount),
            "total_disputes": stats.total_disputes,
            "pending_disputes": stats.pending_disputes,
        }

    async def _count_total_users(self) -> int:
        result = await self.session.execute(select(func.count(User.id)))
        return result.scalar() or 0

    async def _count_total_markets(self) -> int:
        result = await self.session.execute(select(func.count(Market.id)))
        return result.scalar() or 0

    async def _sum_total_bets(self) -> int:
        result = await self.session.execute(select(func.sum(Trade.amount)))
        return result.scalar() or 0

    async def _sum_total_claims(self) -> int:
        result = await self.session.execute(select(func.sum(Position.payout_amount)))
        return result.scalar() or 0

    async def _count_total_disputes(self) -> int:
        result = await self.session.execute(select(func.count(Dispute.id)))
        return result.scalar() or 0

    async def _count_pending_disputes(self) -> int:
        result = await self.session.execute(
            select(func.count(Dispute.id)).where(Dispute.status == "active")
        )
        return result.scalar() or 0


def get_dashboard_service(session: AsyncSession = Depends(get_db)) -> DashboardService:
    return DashboardService(session)
