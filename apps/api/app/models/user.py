from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def now_utc() -> datetime:
    return datetime.now(timezone.utc)  # noqa: UP017


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    address: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    nickname: Mapped[str | None] = mapped_column(String(64), nullable=True)
    avatar: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_pro: Mapped[bool] = mapped_column(Boolean, default=False)
    pro_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    invite_code: Mapped[str | None] = mapped_column(
        String(32), unique=True, nullable=True, index=True
    )
    inviter_id: Mapped[int | None] = mapped_column(
        Integer, nullable=True, index=True
    )
    inbox_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} address={self.address}>"
