from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models import EventCategory, Market, Tag


def now_utc() -> datetime:
    return datetime.now(UTC)


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    onchain_event_id: Mapped[str | None] = mapped_column(
        String(64), unique=True, nullable=True, index=True
    )
    slug: Mapped[str] = mapped_column(String(256), unique=True, nullable=False, index=True)
    creator_address: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    category_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("event_categories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    rules: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(32), default="user", nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), default="open", nullable=False, index=True)
    is_trending: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_share: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    can_bet: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    pinned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total_yes_pool: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    total_no_pool: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    volume: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    players_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    token_mint: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    category: Mapped["EventCategory"] = relationship("EventCategory")
    tags: Mapped[list["Tag"]] = relationship("Tag", secondary="event_tags")
    markets: Mapped[list["Market"]] = relationship("Market", back_populates="event")

    def __repr__(self) -> str:
        return f"<Event id={self.id} title={self.title[:30]}>"
