from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.core.response import success
from app.db.session import get_db
from app.models.user import User

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("")
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.id))
    users = result.scalars().all()
    return success(
        data=[
            {"id": u.id, "address": u.address, "nickname": u.nickname}
            for u in users
        ]
    )


@router.get("/health")
async def users_health():
    return success()


@router.get("/{user_id}")
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundError("user not found")
    return success(data={"id": user.id, "address": user.address, "nickname": user.nickname})
