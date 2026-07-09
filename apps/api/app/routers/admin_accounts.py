"""Admin account router."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.response import success
from app.dependencies.auth import require_permission
from app.services.admin_account_service import (
    AdminAccountService,
    get_admin_account_service,
)

router = APIRouter(prefix="/api/v1/admin-accounts", tags=["admin-accounts"])


class AdminAccountCreateRequest(BaseModel):
    address: str = Field(..., min_length=32, max_length=44)
    nickname: str | None = Field(None, max_length=128)
    label: str | None = Field(None, max_length=128)
    permissions: list[str] | None = None


class AdminAccountUpdateRequest(BaseModel):
    nickname: str | None = Field(None, max_length=128)
    label: str | None = Field(None, max_length=128)
    permissions: list[str] | None = None


@router.get("", dependencies=[Depends(require_permission("admin_accounts:list"))])
async def list_admin_accounts(
    svc: AdminAccountService = Depends(get_admin_account_service),
):
    data = await svc.list_accounts()
    return success(data=data)


@router.post("")
async def create_admin_account(
    body: AdminAccountCreateRequest,
    account=Depends(require_permission("admin_accounts:create")),
    svc: AdminAccountService = Depends(get_admin_account_service),
):
    data = await svc.create_account(
        address=body.address,
        added_by=account.address,
        nickname=body.nickname,
        label=body.label,
        permissions=body.permissions,
    )
    return success(data=data)


@router.patch("/{account_id}")
async def update_admin_account(
    account_id: int,
    body: AdminAccountUpdateRequest,
    account=Depends(require_permission("admin_accounts:update")),
    svc: AdminAccountService = Depends(get_admin_account_service),
):
    data = await svc.update_account(
        account_id,
        body.model_dump(exclude_unset=True),
        updated_by=account.address,
    )
    return success(data=data)


@router.delete("/{account_id}", dependencies=[Depends(require_permission("admin_accounts:delete"))])
async def delete_admin_account(
    account_id: int,
    svc: AdminAccountService = Depends(get_admin_account_service),
):
    await svc.delete_account(account_id)
    return success()
