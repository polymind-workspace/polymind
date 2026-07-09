"""Reward payout job queue model."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import BigInteger, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def now_utc() -> datetime:
    return datetime.now(UTC)


class RewardPayout(Base):
    __tablename__ = "reward_payouts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_address: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    payout_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    amount: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), default="pending", nullable=False, index=True
    )
    payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    tx_signature: Mapped[str | None] = mapped_column(String(128), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    def __repr__(self) -> str:
        return f"<RewardPayout id={self.id} status={self.status}>"

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "user_address": self.user_address,
            "payout_type": self.payout_type,
            "amount": self.amount,
            "status": self.status,
            "payload": self.payload,
            "tx_signature": self.tx_signature,
            "error": self.error,
            "executed_at": self.executed_at.isoformat() if self.executed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
