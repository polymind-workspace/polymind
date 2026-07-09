"""Media router."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Query, UploadFile

from app.core.response import success
from app.dependencies.auth import get_current_user, require_permission
from app.models import User
from app.services.media_service import MediaService, get_media_service

router = APIRouter(prefix="/api/v1/media", tags=["media"])


@router.get("", dependencies=[Depends(require_permission("media:list"))])
async def list_media(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=24, ge=1, le=100),
    svc: MediaService = Depends(get_media_service),
):
    data = await svc.list_media(page=page, limit=limit)
    return success(data=data)


@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    svc: MediaService = Depends(get_media_service),
):
    data = await svc.upload_image(file=file, uploader_address=user.address)
    return success(data=data)


@router.delete("/{media_id}", dependencies=[Depends(require_permission("media:delete"))])
async def delete_media(
    media_id: int,
    svc: MediaService = Depends(get_media_service),
):
    await svc.delete_media(media_id)
    return success()
