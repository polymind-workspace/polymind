"""Dashboard statistics pre-aggregated table."""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import BigInteger, Date, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def now_utc() -> datetime:
    return datetime.now(UTC)


class DashboardStats(Base):
    __tablename__ = "dashboard_stats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    stat_date: Mapped[date] = mapped_column(Date, nullable=False, unique=True, index=True)
    total_users: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    new_users: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_markets: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    new_markets: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_bet_amount: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    total_claim_amount: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    total_disputes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pending_disputes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    def __repr__(self) -> str:
        return f"<DashboardStats date={self.stat_date}>"

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "stat_date": self.stat_date.isoformat() if self.stat_date else None,
            "total_users": self.total_users,
            "new_users": self.new_users,
            "total_markets": self.total_markets,
            "new_markets": self.new_markets,
            "total_bet_amount": self.total_bet_amount,
            "total_claim_amount": self.total_claim_amount,
            "total_disputes": self.total_disputes,
            "pending_disputes": self.pending_disputes,
        }
