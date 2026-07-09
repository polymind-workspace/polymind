from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models import Event


def now_utc() -> datetime:
    return datetime.now(UTC)


class Market(Base):
    __tablename__ = "markets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    creator_address: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    market_idx: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    slug: Mapped[str] = mapped_column(String(256), unique=True, nullable=False, index=True)
    onchain_market_id: Mapped[str | None] = mapped_column(
        String(64), unique=True, nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    label_yes: Mapped[str] = mapped_column(String(128), default="Yes", nullable=False)
    label_no: Mapped[str] = mapped_column(String(128), default="No", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="open", nullable=False, index=True)
    deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    min_bet: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    yes_pool: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    no_pool: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    bonus_pool: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    volume: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    players_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    proposed_outcome: Mapped[str | None] = mapped_column(String(16), nullable=True)
    proposed_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    proposed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finalized_outcome: Mapped[str | None] = mapped_column(String(16), nullable=True)
    finalized_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    finalized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dispute_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    creator_seed_bet_amount: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    creator_seed_bet_side: Mapped[str | None] = mapped_column(String(16), nullable=True)
    creator_seed_bet_tx: Mapped[str | None] = mapped_column(String(128), nullable=True)
    creator_propose_timeout: Mapped[int] = mapped_column(
        BigInteger, default=259_200, nullable=False
    )
    platform_fee_bps: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    platform_fee_max: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    creator_reward_bps: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    creator_reward_max: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    dispute_window_secs: Mapped[int] = mapped_column(BigInteger, default=86_400, nullable=False)
    admin_timeout_secs: Mapped[int] = mapped_column(BigInteger, default=604_800, nullable=False)
    vault_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    creator_performed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    platform_rake: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    creator_reward: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    distributable_pool: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    __table_args__ = (UniqueConstraint("event_id", "market_idx", name="uq_market_event_idx"),)

    event: Mapped["Event"] = relationship("Event", back_populates="markets")

    def __repr__(self) -> str:
        return f"<Market id={self.id} slug={self.slug}>"
