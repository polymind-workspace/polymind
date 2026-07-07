from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.db.base import Base

connect_args = {"check_same_thread": False} if settings.is_sqlite else {}

engine = create_async_engine(
    settings.database_url,
    echo=settings.database_echo,
    future=True,
    connect_args=connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """Create all tables defined by SQLAlchemy models."""
    async with engine.begin() as conn:
        if settings.is_sqlite:
            # Enable foreign key constraints for SQLite.
            await conn.exec_driver_sql("PRAGMA foreign_keys=ON")
        await conn.run_sync(Base.metadata.create_all)
