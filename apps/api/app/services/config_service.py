"""Config service."""

from __future__ import annotations

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models import Config


class ConfigService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_configs(self, *, public_only: bool = True) -> list[dict]:
        stmt = select(Config)
        if public_only:
            stmt = stmt.where(Config.is_public.is_(True))
        stmt = stmt.order_by(Config.key)
        result = await self.session.execute(stmt)
        return [self._serialize_config(c) for c in result.scalars().all()]

    async def get_config(self, key: str, *, public_only: bool = True) -> dict | None:
        result = await self.session.execute(select(Config).where(Config.key == key))
        config = result.scalar_one_or_none()
        if not config:
            return None
        if public_only and not config.is_public:
            return None
        return self._serialize_config(config)

    async def update_config(self, key: str, updates: dict) -> dict:
        result = await self.session.execute(select(Config).where(Config.key == key))
        config = result.scalar_one_or_none()
        if not config:
            raise NotFoundError("config not found")

        if "value" in updates:
            config.value = updates["value"]
        if "memo" in updates:
            config.memo = updates["memo"]
        if "is_public" in updates:
            config.is_public = updates["is_public"]

        await self.session.commit()
        await self.session.refresh(config)
        return self._serialize_config(config)

    def _serialize_config(self, config: Config) -> dict:
        return {
            "key": config.key,
            "value": config.value,
            "memo": config.memo,
            "is_public": config.is_public,
            "updated_at": config.updated_at.isoformat() if config.updated_at else None,
        }


def get_config_service(session: AsyncSession = Depends(get_db)) -> ConfigService:
    return ConfigService(session)
