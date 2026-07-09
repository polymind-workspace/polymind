"""Batch transfer router."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.core.response import success
from app.dependencies.auth import get_current_user, require_permission
from app.models import User
from app.services.batch_transfer_service import (
    BatchTransferService,
    get_batch_transfer_service,
)
from app.utils.token import parse_token_amount

router = APIRouter(prefix="/api/v1/batch-transfers", tags=["batch-transfers"])


class BatchTransferCreateRequest(BaseModel):
    recipient_address: str = Field(..., min_length=32, max_length=44)
    amount: float = Field(..., gt=0)
    token_mint: str | None = Field(None, max_length=64)
    payload: dict | None = None


class BatchTransferExecuteRequest(BaseModel):
    signature: str | None = Field(None, min_length=64, max_length=128)


@router.get("", dependencies=[Depends(require_permission("batch_transfers:list"))])
async def list_batch_transfers(
    sender_address: str | None = Query(default=None),
    recipient_address: str | None = Query(default=None),
    status: str | None = Query(default=None, pattern="^(pending|running|completed|failed)$"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=24, ge=1, le=100),
    svc: BatchTransferService = Depends(get_batch_transfer_service),
):
    data = await svc.list_transfers(
        sender_address=sender_address,
        recipient_address=recipient_address,
        status=status,
        page=page,
        limit=limit,
    )
    return success(data=data)


@router.post("", dependencies=[Depends(require_permission("batch_transfers:create"))])
async def create_batch_transfer(
    body: BatchTransferCreateRequest,
    user: User = Depends(get_current_user),
    svc: BatchTransferService = Depends(get_batch_transfer_service),
):
    data = await svc.create_transfer(
        sender_address=user.address,
        recipient_address=body.recipient_address,
        amount=parse_token_amount(body.amount),
        token_mint=body.token_mint,
        payload=body.payload,
    )
    return success(data=data)


@router.post(
    "/{transfer_id}/execute",
    dependencies=[Depends(require_permission("batch_transfers:execute"))],
)
async def execute_batch_transfer(
    transfer_id: int,
    body: BatchTransferExecuteRequest,
    svc: BatchTransferService = Depends(get_batch_transfer_service),
):
    data = await svc.execute_transfer(transfer_id, signature=body.signature)
    return success(data=data)
