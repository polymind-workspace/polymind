"""Reward payout router."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.core.response import success
from app.dependencies.auth import require_permission
from app.services.reward_payout_service import (
    RewardPayoutService,
    get_reward_payout_service,
)
from app.utils.token import parse_token_amount

router = APIRouter(prefix="/api/v1/reward-payouts", tags=["reward-payouts"])


class RewardPayoutCreateRequest(BaseModel):
    user_address: str = Field(..., min_length=32, max_length=44)
    payout_type: str = Field(..., min_length=1, max_length=32)
    amount: float = Field(..., gt=0)
    payload: dict | None = None


class RewardPayoutExecuteRequest(BaseModel):
    signature: str | None = Field(None, min_length=64, max_length=128)


@router.get("", dependencies=[Depends(require_permission("reward_payouts:list"))])
async def list_reward_payouts(
    user_address: str | None = Query(default=None),
    status: str | None = Query(default=None, pattern="^(pending|running|completed|failed)$"),
    payout_type: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=24, ge=1, le=100),
    svc: RewardPayoutService = Depends(get_reward_payout_service),
):
    data = await svc.list_payouts(
        user_address=user_address,
        status=status,
        payout_type=payout_type,
        page=page,
        limit=limit,
    )
    return success(data=data)


@router.post("", dependencies=[Depends(require_permission("reward_payouts:create"))])
async def create_reward_payout(
    body: RewardPayoutCreateRequest,
    svc: RewardPayoutService = Depends(get_reward_payout_service),
):
    data = await svc.create_payout(
        user_address=body.user_address,
        payout_type=body.payout_type,
        amount=parse_token_amount(body.amount),
        payload=body.payload,
    )
    return success(data=data)


@router.post(
    "/{payout_id}/execute",
    dependencies=[Depends(require_permission("reward_payouts:execute"))],
)
async def execute_reward_payout(
    payout_id: int,
    body: RewardPayoutExecuteRequest,
    svc: RewardPayoutService = Depends(get_reward_payout_service),
):
    data = await svc.execute_payout(payout_id, signature=body.signature)
    return success(data=data)
