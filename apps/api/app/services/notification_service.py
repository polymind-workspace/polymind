from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Notification


class NotificationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_notifications(
        self,
        user_address: str,
        *,
        limit: int = 20,
        offset: int = 0,
    ) -> dict:
        # Total and unread are calculated across the whole inbox, not just the page.
        total_result = await self.session.execute(
            select(func.count()).where(Notification.user_address == user_address)
        )
        total = total_result.scalar() or 0

        unread_result = await self.session.execute(
            select(func.count()).where(
                Notification.user_address == user_address,
                Notification.read.is_(False),
            )
        )
        unread_count = unread_result.scalar() or 0

        stmt = (
            select(Notification)
            .where(Notification.user_address == user_address)
            .order_by(Notification.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        items = result.scalars().all()

        return {
            "items": [
                {
                    "id": str(n.id),
                    "type": n.type,
                    "title": n.title,
                    "body": n.body or "",
                    "read": n.read,
                    "createdAt": n.created_at.isoformat() if n.created_at else None,
                    "marketId": str(n.market_id) if n.market_id else None,
                    "actionUrl": n.action_url,
                }
                for n in items
            ],
            "total": total,
            "unread_count": unread_count,
        }

    async def mark_all_read(self, user_address: str) -> int:
        stmt = (
            update(Notification)
            .where(Notification.user_address == user_address)
            .where(Notification.read.is_(False))
            .values(read=True)
        )
        result = await self.session.execute(stmt)
        await self.session.commit()
        return getattr(result, "rowcount", 0) or 0

    async def mark_read(self, user_address: str, notification_id: int) -> bool:
        stmt = (
            update(Notification)
            .where(Notification.id == notification_id)
            .where(Notification.user_address == user_address)
            .where(Notification.read.is_(False))
            .values(read=True)
        )
        result = await self.session.execute(stmt)
        await self.session.commit()
        return (getattr(result, "rowcount", 0) or 0) > 0

    async def unread_count(self, user_address: str) -> int:
        result = await self.session.execute(
            select(func.count()).where(
                Notification.user_address == user_address,
                Notification.read.is_(False),
            )
        )
        return result.scalar() or 0
