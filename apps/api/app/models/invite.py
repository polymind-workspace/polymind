"""Legacy invite reward / claim tables (admin compatibility layer).

These tables mirror the old Endless admin backend schema so the admin
frontend can continue to operate while the referral system is migrated to
Solana. New referral data can be synced into these tables by a worker.
"""

from datetime import UTC, datetime

from sqlalchemy import BigInteger, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def now_utc() -> datetime:
    return datetime.now(UTC)


class InviteReward(Base):
    __tablename__ = "invite_rewards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    inviter_luffa_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    invitee_luffa_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    invitee_address: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    onchain_event_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    market_idx: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bet_tx_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    bet_tx_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bet_amount_base: Mapped[str] = mapped_column(String(64), default="0", nullable=False)
    reward_base: Mapped[str] = mapped_column(String(64), default="0", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False, index=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_tx_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )


class InviteBalance(Base):
    __tablename__ = "invite_balances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    inviter_luffa_id: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    pending_base: Mapped[str] = mapped_column(String(64), default="0", nullable=False)
    paid_base: Mapped[str] = mapped_column(String(64), default="0", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )


class ClaimRequest(Base):
    __tablename__ = "claim_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    uid: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    user_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    amount_base: Mapped[str] = mapped_column(String(64), default="0", nullable=False)
    reward_ids: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False, index=True)
    tx_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
