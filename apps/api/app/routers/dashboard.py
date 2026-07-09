"""Dashboard router."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query

from app.core.response import success
from app.dependencies.auth import require_permission
from app.services.dashboard_service import DashboardService, get_dashboard_service

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


@router.get("/overview", dependencies=[Depends(require_permission("dashboard:read"))])
async def dashboard_overview(
    svc: DashboardService = Depends(get_dashboard_service),
):
    data = await svc.overview()
    return success(data=data)


@router.get("/trend", dependencies=[Depends(require_permission("dashboard:read"))])
async def dashboard_trend(
    days: int = Query(default=30, ge=1, le=365),
    end_date: date | None = Query(default=None),
    svc: DashboardService = Depends(get_dashboard_service),
):
    data = await svc.trend(days=days, end_date=end_date)
    return success(data=data)
