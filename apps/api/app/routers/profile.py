"""Profile router."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.exceptions import NotFoundError
from app.core.response import success
from app.dependencies.auth import get_current_user
from app.models import User
from app.services.profile_service import ProfileService

router = APIRouter(prefix="/api/v1/profile", tags=["profile"])


def get_profile_service(db) -> ProfileService:
    return ProfileService(db)


@router.get("")
async def get_profile(
    user: User = Depends(get_current_user),
    svc: ProfileService = Depends(get_profile_service),
):
    data = await svc.get_profile(user.address)
    if not data:
        raise NotFoundError("profile not found")
    return success(data=data)


@router.get("/rewards")
async def get_creator_rewards(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=24, ge=1, le=100),
    user: User = Depends(get_current_user),
    svc: ProfileService = Depends(get_profile_service),
):
    data = await svc.get_creator_rewards(user.address, page=page, limit=limit)
    return success(data=data)
