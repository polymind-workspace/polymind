from datetime import UTC, datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def now_utc() -> datetime:
    return datetime.now(UTC)


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    admin_address: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    market_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("markets.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    dispute_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("disputes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    tx_signature: Mapped[str | None] = mapped_column(
        String(128), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=now_utc
    )

    __table_args__ = (
        Index("ix_admin_audit_log_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<AdminAuditLog id={self.id} action={self.action}>"
