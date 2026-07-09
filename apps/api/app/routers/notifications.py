"""Notification router."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.response import success
from app.dependencies.auth import get_current_user
from app.models import User
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


def get_notification_service(db) -> NotificationService:
    return NotificationService(db)


@router.get("")
async def list_notifications(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    svc: NotificationService = Depends(get_notification_service),
):
    data = await svc.list_notifications(user.address, limit=limit, offset=offset)
    return success(data=data)


@router.get("/unread-count")
async def unread_count(
    user: User = Depends(get_current_user),
    svc: NotificationService = Depends(get_notification_service),
):
    count = await svc.unread_count(user.address)
    return success(data={"unread_count": count})


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    user: User = Depends(get_current_user),
    svc: NotificationService = Depends(get_notification_service),
):
    updated = await svc.mark_read(user.address, notification_id)
    return success(data={"updated": 1 if updated else 0})


@router.post("/read")
async def mark_notifications_read(
    user: User = Depends(get_current_user),
    svc: NotificationService = Depends(get_notification_service),
):
    count = await svc.mark_all_read(user.address)
    return success(data={"updated": count})
