"""Push message router."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.core.response import success
from app.dependencies.auth import require_permission
from app.services.push_service import PushService, get_push_service

router = APIRouter(prefix="/api/v1/push", tags=["push"])


class PushSendRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=256)
    body: str | None = Field(None, max_length=2000)
    recipient_address: str | None = Field(None, min_length=32, max_length=44)
    action_url: str | None = Field(None, max_length=1024)


class PushStatusUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(pending|sent|failed)$")
    error: str | None = Field(None, max_length=2000)


@router.get("", dependencies=[Depends(require_permission("push:list"))])
async def list_push_messages(
    recipient_address: str | None = Query(default=None),
    status: str | None = Query(default=None, pattern="^(pending|sent|failed)$"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=24, ge=1, le=100),
    svc: PushService = Depends(get_push_service),
):
    data = await svc.list_messages(
        recipient_address=recipient_address,
        status=status,
        page=page,
        limit=limit,
    )
    return success(data=data)


@router.post("", dependencies=[Depends(require_permission("push:send"))])
async def send_push(
    body: PushSendRequest,
    svc: PushService = Depends(get_push_service),
):
    data = await svc.send_message(
        title=body.title,
        body=body.body,
        recipient_address=body.recipient_address,
        action_url=body.action_url,
    )
    return success(data=data)


@router.patch("/{message_id}/status", dependencies=[Depends(require_permission("push:send"))])
async def update_push_status(
    message_id: int,
    body: PushStatusUpdateRequest,
    svc: PushService = Depends(get_push_service),
):
    data = await svc.update_status(
        message_id,
        status=body.status,
        error=body.error,
    )
    return success(data=data)
