from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models import Referral


def now_utc() -> datetime:
    return datetime.now(UTC)


class ReferralReward(Base):
    __tablename__ = "referral_rewards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    referral_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("referrals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    market_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("markets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    amount: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False, index=True)
    tx_signature: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    referral: Mapped["Referral"] = relationship("Referral")

    def __repr__(self) -> str:
        return f"<ReferralReward id={self.id} amount={self.amount}>"
