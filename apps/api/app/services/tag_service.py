"""Tag service."""

from __future__ import annotations

from fastapi import Depends
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, NotFoundError
from app.db.session import get_db
from app.models import Event, EventTag, Tag


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

    async def bulk_attach_events(self, tag_slug: str, event_slugs: list[str]) -> dict:
        """Attach a tag to multiple events."""
        tag = await self._get_tag_by_slug(tag_slug)
        if not tag:
            raise NotFoundError("tag not found")

        result = await self.session.execute(
            select(Event.id, Event.slug).where(Event.slug.in_(event_slugs))
        )
        event_rows = result.all()
        event_map = {row.slug: row.id for row in event_rows}

        unknown = [slug for slug in event_slugs if slug not in event_map]

        existing_result = await self.session.execute(
            select(EventTag.event_id).where(
                EventTag.tag_id == tag.id,
                EventTag.event_id.in_(list(event_map.values())),
            )
        )
        existing_event_ids = set(existing_result.scalars().all())

        skipped = [
            slug for slug, event_id in event_map.items() if event_id in existing_event_ids
        ]
        to_attach = [
            event_id
            for slug, event_id in event_map.items()
            if event_id not in existing_event_ids
        ]

        for event_id in to_attach:
            self.session.add(EventTag(event_id=event_id, tag_id=tag.id))

        await self.session.commit()

        return {
            "changed": [
                slug for slug, event_id in event_map.items() if event_id in to_attach
            ],
            "skipped_existing": skipped,
            "unknown_slugs": unknown,
        }

    async def bulk_detach_events(self, tag_slug: str, event_slugs: list[str]) -> dict:
        """Detach a tag from multiple events."""
        tag = await self._get_tag_by_slug(tag_slug)
        if not tag:
            raise NotFoundError("tag not found")

        result = await self.session.execute(
            select(Event.id, Event.slug).where(Event.slug.in_(event_slugs))
        )
        event_rows = result.all()
        event_map = {row.slug: row.id for row in event_rows}

        unknown = [slug for slug in event_slugs if slug not in event_map]

        attached_result = await self.session.execute(
            select(EventTag.event_id).where(
                EventTag.tag_id == tag.id,
                EventTag.event_id.in_(list(event_map.values())),
            )
        )
        attached_event_ids = set(attached_result.scalars().all())

        to_detach = {
            event_id
            for slug, event_id in event_map.items()
            if event_id in attached_event_ids
        }

        if to_detach:
            await self.session.execute(
                delete(EventTag).where(
                    EventTag.tag_id == tag.id,
                    EventTag.event_id.in_(list(to_detach)),
                )
            )
            await self.session.commit()

        return {
            "changed": [
                slug
                for slug, event_id in event_map.items()
                if event_id in to_detach
            ],
            "unknown_slugs": unknown,
        }

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
