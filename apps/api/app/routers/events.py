"""Event router."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.core.exceptions import ForbiddenError, NotFoundError, UnauthorizedError
from app.core.response import success
from app.dependencies.auth import (
    get_admin_account_optional,
    get_current_user,
    require_permission,
)
from app.models import User
from app.services.event_service import get_event_service
from app.utils.csv import csv_response

router = APIRouter(prefix="/api/v1/events", tags=["events"])


class EventDraftRequest(BaseModel):
    title: str = Field(..., max_length=512)
    description: str | None = None
    image_url: str | None = Field(None, max_length=1024)
    rules: str | None = None
    category_id: int | None = None


class EventSyncRequest(BaseModel):
    signature: str = Field(..., min_length=64, max_length=128)


class EventUpdateRequest(BaseModel):
    title: str | None = Field(None, max_length=512)
    description: str | None = None
    image_url: str | None = Field(None, max_length=1024)
    rules: str | None = None
    category_id: int | None = None
    status: str | None = Field(None, pattern="^(draft|open|closed|resolved|void)$")
    is_trending: bool | None = None
    is_flagged: bool | None = None
    can_share: bool | None = None
    can_bet: bool | None = None
    pinned: bool | None = None
    pinned_at: str | None = None
    deadline: str | None = None


@router.get("")
async def list_events(
    category: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    source: str | None = Query(default=None),
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    sort: str = Query(default="created_at"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=24, ge=1, le=100),
    admin_view: bool = Query(default=False),
    download: int = Query(default=0, ge=0, le=1),
    admin_account=Depends(get_admin_account_optional),
    svc=Depends(get_event_service),
):
    if admin_view:
        if admin_account is None:
            raise UnauthorizedError("Admin required")
        perms = set(admin_account.permissions or [])
        if "*" not in perms and "events:list" not in perms:
            raise ForbiddenError("Missing permission: events:list")

    if download:
        if admin_account is None:
            raise UnauthorizedError("Admin required")
        data = await svc.list_events(
            category=category,
            tag=tag,
            source=source,
            status=status,
            search=search,
            sort=sort,
            page=1,
            limit=500,
            is_admin=True,
        )
        rows = data.get("items", [])
        return csv_response(
            rows,
            [
                ("ID", "id"),
                ("Slug", "slug"),
                ("Title", "title"),
                ("Source", "source"),
                ("Status", "status"),
                ("Trending", "is_trending"),
                ("Flagged", "is_flagged"),
                ("Can Share", "can_share"),
                ("Can Bet", "can_bet"),
                ("Pinned", "pinned"),
                ("Volume", "volume"),
                ("Players", "players_count"),
                ("Deadline", "deadline"),
                ("Created At", "created_at"),
            ],
            f"events_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}.csv",
        )

    data = await svc.list_events(
        category=category,
        tag=tag,
        source=source,
        status=status,
        search=search,
        sort=sort,
        page=page,
        limit=limit,
        is_admin=admin_view and admin_account is not None,
    )
    return success(data=data)


@router.get("/{slug}")
async def get_event(
    slug: str,
    svc=Depends(get_event_service),
):
    data = await svc.get_event_by_slug(slug)
    if not data:
        raise NotFoundError("event not found")
    return success(data=data)


@router.post("/draft")
async def create_draft(
    body: EventDraftRequest,
    user: User = Depends(get_current_user),
    svc=Depends(get_event_service),
):
    data = await svc.create_draft(
        user_address=user.address,
        title=body.title,
        description=body.description,
        image_url=body.image_url,
        rules=body.rules,
        category_id=body.category_id,
    )
    return success(data=data)


@router.post("/sync")
async def sync_event(
    body: EventSyncRequest,
    user: User = Depends(get_current_user),
    svc=Depends(get_event_service),
):
    data = await svc.sync_event(body.signature, user.address)
    return success(data=data)


@router.patch("/{slug}")
async def update_event(
    slug: str,
    body: EventUpdateRequest,
    account=Depends(require_permission("events:update")),
    svc=Depends(get_event_service),
):
    data = await svc.update_event(slug, body.model_dump(exclude_unset=True))
    return success(data=data)


@router.delete("/{slug}")
async def delete_event(
    slug: str,
    account=Depends(require_permission("events:delete")),
    svc=Depends(get_event_service),
):
    await svc.delete_event(slug)
    return success()
