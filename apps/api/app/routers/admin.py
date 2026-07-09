"""Admin router for audit log and privileged market operations."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.core.response import success
from app.dependencies.auth import require_permission
from app.services.admin_audit_service import AdminAuditService, get_admin_audit_service
from app.services.market_service import MarketService, get_market_service

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


class MarketAdminFinalizeRequest(BaseModel):
    signature: str = Field(..., min_length=64, max_length=128)
    outcome: str = Field(..., pattern="^(yes|no|void)$")
    admin_reason: str | None = Field(None, max_length=1000)


@router.post("/markets/{slug}/finalize")
async def admin_finalize_market(
    slug: str,
    body: MarketAdminFinalizeRequest,
    account=Depends(require_permission("markets:finalize")),
    svc: MarketService = Depends(get_market_service),
):
    """Admin force-finalizes a market outcome."""
    data = await svc.admin_finalize_market(
        slug=slug,
        admin_address=account.address,
        outcome=body.outcome,
        signature=body.signature,
        reason=body.admin_reason,
    )
    return success(data=data)


@router.get("/audit")
async def list_admin_audit(
    admin_address: str | None = Query(default=None),
    action: str | None = Query(default=None),
    market_id: int | None = Query(default=None),
    dispute_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    account=Depends(require_permission("admin:audit")),
    svc: AdminAuditService = Depends(get_admin_audit_service),
):
    """List admin audit log entries."""
    data = await svc.list_logs(
        admin_address=admin_address,
        action=action,
        market_id=market_id,
        dispute_id=dispute_id,
        page=page,
        limit=limit,
    )
    return success(data=data)
