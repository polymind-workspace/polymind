from datetime import UTC, datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def now_utc() -> datetime:
    return datetime.now(UTC)


class Referral(Base):
    __tablename__ = "referrals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    inviter_address: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    invitee_address: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    invite_code_used: Mapped[str | None] = mapped_column(String(32), nullable=True)
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False, index=True)

    def __repr__(self) -> str:
        return f"<Referral inviter={self.inviter_address[:8]} invitee={self.invitee_address[:8]}>"
