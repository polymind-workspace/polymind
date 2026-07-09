"""Dispute router."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.core.exceptions import NotFoundError
from app.core.response import success
from app.dependencies.auth import get_current_user, require_permission
from app.models import User
from app.services.dispute_service import DisputeService, get_dispute_service

router = APIRouter(prefix="/api/v1/disputes", tags=["disputes"])


class DisputeCreateRequest(BaseModel):
    market_slug: str = Field(..., min_length=1, max_length=256)
    claimed_outcome: str = Field(..., pattern="^(yes|no|void)$")
    signature: str = Field(..., min_length=64, max_length=128)
    reason: str | None = Field(None, max_length=2000)


class DisputeResolveRequest(BaseModel):
    resolved_outcome: str = Field(..., pattern="^(yes|no|void)$")
    signature: str = Field(..., min_length=64, max_length=128)
    reason: str | None = Field(None, max_length=2000)


@router.get("")
async def list_disputes(
    market_id: int | None = Query(default=None),
    market_slug: str | None = Query(default=None),
    status: str | None = Query(default=None, pattern="^(active|resolved|rejected)$"),
    disputer_address: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=24, ge=1, le=100),
    svc: DisputeService = Depends(get_dispute_service),
):
    data = await svc.list_disputes(
        market_id=market_id,
        market_slug=market_slug,
        status=status,
        disputer_address=disputer_address,
        page=page,
        limit=limit,
    )
    return success(data=data)


@router.get("/{dispute_id}")
async def get_dispute(
    dispute_id: int,
    svc: DisputeService = Depends(get_dispute_service),
):
    data = await svc.get_dispute(dispute_id)
    if not data:
        raise NotFoundError("dispute not found")
    return success(data=data)


@router.post("")
async def create_dispute(
    body: DisputeCreateRequest,
    user: User = Depends(get_current_user),
    svc: DisputeService = Depends(get_dispute_service),
):
    data = await svc.create_dispute(
        market_slug=body.market_slug,
        disputer_address=user.address,
        claimed_outcome=body.claimed_outcome,
        signature=body.signature,
        reason=body.reason,
    )
    return success(data=data)


@router.post("/{dispute_id}/resolve")
async def resolve_dispute(
    dispute_id: int,
    body: DisputeResolveRequest,
    account=Depends(require_permission("disputes:resolve")),
    svc: DisputeService = Depends(get_dispute_service),
):
    data = await svc.resolve_dispute(
        dispute_id=dispute_id,
        admin_address=account.address,
        resolved_outcome=body.resolved_outcome,
        signature=body.signature,
        reason=body.reason,
    )
    return success(data=data)
