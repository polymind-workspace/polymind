"""User router."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.core.exceptions import NotFoundError
from app.core.response import success
from app.dependencies.auth import (
    get_admin_account_optional,
    get_current_user,
    require_permission,
)
from app.models import User
from app.services.user_service import UserService, get_user_service

router = APIRouter(prefix="/api/v1/users", tags=["users"])


class UserUpdateRequest(BaseModel):
    nickname: str | None = Field(None, max_length=64)
    avatar: str | None = Field(None, max_length=512)
    is_admin: bool | None = None
    is_pro: bool | None = None
    pro_expires_at: str | None = None


@router.get("", dependencies=[Depends(require_permission("users:list"))])
async def list_users(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=24, ge=1, le=100),
    svc: UserService = Depends(get_user_service),
):
    data = await svc.list_users(search=search, page=page, limit=limit)
    return success(data=data)


@router.get("/{id_or_address}")
async def get_user(
    id_or_address: str,
    current_user: User | None = Depends(get_current_user),
    admin_account=Depends(get_admin_account_optional),
    svc: UserService = Depends(get_user_service),
):
    is_admin = admin_account is not None
    data = await svc.get_user(
        id_or_address,
        current_user=current_user,
        is_admin=is_admin,
    )
    if not data:
        raise NotFoundError("user not found")
    return success(data=data)


@router.patch("/{id_or_address}", dependencies=[Depends(require_permission("users:update"))])
async def update_user(
    id_or_address: str,
    body: UserUpdateRequest,
    svc: UserService = Depends(get_user_service),
):
    data = await svc.update_user(id_or_address, body.model_dump(exclude_unset=True))
    return success(data=data)
