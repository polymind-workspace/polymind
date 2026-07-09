"""Activity / banner CMS service."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models import Activity


class ActivityService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_activities(self, *, active_only: bool = True) -> list[dict]:
        stmt = select(Activity)
        if active_only:
            now = datetime.now(UTC)
            stmt = stmt.where(
                Activity.is_active.is_(True),
                (Activity.start_at.is_(None)) | (Activity.start_at <= now),
                (Activity.end_at.is_(None)) | (Activity.end_at >= now),
            )
        stmt = stmt.order_by(Activity.sort_order.asc(), Activity.created_at.desc())
        result = await self.session.execute(stmt)
        return [a.to_dict() for a in result.scalars().all()]

    async def create_activity(self, data: dict) -> dict:
        activity = Activity(**data)
        self.session.add(activity)
        await self.session.commit()
        await self.session.refresh(activity)
        return activity.to_dict()

    async def update_activity(self, activity_id: int, updates: dict) -> dict:
        activity = await self._get_activity_by_id(activity_id)
        if not activity:
            raise NotFoundError("activity not found")

        allowed = {
            "title",
            "subtitle",
            "image_url",
            "action_url",
            "tags",
            "sort_order",
            "is_active",
            "start_at",
            "end_at",
        }
        for key, value in updates.items():
            if key in allowed:
                setattr(activity, key, value)

        await self.session.commit()
        await self.session.refresh(activity)
        return activity.to_dict()

    async def delete_activity(self, activity_id: int) -> None:
        activity = await self._get_activity_by_id(activity_id)
        if not activity:
            raise NotFoundError("activity not found")

        await self.session.delete(activity)
        await self.session.commit()

    async def _get_activity_by_id(self, activity_id: int) -> Activity | None:
        result = await self.session.execute(
            select(Activity).where(Activity.id == activity_id)
        )
        return result.scalar_one_or_none()


def get_activity_service(session: AsyncSession = Depends(get_db)) -> ActivityService:
    return ActivityService(session)
