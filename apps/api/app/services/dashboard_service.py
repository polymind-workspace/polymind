"""Dashboard statistics service."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models import (
    DashboardStats,
    Dispute,
    Event,
    Market,
    Position,
    Referral,
    Trade,
    User,
)
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

    async def cards(self) -> list[dict]:
        """Return card-friendly metrics for the admin dashboard."""
        overview = await self.overview()
        active_markets = await self._count_active_markets()
        finalized_markets = await self._count_finalized_markets()

        return [
            {
                "key": "total_users",
                "label": "Total Users",
                "value": overview["total_users"],
                "format": "number",
            },
            {
                "key": "total_markets",
                "label": "Total Markets",
                "value": overview["total_markets"],
                "format": "number",
            },
            {
                "key": "active_markets",
                "label": "Active Markets",
                "value": active_markets,
                "format": "number",
            },
            {
                "key": "finalized_markets",
                "label": "Settled Markets",
                "value": finalized_markets,
                "format": "number",
            },
            {
                "key": "total_bet_amount",
                "label": "Total Bet Volume",
                "value": overview["total_bet_amount"],
                "format": "token",
            },
            {
                "key": "total_claim_amount",
                "label": "Total Claimed",
                "value": overview["total_claim_amount"],
                "format": "token",
            },
            {
                "key": "total_disputes",
                "label": "Total Disputes",
                "value": overview["total_disputes"],
                "format": "number",
            },
            {
                "key": "pending_disputes",
                "label": "Pending Disputes",
                "value": overview["pending_disputes"],
                "format": "number",
            },
        ]

    async def export_trend(
        self,
        *,
        days: int = 30,
        end_date: date | None = None,
    ) -> list[dict]:
        """Return trend data formatted for CSV export."""
        rows = await self.trend(days=days, end_date=end_date)
        return [
            {
                "date": row["date"],
                "new_users": row["new_users"],
                "new_markets": row["new_markets"],
                "bet_amount": row["bet_amount"],
                "claim_amount": row["claim_amount"],
            }
            for row in rows
        ]

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

    async def _count_active_markets(self) -> int:
        result = await self.session.execute(
            select(func.count(Market.id)).where(Market.status.not_in(("finalized", "void")))
        )
        return result.scalar() or 0

    async def _count_finalized_markets(self) -> int:
        result = await self.session.execute(
            select(func.count(Market.id)).where(Market.status.in_(("finalized", "void")))
        )
        return result.scalar() or 0

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

    # ── period helpers ──────────────────────────────────────────────────────────

    def _today_start(self) -> datetime:
        return datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)

    def _week_start(self) -> datetime:
        today = self._today_start()
        return today - timedelta(days=today.weekday())

    def _month_start(self) -> datetime:
        return self._today_start().replace(day=1)

    # ── admin dashboard sub-stats ───────────────────────────────────────────────

    async def user_stats(self) -> dict:
        """Return user growth and activity breakdown for the admin dashboard."""
        total_users = await self._count_total_users()

        pro_users_result = await self.session.execute(
            select(func.count(User.id)).where(User.is_pro.is_(True))
        )
        pro_users = pro_users_result.scalar() or 0
        free_users = total_users - pro_users
        pro_rate_pct = round((pro_users / total_users) * 100, 1) if total_users else 0.0

        today_start = self._today_start()
        week_start = self._week_start()
        month_start = self._month_start()
        prev_week_start = week_start - timedelta(days=7)

        new_today = await self._count_users_created_since(today_start)
        new_week = await self._count_users_created_since(week_start)
        new_month = await self._count_users_created_since(month_start)
        prev_week = await self._count_users_created_between(prev_week_start, week_start)
        new_week_change_pct = (
            round(((new_week - prev_week) / prev_week) * 100, 1) if prev_week else 0.0
        )

        active_today = await self._count_active_traders_since(today_start)
        active_week = await self._count_active_traders_since(week_start)

        return {
            "total_users": total_users,
            "pro_users": pro_users,
            "free_users": free_users,
            "pro_rate_pct": pro_rate_pct,
            "new_today": new_today,
            "new_week": new_week,
            "new_month": new_month,
            "new_week_change_pct": new_week_change_pct,
            "active_today": active_today,
            "active_today_polymind": 0,
            "active_today_contract": 0,
            "active_week": active_week,
            "active_week_polymind": 0,
            "active_week_contract": 0,
        }

    async def bet_stats(self) -> dict:
        """Return market/bet aggregate statistics for the admin dashboard."""
        total_bets_result = await self.session.execute(select(func.count(Trade.id)))
        total_bets = total_bets_result.scalar() or 0

        total_markets = await self._count_total_markets()
        resolved_markets = await self._count_finalized_markets()

        active_bets_result = await self.session.execute(
            select(func.count(Market.id)).where(Market.status == "open")
        )
        active_bets = active_bets_result.scalar() or 0

        ended_bets_result = await self.session.execute(
            select(func.count(Market.id)).where(Market.status.in_(("finalized", "void")))
        )
        ended_bets = ended_bets_result.scalar() or 0

        draft_bets_result = await self.session.execute(
            select(func.count(Event.id)).where(Event.status == "draft")
        )
        draft_bets = draft_bets_result.scalar() or 0

        volume_result = await self.session.execute(select(func.sum(Event.volume)))
        total_volume = volume_result.scalar() or 0

        unique_players_result = await self.session.execute(
            select(func.count(func.distinct(Trade.user_address)))
        )
        unique_players = unique_players_result.scalar() or 0

        week_start = self._week_start()
        prev_week_start = week_start - timedelta(days=7)
        new_this_week = await self._count_trades_since(week_start)
        prev_week_trades = await self._count_trades_between(prev_week_start, week_start)
        new_week_change_pct = (
            round(((new_this_week - prev_week_trades) / prev_week_trades) * 100, 1)
            if prev_week_trades
            else 0.0
        )

        status_distribution = await self._event_status_distribution()
        outcome_distribution = await self._market_outcome_distribution()

        return {
            "total_bets": total_bets,
            "active_bets": active_bets,
            "ended_bets": ended_bets,
            "resolved_bets": resolved_markets,
            "draft_bets": draft_bets,
            "total_markets": total_markets,
            "resolved_markets": resolved_markets,
            "total_volume_eds": format_token_amount(total_volume),
            "total_entries": total_bets,
            "unique_players": unique_players,
            "unique_players_polymind": 0,
            "unique_players_contract": 0,
            "new_this_week": new_this_week,
            "new_week_change_pct": new_week_change_pct,
            "status_distribution": status_distribution,
            "outcome_distribution": outcome_distribution,
        }

    async def invite_stats(self) -> dict:
        """Return invitation overview for the admin dashboard."""
        inviters_result = await self.session.execute(
            select(func.count(func.distinct(Referral.inviter_address)))
        )
        total_inviters = inviters_result.scalar() or 0

        invitees_result = await self.session.execute(select(func.count(Referral.id)))
        total_invitees = invitees_result.scalar() or 0

        return {
            "total_inviters": total_inviters,
            "total_invitees": total_invitees,
        }

    async def top_bets(self, limit: int = 10) -> list[dict]:
        """Return the highest-volume events for the admin dashboard."""
        result = await self.session.execute(
            select(Event)
            .order_by(Event.volume.desc())
            .limit(limit)
        )
        events = result.scalars().all()

        rows = []
        for event in events:
            market_count_result = await self.session.execute(
                select(func.count(Market.id)).where(Market.event_id == event.id)
            )
            market_count = market_count_result.scalar() or 0
            rows.append(
                {
                    "id": event.slug,
                    "question": event.title,
                    "resolved": event.status == "resolved",
                    "status": event.status,
                    "market_count": market_count,
                    "total_pool_eds": format_token_amount(event.volume),
                }
            )
        return rows

    async def top_users(self, limit: int = 10) -> list[dict]:
        """Return the most active traders for the admin dashboard."""
        stmt = (
            select(
                Trade.user_address,
                func.count(Trade.id).label("bet_count"),
                func.sum(Trade.amount).label("total_wagered"),
            )
            .group_by(Trade.user_address)
            .order_by(func.sum(Trade.amount).desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        rows = []
        for row in result.mappings().all():
            address = row.user_address
            nickname = None
            user_result = await self.session.execute(
                select(User.nickname).where(User.address == address)
            )
            nickname = user_result.scalar()
            rows.append(
                {
                    "luffa_id": address,
                    "identity": address,
                    "nickname": nickname or "",
                    "bet_count": row.bet_count,
                    "entry_count": row.bet_count,
                    "total_wagered_eds": format_token_amount(row.total_wagered or 0),
                }
            )
        return rows

    # ── small helpers ───────────────────────────────────────────────────────────

    async def _count_users_created_since(self, since: datetime) -> int:
        result = await self.session.execute(
            select(func.count(User.id)).where(User.created_at >= since)
        )
        return result.scalar() or 0

    async def _count_users_created_between(
        self, start: datetime, end: datetime
    ) -> int:
        result = await self.session.execute(
            select(func.count(User.id))
            .where(User.created_at >= start)
            .where(User.created_at < end)
        )
        return result.scalar() or 0

    async def _count_active_traders_since(self, since: datetime) -> int:
        result = await self.session.execute(
            select(func.count(func.distinct(Trade.user_address)))
            .where(Trade.created_at >= since)
        )
        return result.scalar() or 0

    async def _count_trades_since(self, since: datetime) -> int:
        result = await self.session.execute(
            select(func.count(Trade.id)).where(Trade.created_at >= since)
        )
        return result.scalar() or 0

    async def _count_trades_between(self, start: datetime, end: datetime) -> int:
        result = await self.session.execute(
            select(func.count(Trade.id))
            .where(Trade.created_at >= start)
            .where(Trade.created_at < end)
        )
        return result.scalar() or 0

    async def _event_status_distribution(self) -> list[dict]:
        result = await self.session.execute(
            select(Event.status, func.count(Event.id).label("cnt")).group_by(Event.status)
        )
        rows = result.mappings().all()
        total = sum(row.cnt for row in rows) or 1
        return [
            {
                "label": row.status,
                "value": row.cnt,
                "pct": round((row.cnt / total) * 100, 1),
            }
            for row in rows
        ]

    async def _market_outcome_distribution(self) -> list[dict]:
        result = await self.session.execute(
            select(
                Market.finalized_outcome,
                func.count(Market.id).label("cnt"),
            )
            .where(Market.finalized_outcome.isnot(None))
            .group_by(Market.finalized_outcome)
        )
        rows = result.mappings().all()
        total = sum(row.cnt for row in rows) or 1
        return [
            {
                "label": row.finalized_outcome or "unknown",
                "value": row.cnt,
                "pct": round((row.cnt / total) * 100, 1),
            }
            for row in rows
        ]


def get_dashboard_service(session: AsyncSession = Depends(get_db)) -> DashboardService:
    return DashboardService(session)
