"""Market router."""

from __future__ import annotations

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
from app.services.market_service import MarketService, get_market_service

router = APIRouter(prefix="/api/v1/markets", tags=["markets"])


class MarketProposeRequest(BaseModel):
    signature: str = Field(..., min_length=64, max_length=128)
    outcome: str = Field(..., pattern="^(yes|no|void)$")


class MarketFinalizeRequest(BaseModel):
    signature: str = Field(..., min_length=64, max_length=128)


class MarketVoidRequest(BaseModel):
    signature: str = Field(..., min_length=64, max_length=128)
    reason: str | None = Field(None, max_length=512)


class MarketUpdateRequest(BaseModel):
    title: str | None = Field(None, max_length=512)
    label_yes: str | None = Field(None, max_length=128)
    label_no: str | None = Field(None, max_length=128)
    status: str | None = Field(
        None,
        pattern="^(open|awaiting_proposal|proposed|disputed|finalized|void)$",
    )
    is_flagged: bool | None = None
    can_bet: bool | None = None
    deadline: str | None = None


@router.get("")
async def list_markets(
    category: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    source: str | None = Query(default=None),
    sort: str = Query(default="created_at"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=24, ge=1, le=100),
    admin_view: bool = Query(default=False),
    admin_account=Depends(get_admin_account_optional),
    svc: MarketService = Depends(get_market_service),
):
    if admin_view:
        if admin_account is None:
            raise UnauthorizedError("Admin required")
        perms = set(admin_account.permissions or [])
        if "*" not in perms and "markets:list" not in perms:
            raise ForbiddenError("Missing permission: markets:list")

    data = await svc.list_markets(
        category=category,
        tag=tag,
        search=search,
        status=status,
        source=source,
        sort=sort,
        page=page,
        limit=limit,
        is_admin=admin_view and admin_account is not None,
    )
    return success(data=data)


@router.get("/{slug}")
async def get_market(
    slug: str,
    svc: MarketService = Depends(get_market_service),
):
    data = await svc.get_market_by_slug(slug)
    if not data:
        raise NotFoundError("market not found")
    return success(data=data)


@router.get("/{slug}/config")
async def get_market_config(
    slug: str,
    svc: MarketService = Depends(get_market_service),
):
    data = await svc.get_market_config(slug)
    if not data:
        raise NotFoundError("market not found")
    return success(data=data)


@router.post("/{slug}/propose")
async def propose_outcome(
    slug: str,
    body: MarketProposeRequest,
    user: User = Depends(get_current_user),
    svc: MarketService = Depends(get_market_service),
):
    data = await svc.propose_outcome(
        slug=slug,
        user_address=user.address,
        outcome=body.outcome,
        signature=body.signature,
    )
    return success(data=data)


@router.post("/{slug}/finalize")
async def finalize_market(
    slug: str,
    body: MarketFinalizeRequest,
    svc: MarketService = Depends(get_market_service),
):
    data = await svc.finalize_market(slug, body.signature)
    return success(data=data)


@router.post("/{slug}/void")
async def void_market(
    slug: str,
    body: MarketVoidRequest,
    account=Depends(require_permission("markets:void")),
    svc: MarketService = Depends(get_market_service),
):
    data = await svc.void_market(
        slug=slug,
        admin_address=account.address,
        signature=body.signature,
        reason=body.reason,
    )
    return success(data=data)


@router.patch("/{slug}")
async def update_market(
    slug: str,
    body: MarketUpdateRequest,
    account=Depends(require_permission("markets:update")),
    svc: MarketService = Depends(get_market_service),
):
    data = await svc.update_market(slug, body.model_dump(exclude_unset=True))
    return success(data=data)
