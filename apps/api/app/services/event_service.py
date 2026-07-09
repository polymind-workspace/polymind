from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.exceptions import ForbiddenError, NotFoundError
from app.db.session import get_db
from app.models import Event, EventCategory, Tag
from app.services.chain_parser import (
    PolyMindInstruction,
    fetch_and_parse_transaction,
    verify_creator_action,
)
from app.utils.slugify import unique_event_slug


class EventService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_events(
        self,
        *,
        category: str | None = None,
        tag: str | None = None,
        source: str | None = None,
        status: str | None = None,
        search: str | None = None,
        sort: str = "created_at",
        page: int = 1,
        limit: int = 24,
        is_admin: bool = False,
    ) -> dict:
        stmt = select(Event).options(
            joinedload(Event.category),
            selectinload(Event.tags),
            selectinload(Event.markets),
        )

        if category and category != "all":
            stmt = stmt.join(Event.category).where(EventCategory.slug == category)

        if tag:
            stmt = stmt.join(Event.tags).where(Tag.slug == tag)

        if source:
            stmt = stmt.where(Event.source == source)

        if status:
            stmt = stmt.where(Event.status == status)
        elif not is_admin:
            # Public list hides draft events by default.
            stmt = stmt.where(Event.status != "draft")

        if not is_admin:
            stmt = stmt.where(Event.is_flagged.is_(False))

        if search:
            like = f"%{search.strip()}%"
            stmt = stmt.where((Event.title.ilike(like)) | (Event.description.ilike(like)))

        total_result = await self.session.execute(
            select(func.count()).select_from(stmt.subquery())
        )
        total = total_result.scalar() or 0

        sort_column = getattr(Event, sort, Event.created_at)
        stmt = stmt.order_by(
            Event.pinned.desc(),
            Event.pinned_at.desc().nulls_last(),
            sort_column.desc(),
        )
        stmt = stmt.offset((page - 1) * limit).limit(limit)

        result = await self.session.execute(stmt)
        items = [self._serialize_event(e) for e in result.unique().scalars().all()]

        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "hasMore": page * limit < total,
        }

    async def get_event_by_slug(self, slug: str) -> dict | None:
        stmt = (
            select(Event)
            .options(
                joinedload(Event.category),
                selectinload(Event.tags),
                selectinload(Event.markets),
            )
            .where(Event.slug == slug)
        )
        result = await self.session.execute(stmt)
        event = result.unique().scalar_one_or_none()
        if not event:
            return None
        return self._serialize_event(event, detail=True)

    async def create_draft(
        self,
        *,
        user_address: str,
        title: str,
        description: str | None = None,
        image_url: str | None = None,
        rules: str | None = None,
        category_id: int | None = None,
    ) -> dict:
        slug = await unique_event_slug(self.session, title)
        event = Event(
            creator_address=user_address,
            slug=slug,
            title=title,
            description=description,
            image_url=image_url,
            rules=rules,
            category_id=category_id,
            status="draft",
            source="user",
        )
        self.session.add(event)
        await self.session.commit()

        # Re-query with eager loads so serialization does not trigger lazy loads.
        stmt = (
            select(Event)
            .options(
                joinedload(Event.category),
                selectinload(Event.tags),
                selectinload(Event.markets),
            )
            .where(Event.id == event.id)
        )
        result = await self.session.execute(stmt)
        event = result.unique().scalar_one()
        return self._serialize_event(event, detail=True)

    async def sync_event(self, signature: str, user_address: str) -> dict:
        """Confirm a create-event transaction and verify the creator signer."""
        parsed = await fetch_and_parse_transaction(signature)
        verify_creator_action(
            parsed,
            PolyMindInstruction.CREATE_EVENT,
            creator_address=user_address,
        )

        event_created = next(
            (ev for ev in parsed.polymind_events if ev.type.value == "EventCreated"),
            None,
        )
        if event_created is not None:
            from app.services.chain_parser import EventCreatedPayload

            payload = event_created.payload
            if isinstance(payload, EventCreatedPayload):
                if payload.creator != user_address:
                    raise ForbiddenError("signature creator does not match user")

        from app.clients.solana import SolanaClient

        client = SolanaClient()
        try:
            result = await client.confirm_transaction(signature)
        finally:
            await client.close()

        if not result.get("confirmed"):
            return {"confirmed": False, "signature": signature, "error": result.get("err")}

        return {"confirmed": True, "signature": signature, "slot": result.get("slot")}

    async def update_event(
        self,
        slug: str,
        updates: dict,
    ) -> dict:
        stmt = select(Event).where(Event.slug == slug)
        result = await self.session.execute(stmt)
        event = result.scalar_one_or_none()
        if not event:
            raise NotFoundError("event not found")

        allowed = {
            "title",
            "description",
            "image_url",
            "rules",
            "category_id",
            "status",
            "is_trending",
            "is_flagged",
            "can_share",
            "can_bet",
            "pinned",
            "pinned_at",
            "deadline",
        }
        for key, value in updates.items():
            if key in allowed:
                setattr(event, key, value)

        await self.session.commit()

        stmt = (
            select(Event)
            .options(
                joinedload(Event.category),
                selectinload(Event.tags),
                selectinload(Event.markets),
            )
            .where(Event.slug == slug)
        )
        result = await self.session.execute(stmt)
        event = result.unique().scalar_one()
        return self._serialize_event(event, detail=True)

    async def delete_event(self, slug: str) -> None:
        stmt = select(Event).where(Event.slug == slug)
        result = await self.session.execute(stmt)
        event = result.scalar_one_or_none()
        if not event:
            raise NotFoundError("event not found")
        if event.status not in ("draft",):
            raise ValueError("only draft events can be deleted")

        await self.session.delete(event)
        await self.session.commit()

    def _serialize_event(self, event: Event, *, detail: bool = False) -> dict:
        markets = event.markets or []
        total_yes_pool = sum(m.yes_pool for m in markets)
        total_no_pool = sum(m.no_pool for m in markets)
        volume = sum(m.volume for m in markets)
        players_count = max((m.players_count for m in markets), default=0)

        item = {
            "id": str(event.id),
            "slug": event.slug,
            "title": event.title,
            "description": event.description or "",
            "image_url": event.image_url,
            "category": event.category.name if event.category else "all",
            "source": event.source,
            "status": event.status,
            "is_trending": event.is_trending,
            "is_flagged": event.is_flagged,
            "can_share": event.can_share,
            "can_bet": event.can_bet,
            "pinned": event.pinned,
            "total_yes_pool": total_yes_pool / 1_000_000,
            "total_no_pool": total_no_pool / 1_000_000,
            "volume": volume / 1_000_000,
            "players_count": players_count,
            "deadline": event.deadline.isoformat() if event.deadline else None,
            "tags": [t.slug for t in event.tags],
            "created_at": event.created_at.isoformat() if event.created_at else None,
        }

        if detail:
            item["rules"] = event.rules or ""
            item["markets"] = [
                {
                    "id": str(m.id),
                    "slug": m.slug,
                    "title": m.title,
                    "status": m.status,
                    "yes_pool": m.yes_pool / 1_000_000,
                    "no_pool": m.no_pool / 1_000_000,
                    "volume": m.volume / 1_000_000,
                    "deadline": m.deadline.isoformat() if m.deadline else None,
                }
                for m in markets
            ]

        return item


def get_event_service(
    session: AsyncSession = Depends(get_db),
) -> EventService:
    return EventService(session)
