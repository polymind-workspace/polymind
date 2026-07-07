from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("")
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.id))
    users = result.scalars().all()
    return {
        "ret": 200,
        "msg": "ok",
        "data": [
            {"id": u.id, "address": u.address, "nickname": u.nickname}
            for u in users
        ],
    }


@router.get("/health")
async def users_health():
    return {"ret": 200, "msg": "ok"}
