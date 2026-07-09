"""Media image service."""

from __future__ import annotations

import mimetypes
import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import BadRequestError, NotFoundError
from app.db.session import get_db
from app.models import MediaImage

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB


class MediaService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_media(
        self,
        *,
        uploader_address: str | None = None,
        page: int = 1,
        limit: int = 24,
    ) -> dict:
        stmt = select(MediaImage)
        if uploader_address:
            stmt = stmt.where(MediaImage.uploader_address == uploader_address)
        stmt = stmt.order_by(MediaImage.created_at.desc())

        from sqlalchemy import func

        total_result = await self.session.execute(
            select(func.count()).select_from(stmt.subquery())
        )
        total = total_result.scalar() or 0

        stmt = stmt.offset((page - 1) * limit).limit(limit)
        result = await self.session.execute(stmt)
        items = [m.to_dict() for m in result.scalars().all()]

        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "hasMore": page * limit < total,
        }

    async def upload_image(
        self,
        *,
        file: UploadFile,
        uploader_address: str | None = None,
    ) -> dict:
        if file.size and file.size > MAX_UPLOAD_SIZE:
            raise BadRequestError("file too large")

        content_type = file.content_type or "application/octet-stream"
        if not content_type.startswith(("image/", "video/")):
            raise BadRequestError("only image and video uploads are supported")

        upload_dir = Path(settings.upload_dir)
        upload_dir.mkdir(parents=True, exist_ok=True)

        ext = Path(file.filename or "upload").suffix or ".bin"
        filename = f"{uuid4().hex}{ext}"
        dest_path = upload_dir / filename

        with dest_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        mime_type = content_type or mimetypes.guess_type(str(dest_path))[0]
        size = dest_path.stat().st_size

        media = MediaImage(
            filename=file.filename or filename,
            url=f"{settings.upload_url_prefix}/{filename}",
            mime_type=mime_type,
            size=size,
            uploader_address=uploader_address,
        )
        self.session.add(media)
        await self.session.commit()
        await self.session.refresh(media)
        return media.to_dict()

    async def delete_media(self, media_id: int) -> None:
        media = await self._get_media_by_id(media_id)
        if not media:
            raise NotFoundError("media not found")

        # Best-effort filesystem cleanup.
        try:
            upload_dir = Path(settings.upload_dir)
            path = upload_dir / Path(media.url).name
            if path.exists():
                path.unlink()
        except OSError:
            pass

        await self.session.delete(media)
        await self.session.commit()

    async def _get_media_by_id(self, media_id: int) -> MediaImage | None:
        result = await self.session.execute(
            select(MediaImage).where(MediaImage.id == media_id)
        )
        return result.scalar_one_or_none()


def get_media_service(session: AsyncSession = Depends(get_db)) -> MediaService:
    return MediaService(session)
