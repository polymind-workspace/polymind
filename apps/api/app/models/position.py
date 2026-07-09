from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models import Market


def now_utc() -> datetime:
    return datetime.now(UTC)


class Position(Base):
    __tablename__ = "positions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    market_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("markets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_address: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    yes_amount: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    no_amount: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    claimed_amount: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    payout_amount: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    __table_args__ = (
        UniqueConstraint("market_id", "user_address", name="uq_position_market_user"),
    )

    market: Mapped["Market"] = relationship("Market")

    def __repr__(self) -> str:
        return f"<Position market_id={self.market_id} user={self.user_address[:8]}>"
