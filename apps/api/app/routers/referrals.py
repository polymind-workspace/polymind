"""Referral router."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.core.response import success
from app.dependencies.auth import get_current_user
from app.models import User
from app.services.referral_service import ReferralService, get_referral_service

router = APIRouter(prefix="/api/v1/referrals", tags=["referrals"])


class ReferralBindRequest(BaseModel):
    invite_code: str = Field(..., min_length=8, max_length=32)


@router.get("")
async def get_referrals(
    user: User = Depends(get_current_user),
    svc: ReferralService = Depends(get_referral_service),
):
    data = await svc.get_referral_summary(user.address)
    return success(data=data)


@router.get("/code")
async def get_invite_code(
    user: User = Depends(get_current_user),
    svc: ReferralService = Depends(get_referral_service),
):
    data = await svc.get_invite_code(user.address)
    return success(data=data)


@router.post("/bind")
async def bind_inviter(
    body: ReferralBindRequest,
    user: User = Depends(get_current_user),
    svc: ReferralService = Depends(get_referral_service),
):
    data = await svc.bind_inviter(
        invitee_address=user.address,
        invite_code=body.invite_code,
    )
    return success(data=data)


@router.get("/rewards")
async def get_referral_rewards(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=24, ge=1, le=100),
    user: User = Depends(get_current_user),
    svc: ReferralService = Depends(get_referral_service),
):
    data = await svc.get_referral_rewards(user.address, page=page, limit=limit)
    return success(data=data)
