from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.response import success
from app.db.session import get_db
from app.services.leaderboard_service import LeaderboardService

router = APIRouter(prefix="/api/v1/leaderboard", tags=["leaderboard"])


def get_leaderboard_service(db: AsyncSession = Depends(get_db)) -> LeaderboardService:
    return LeaderboardService(db)


@router.get("/{type}")
async def get_leaderboard(
    type: str = Path(..., pattern="^(invite|bet|topic)$"),
    period: str = Query(default="week", pattern="^(day|week|month|all)$"),
    limit: int = Query(default=10, ge=1, le=100),
    svc: LeaderboardService = Depends(get_leaderboard_service),
):
    data = await svc.get_leaderboard(type, period=period, limit=limit)
    return success(data=data)
