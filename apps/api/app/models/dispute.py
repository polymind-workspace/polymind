from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models import Market


def now_utc() -> datetime:
    return datetime.now(UTC)


class Dispute(Base):
    __tablename__ = "disputes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    market_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("markets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    disputer_address: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    claimed_outcome: Mapped[str | None] = mapped_column(String(16), nullable=True)
    bond_amount: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    bond_tx_signature: Mapped[str | None] = mapped_column(String(128), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False, index=True)
    resolved_outcome: Mapped[str | None] = mapped_column(String(16), nullable=True)
    resolved_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    market: Mapped["Market"] = relationship("Market")

    def __repr__(self) -> str:
        return f"<Dispute id={self.id} market_id={self.market_id}>"
