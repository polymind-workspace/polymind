from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models import Market


def now_utc() -> datetime:
    return datetime.now(UTC)


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    market_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("markets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_address: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    side: Mapped[str] = mapped_column(String(16), nullable=False)
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    tx_signature: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    slot: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    block_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )

    market: Mapped["Market"] = relationship("Market")

    def __repr__(self) -> str:
        return f"<Trade id={self.id} side={self.side} amount={self.amount}>"
