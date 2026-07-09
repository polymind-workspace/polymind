"""Dashboard router."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query

from app.core.response import success
from app.dependencies.auth import require_permission
from app.services.dashboard_service import DashboardService, get_dashboard_service
from app.utils.csv import csv_response

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


@router.get("/overview", dependencies=[Depends(require_permission("dashboard:read"))])
async def dashboard_overview(
    svc: DashboardService = Depends(get_dashboard_service),
):
    data = await svc.overview()
    return success(data=data)


@router.get("/cards", dependencies=[Depends(require_permission("dashboard:read"))])
async def dashboard_cards(
    svc: DashboardService = Depends(get_dashboard_service),
):
    data = await svc.cards()
    return success(data=data)


@router.get("/trend", dependencies=[Depends(require_permission("dashboard:read"))])
async def dashboard_trend(
    days: int = Query(default=30, ge=1, le=365),
    end_date: date | None = Query(default=None),
    svc: DashboardService = Depends(get_dashboard_service),
):
    data = await svc.trend(days=days, end_date=end_date)
    return success(data=data)


@router.get(
    "/trend/export",
    dependencies=[Depends(require_permission("dashboard:read"))],
)
async def dashboard_trend_export(
    days: int = Query(default=30, ge=1, le=365),
    end_date: date | None = Query(default=None),
    svc: DashboardService = Depends(get_dashboard_service),
):
    rows = await svc.export_trend(days=days, end_date=end_date)
    return csv_response(
        rows,
        [
            ("Date", "date"),
            ("New Users", "new_users"),
            ("New Markets", "new_markets"),
            ("Bet Amount", "bet_amount"),
            ("Claim Amount", "claim_amount"),
        ],
        f"dashboard_trend_{date.today().isoformat()}.csv",
    )


@router.get("/users", dependencies=[Depends(require_permission("dashboard:read"))])
async def dashboard_user_stats(
    svc: DashboardService = Depends(get_dashboard_service),
):
    data = await svc.user_stats()
    return success(data=data)


@router.get("/bets", dependencies=[Depends(require_permission("dashboard:read"))])
async def dashboard_bet_stats(
    svc: DashboardService = Depends(get_dashboard_service),
):
    data = await svc.bet_stats()
    return success(data=data)


@router.get("/invites", dependencies=[Depends(require_permission("dashboard:read"))])
async def dashboard_invite_stats(
    svc: DashboardService = Depends(get_dashboard_service),
):
    data = await svc.invite_stats()
    return success(data=data)


@router.get("/top-bets", dependencies=[Depends(require_permission("dashboard:read"))])
async def dashboard_top_bets(
    limit: int = Query(default=10, ge=1, le=100),
    svc: DashboardService = Depends(get_dashboard_service),
):
    data = await svc.top_bets(limit=limit)
    return success(data=data)


@router.get("/top-users", dependencies=[Depends(require_permission("dashboard:read"))])
async def dashboard_top_users(
    limit: int = Query(default=10, ge=1, le=100),
    svc: DashboardService = Depends(get_dashboard_service),
):
    data = await svc.top_users(limit=limit)
    return success(data=data)
