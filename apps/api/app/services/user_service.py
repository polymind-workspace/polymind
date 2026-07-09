"""User service."""

from __future__ import annotations

from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.db.session import get_db
from app.models import User


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_users(
        self,
        *,
        search: str | None = None,
        page: int = 1,
        limit: int = 24,
    ) -> dict:
        stmt = select(User)

        if search:
            like = f"%{search.strip()}%"
            stmt = stmt.where(
                (User.address.ilike(like)) | (User.nickname.ilike(like))
            )

        total_result = await self.session.execute(
            select(func.count()).select_from(stmt.subquery())
        )
        total = total_result.scalar() or 0

        stmt = stmt.order_by(User.created_at.desc())
        stmt = stmt.offset((page - 1) * limit).limit(limit)

        result = await self.session.execute(stmt)
        items = [self._serialize_user(u) for u in result.scalars().all()]

        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "hasMore": page * limit < total,
        }

    async def get_user(
        self,
        id_or_address: str,
        *,
        current_user: User | None = None,
        is_admin: bool = False,
    ) -> dict | None:
        user = await self._resolve_user(id_or_address)
        if not user:
            return None

        if not is_admin and (current_user is None or current_user.address != user.address):
            raise ForbiddenError("not allowed to view this user")

        return self._serialize_user(user, detail=True)

    async def update_user(
        self,
        id_or_address: str,
        updates: dict,
    ) -> dict:
        user = await self._resolve_user(id_or_address)
        if not user:
            raise NotFoundError("user not found")

        allowed = {"nickname", "avatar", "is_admin", "is_pro", "pro_expires_at"}
        for key, value in updates.items():
            if key in allowed:
                setattr(user, key, value)

        await self.session.commit()
        await self.session.refresh(user)
        return self._serialize_user(user, detail=True)

    async def _resolve_user(self, id_or_address: str) -> User | None:
        if id_or_address.isdigit():
            result = await self.session.execute(
                select(User).where(User.id == int(id_or_address))
            )
            return result.scalar_one_or_none()

        result = await self.session.execute(
            select(User).where(User.address == id_or_address)
        )
        return result.scalar_one_or_none()

    def _serialize_user(self, user: User, *, detail: bool = False) -> dict:
        item = {
            "id": user.id,
            "address": user.address,
            "nickname": user.nickname,
            "avatar": user.avatar,
            "invite_code": user.invite_code,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }

        if detail:
            item["is_admin"] = user.is_admin
            item["is_pro"] = user.is_pro
            item["pro_expires_at"] = (
                user.pro_expires_at.isoformat() if user.pro_expires_at else None
            )
            item["inviter_id"] = user.inviter_id

        return item


def get_user_service(session: AsyncSession = Depends(get_db)) -> UserService:
    return UserService(session)
