"""Campaign metadata model (legacy Champion / admin campaign compatibility)."""

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

if TYPE_CHECKING:
    pass


def now_utc() -> datetime:
    return datetime.now(UTC)


class CampaignMeta(Base):
    __tablename__ = "campaign_meta"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    campaign_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    lang: Mapped[str] = mapped_column(String(16), nullable=False, default="en")
    title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    window_label: Mapped[str | None] = mapped_column(String(256), nullable=True)
    pick_label: Mapped[str | None] = mapped_column(String(256), nullable=True)
    option_labels: Mapped[str | None] = mapped_column(Text, nullable=True)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    __table_args__ = {"sqlite_autoincrement": True}
