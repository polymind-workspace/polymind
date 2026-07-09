"""Tag router."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.response import success
from app.dependencies.auth import require_permission
from app.services.tag_service import TagService, get_tag_service

router = APIRouter(prefix="/api/v1/tags", tags=["tags"])


class TagCreateRequest(BaseModel):
    slug: str = Field(..., min_length=1, max_length=64, pattern=r"^[a-z0-9_-]+$")
    name: str = Field(..., min_length=1, max_length=128)
    sort_order: int = Field(default=0, ge=0)
    is_active: bool = True
    is_pinned: bool = False


class TagUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=128)
    sort_order: int | None = Field(None, ge=0)
    is_active: bool | None = None
    is_pinned: bool | None = None


@router.get("")
async def list_tags(
    svc: TagService = Depends(get_tag_service),
):
    # Public endpoint shows only active tags; admins can request all via a future flag.
    data = await svc.list_tags(active_only=True)
    return success(data=data)


@router.post("", dependencies=[Depends(require_permission("tags:create"))])
async def create_tag(
    body: TagCreateRequest,
    svc: TagService = Depends(get_tag_service),
):
    data = await svc.create_tag(
        slug=body.slug,
        name=body.name,
        sort_order=body.sort_order,
        is_active=body.is_active,
        is_pinned=body.is_pinned,
    )
    return success(data=data)


@router.patch("/{slug}", dependencies=[Depends(require_permission("tags:update"))])
async def update_tag(
    slug: str,
    body: TagUpdateRequest,
    svc: TagService = Depends(get_tag_service),
):
    data = await svc.update_tag(slug, body.model_dump(exclude_unset=True))
    return success(data=data)


@router.delete("/{slug}", dependencies=[Depends(require_permission("tags:delete"))])
async def delete_tag(
    slug: str,
    svc: TagService = Depends(get_tag_service),
):
    await svc.delete_tag(slug)
    return success()
