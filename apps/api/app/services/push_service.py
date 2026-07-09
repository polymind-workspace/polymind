"""Push message service."""

from __future__ import annotations

from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models import Notification, PushMessage


class PushService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_messages(
        self,
        *,
        recipient_address: str | None = None,
        status: str | None = None,
        page: int = 1,
        limit: int = 24,
    ) -> dict:
        stmt = select(PushMessage)
        if recipient_address:
            stmt = stmt.where(PushMessage.recipient_address == recipient_address)
        if status:
            stmt = stmt.where(PushMessage.status == status)

        total_result = await self.session.execute(
            select(func.count()).select_from(stmt.subquery())
        )
        total = total_result.scalar() or 0

        stmt = stmt.order_by(PushMessage.created_at.desc())
        stmt = stmt.offset((page - 1) * limit).limit(limit)

        result = await self.session.execute(stmt)
        items = [m.to_dict() for m in result.scalars().all()]

        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "hasMore": page * limit < total,
        }

    async def send_message(
        self,
        *,
        title: str,
        body: str | None,
        recipient_address: str | None,
        action_url: str | None,
    ) -> dict:
        """Record a push message and mirror it to the in-app Notification table.

        Actual delivery to push providers is delegated to a background worker;
        this method only creates the pending records.
        """
        push = PushMessage(
            recipient_address=recipient_address,
            title=title,
            body=body,
            action_url=action_url,
            status="pending",
        )
        self.session.add(push)

        # Mirror to in-app notification. For broadcast pushes without a
        # recipient, the caller is responsible for fan-out or we skip the
        # in-app mirror.
        if recipient_address:
            notification = Notification(
                user_address=recipient_address,
                type="push",
                title=title,
                body=body,
                action_url=action_url,
                read=False,
            )
            self.session.add(notification)

        await self.session.commit()
        await self.session.refresh(push)
        return push.to_dict()

    async def update_status(
        self,
        message_id: int,
        *,
        status: str,
        error: str | None = None,
    ) -> dict:
        message = await self._get_message_by_id(message_id)
        if not message:
            raise NotFoundError("push message not found")

        message.status = status
        message.error = error
        await self.session.commit()
        await self.session.refresh(message)
        return message.to_dict()

    async def _get_message_by_id(self, message_id: int) -> PushMessage | None:
        result = await self.session.execute(
            select(PushMessage).where(PushMessage.id == message_id)
        )
        return result.scalar_one_or_none()


def get_push_service(session: AsyncSession = Depends(get_db)) -> PushService:
    return PushService(session)
