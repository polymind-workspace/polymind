from datetime import UTC, datetime
from typing import Any

from sqlalchemy import BigInteger, DateTime, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ChainEventLog(Base):
    __tablename__ = "chain_event_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    program_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    module: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    subject: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    signature: Mapped[str] = mapped_column(String(128), nullable=False)
    slot: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    block_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    event_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    kind: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    actor: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    __table_args__ = (
        Index(
            "ix_chain_event_log_signature_kind_idx",
            "signature",
            "kind",
            "event_index",
            unique=True,
        ),
        Index("ix_chain_event_log_module_subject_kind", "module", "subject", "kind"),
    )
