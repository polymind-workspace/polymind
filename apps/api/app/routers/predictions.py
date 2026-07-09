from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.response import success
from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models import User
from app.services.prediction_service import PredictionService

router = APIRouter(prefix="/api/v1/predictions", tags=["predictions"])


def get_prediction_service(db: AsyncSession = Depends(get_db)) -> PredictionService:
    return PredictionService(db)


@router.get("")
async def list_predictions(
    status: str | None = Query(default=None, pattern="^(active|resolved)$"),
    user: User = Depends(get_current_user),
    svc: PredictionService = Depends(get_prediction_service),
):
    data = await svc.list_user_positions(user.address, status=status)
    return success(data=data)
