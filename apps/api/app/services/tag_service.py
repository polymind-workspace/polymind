"""Tag service."""

from __future__ import annotations

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, NotFoundError
from app.db.session import get_db
from app.models import Tag


class TagService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_tags(self, *, active_only: bool = True) -> list[dict]:
        stmt = select(Tag)
        if active_only:
            stmt = stmt.where(Tag.is_active.is_(True))
        stmt = stmt.order_by(Tag.is_pinned.desc(), Tag.sort_order.asc(), Tag.name.asc())
        result = await self.session.execute(stmt)
        return [self._serialize_tag(t) for t in result.scalars().all()]

    async def create_tag(
        self,
        *,
        slug: str,
        name: str,
        sort_order: int = 0,
        is_active: bool = True,
        is_pinned: bool = False,
    ) -> dict:
        existing = await self.session.execute(select(Tag).where(Tag.slug == slug))
        if existing.scalar_one_or_none() is not None:
            raise BadRequestError("tag slug already exists")

        tag = Tag(
            slug=slug,
            name=name,
            sort_order=sort_order,
            is_active=is_active,
            is_pinned=is_pinned,
        )
        self.session.add(tag)
        await self.session.commit()
        await self.session.refresh(tag)
        return self._serialize_tag(tag)

    async def update_tag(self, slug: str, updates: dict) -> dict:
        tag = await self._get_tag_by_slug(slug)
        if not tag:
            raise NotFoundError("tag not found")

        allowed = {"name", "sort_order", "is_active", "is_pinned"}
        for key, value in updates.items():
            if key in allowed:
                setattr(tag, key, value)

        await self.session.commit()
        await self.session.refresh(tag)
        return self._serialize_tag(tag)

    async def delete_tag(self, slug: str) -> None:
        tag = await self._get_tag_by_slug(slug)
        if not tag:
            raise NotFoundError("tag not found")

        await self.session.delete(tag)
        await self.session.commit()

    async def _get_tag_by_slug(self, slug: str) -> Tag | None:
        result = await self.session.execute(select(Tag).where(Tag.slug == slug))
        return result.scalar_one_or_none()

    def _serialize_tag(self, tag: Tag) -> dict:
        return {
            "id": tag.id,
            "slug": tag.slug,
            "name": tag.name,
            "sort_order": tag.sort_order,
            "is_active": tag.is_active,
            "is_pinned": tag.is_pinned,
            "created_at": tag.created_at.isoformat() if tag.created_at else None,
        }


def get_tag_service(session: AsyncSession = Depends(get_db)) -> TagService:
    return TagService(session)
