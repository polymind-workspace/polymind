from sqlalchemy import ForeignKey, Integer, PrimaryKeyConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class EventTag(Base):
    __tablename__ = "event_tags"

    event_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    tag_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tags.id", ondelete="CASCADE"), nullable=False
    )

    __table_args__ = (PrimaryKeyConstraint("event_id", "tag_id"),)

    def __repr__(self) -> str:
        return f"<EventTag event_id={self.event_id} tag_id={self.tag_id}>"
