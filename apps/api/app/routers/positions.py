"""Position / claim router mounted under /api/v1/markets."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.response import success
from app.dependencies.auth import get_current_user
from app.models import User
from app.services.position_service import PositionService, get_position_service

router = APIRouter(prefix="/api/v1/markets", tags=["positions"])


class ClaimSyncRequest(BaseModel):
    signature: str = Field(..., min_length=64, max_length=128)


@router.get("/{slug}/claim-preview")
async def claim_preview(
    slug: str,
    user: User = Depends(get_current_user),
    svc: PositionService = Depends(get_position_service),
):
    data = await svc.get_claim_preview(market_slug=slug, user_address=user.address)
    return success(data=data)


@router.post("/{slug}/claim")
async def claim(
    slug: str,
    body: ClaimSyncRequest,
    user: User = Depends(get_current_user),
    svc: PositionService = Depends(get_position_service),
):
    data = await svc.sync_claim(
        market_slug=slug,
        user_address=user.address,
        signature=body.signature,
    )
    return success(data=data)
