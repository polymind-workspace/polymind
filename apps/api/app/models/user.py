from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    address: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    nickname: Mapped[str | None] = mapped_column(String(64), nullable=True)
    avatar: Mapped[str | None] = mapped_column(String(256), nullable=True)

    def __repr__(self) -> str:
        return f"<User id={self.id} address={self.address}>"
