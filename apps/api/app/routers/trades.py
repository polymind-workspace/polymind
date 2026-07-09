"""Trade router."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.core.exceptions import UnauthorizedError
from app.core.response import success
from app.dependencies.auth import get_admin_account_optional, get_current_user
from app.services.trade_service import TradeService, get_trade_service
from app.utils.csv import csv_response

router = APIRouter(prefix="/api/v1/trades", tags=["trades"])


class TradeSyncRequest(BaseModel):
    signature: str = Field(..., min_length=64, max_length=128)


@router.get("")
async def list_trades(
    market_id: int | None = Query(default=None),
    market_slug: str | None = Query(default=None),
    user_address: str | None = Query(default=None),
    side: str | None = Query(default=None, pattern="^(yes|no)$"),
    download: int = Query(default=0, ge=0, le=1),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=24, ge=1, le=100),
    admin_account=Depends(get_admin_account_optional),
    svc: TradeService = Depends(get_trade_service),
):
    is_admin = admin_account is not None
    if download and not is_admin:
        raise UnauthorizedError("Admin required")

    data = await svc.list_trades(
        market_id=market_id,
        market_slug=market_slug,
        user_address=user_address,
        side=side,
        confirmed_only=not is_admin,
        download=bool(download),
        page=page,
        limit=limit,
    )

    if download:
        return csv_response(
            data["items"],
            [
                ("ID", "id"),
                ("Market ID", "market_id"),
                ("Market Slug", "market_slug"),
                ("Market Title", "market_title"),
                ("User", "user_address"),
                ("Side", "side"),
                ("Amount", "amount"),
                ("Tx Signature", "tx_signature"),
                ("Slot", "slot"),
                ("Block Time", "block_time"),
                ("Created At", "created_at"),
            ],
            f"trades_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}.csv",
        )

    return success(data=data)


@router.post("/sync", dependencies=[Depends(get_current_user)])
async def sync_trade(
    body: TradeSyncRequest,
    svc: TradeService = Depends(get_trade_service),
):
    data = await svc.sync_trade(body.signature)
    return success(data=data)
