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
public_config_router = APIRouter(prefix="/api/v1/config", tags=["config"])


class ConfigUpdateRequest(BaseModel):
    value: Any | None = None
    memo: str | None = Field(None, max_length=512)
    is_public: bool | None = None


@public_config_router.get("")
async def get_public_config(
    svc: ConfigService = Depends(get_config_service),
):
    """Return all public configuration values as a flat dict."""
    configs = await svc.list_configs(public_only=True)
    return success(data={c["key"]: c["value"] for c in configs})


@public_config_router.get("/runtime")
async def get_runtime_config(
    admin_account=Depends(get_admin_account_optional),
    svc: ConfigService = Depends(get_config_service),
):
    """Return configuration as a flat dict for legacy admin UI compatibility."""
    is_admin = admin_account is not None
    configs = await svc.list_configs(public_only=not is_admin)
    flat = {c["key"]: c["value"] for c in configs}

    # Map new config keys to legacy field names used by the admin frontend.
    legacy = {
        "creator_seed_min": 0,
        "creator_propose_timeout_secs": flat.get("creator_propose_timeout_seconds", 259_200),
        "dispute_window_secs": flat.get("dispute_window_seconds", 86_400),
        "admin_timeout_secs": flat.get("admin_timeout_seconds", 604_800),
        "platform_fee_bps": flat.get("platform_fee_bps", 0),
        "platform_fee_max": flat.get("platform_fee_max", 0),
        "creator_reward_bps": flat.get("creator_reward_bps", 0),
        "creator_reward_max": flat.get("creator_reward_max", 0),
        "expired_propose_mode": flat.get("expired_propose_mode", 0),
        "single_side_only": flat.get("single_side_only", False),
        "min_bet": flat.get("min_bet_micro_usdc", 0),
        "dispute_bond_amount": flat.get("dispute_bond_micro_usdc", 0),
        "sponsor_flags": flat.get("sponsor_flags", {}),
        "sponsor_file_dispute": flat.get("sponsor_file_dispute", False),
    }
    # Any other config keys (e.g., referral settings) are included as-is.
    return success(data={**flat, **legacy})


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
