"""Activity / banner CMS router."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.core.response import success
from app.dependencies.auth import get_admin_account_optional, require_permission
from app.services.activity_service import ActivityService, get_activity_service
from app.utils.csv import csv_response

router = APIRouter(prefix="/api/v1/activities", tags=["activities"])


class ActivityCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=256)
    subtitle: str | None = Field(None, max_length=512)
    image_url: str | None = Field(None, max_length=1024)
    action_url: str | None = Field(None, max_length=1024)
    tags: list[str] | None = None
    sort_order: int = Field(default=0, ge=0)
    is_active: bool = True
    start_at: datetime | None = None
    end_at: datetime | None = None


class ActivityUpdateRequest(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=256)
    subtitle: str | None = Field(None, max_length=512)
    image_url: str | None = Field(None, max_length=1024)
    action_url: str | None = Field(None, max_length=1024)
    tags: list[str] | None = None
    sort_order: int | None = Field(None, ge=0)
    is_active: bool | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None


@router.get("")
async def list_activities(
    download: int = Query(default=0, ge=0, le=1),
    admin_account=Depends(get_admin_account_optional),
    svc: ActivityService = Depends(get_activity_service),
):
    data = await svc.list_activities(active_only=False)
    if download:
        if admin_account is None:
            from app.core.exceptions import UnauthorizedError
            raise UnauthorizedError("Admin required")
        perms = set(admin_account.permissions or [])
        if "*" not in perms and "activities:list" not in perms:
            from app.core.exceptions import ForbiddenError
            raise ForbiddenError("Missing permission: activities:list")
        return csv_response(
            data,
            [
                ("ID", "id"),
                ("Title", "title"),
                ("Subtitle", "subtitle"),
                ("Image URL", "image_url"),
                ("Action URL", "action_url"),
                ("Tags", "tags"),
                ("Sort Order", "sort_order"),
                ("Active", "is_active"),
                ("Start At", "start_at"),
                ("End At", "end_at"),
                ("Created At", "created_at"),
            ],
            f"activities_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}.csv",
        )
    return success(data=data)


@router.post("", dependencies=[Depends(require_permission("activities:create"))])
async def create_activity(
    body: ActivityCreateRequest,
    svc: ActivityService = Depends(get_activity_service),
):
    data = await svc.create_activity(body.model_dump())
    return success(data=data)


@router.get("/{activity_id}")
async def get_activity(
    activity_id: int,
    svc: ActivityService = Depends(get_activity_service),
):
    data = await svc.get_activity(activity_id)
    return success(data=data)


@router.patch("/{activity_id}", dependencies=[Depends(require_permission("activities:update"))])
async def update_activity(
    activity_id: int,
    body: ActivityUpdateRequest,
    svc: ActivityService = Depends(get_activity_service),
):
    data = await svc.update_activity(activity_id, body.model_dump(exclude_unset=True))
    return success(data=data)


@router.delete("/{activity_id}", dependencies=[Depends(require_permission("activities:delete"))])
async def delete_activity(
    activity_id: int,
    svc: ActivityService = Depends(get_activity_service),
):
    await svc.delete_activity(activity_id)
    return success()
