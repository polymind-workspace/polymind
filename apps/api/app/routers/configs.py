"""Config router."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.core.exceptions import ForbiddenError, NotFoundError, UnauthorizedError
from app.core.response import success
from app.dependencies.auth import get_admin_account_optional
from app.services.config_service import ConfigService, get_config_service

router = APIRouter(prefix="/api/v1/configs", tags=["configs"])


class ConfigUpdateRequest(BaseModel):
    value: Any | None = None
    memo: str | None = Field(None, max_length=512)
    is_public: bool | None = None


@router.get("")
async def list_configs(
    admin_view: bool = Query(default=False),
    admin_account=Depends(get_admin_account_optional),
    svc: ConfigService = Depends(get_config_service),
):
    is_admin = admin_account is not None
    if admin_view and not is_admin:
        raise UnauthorizedError("Admin required")

    perms = set(admin_account.permissions or []) if admin_account else set()
    can_list_all = is_admin and ("*" in perms or "configs:list" in perms)

    data = await svc.list_configs(public_only=not can_list_all)
    return success(data=data)


@router.get("/{key}")
async def get_config(
    key: str,
    admin_account=Depends(get_admin_account_optional),
    svc: ConfigService = Depends(get_config_service),
):
    perms = set(admin_account.permissions or []) if admin_account else set()
    can_read_all = admin_account is not None and (
        "*" in perms or "configs:list" in perms
    )

    data = await svc.get_config(key, public_only=not can_read_all)
    if not data:
        raise NotFoundError("config not found")
    return success(data=data)


@router.patch("/{key}")
async def update_config(
    key: str,
    body: ConfigUpdateRequest,
    admin_account=Depends(get_admin_account_optional),
    svc: ConfigService = Depends(get_config_service),
):
    if admin_account is None:
        raise UnauthorizedError("Admin required")
    perms = set(admin_account.permissions or [])
    if "*" not in perms and "configs:update" not in perms:
        raise ForbiddenError("Missing permission: configs:update")

    data = await svc.update_config(key, body.model_dump(exclude_unset=True))
    return success(data=data)
