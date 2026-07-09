"""User router."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.core.response import success
from app.db.session import get_db
from app.dependencies.auth import (
    get_admin_account_optional,
    get_current_user,
    require_permission,
)
from app.models import Event, Market, Referral, Trade, User
from app.services.user_service import UserService, get_user_service
from app.utils.csv import csv_response

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


@router.get(
    "/{id_or_address}/transactions",
    dependencies=[Depends(require_permission("users:list"))],
)
async def user_transactions(
    id_or_address: str,
    bet_start: str | None = Query(default=None),
    bet_end: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    download: int = Query(default=0, ge=0, le=1),
    db: AsyncSession = Depends(get_db),
):
    """Compatibility endpoint: returns a user's trades shaped like the old user tx rows."""
    user_result = await db.execute(select(User).where(User.address == id_or_address))
    user = user_result.scalar_one_or_none()
    if user is None:
        # Allow numeric id lookup as fallback.
        if id_or_address.isdigit():
            user_result = await db.execute(select(User).where(User.id == int(id_or_address)))
            user = user_result.scalar_one_or_none()
    if user is None:
        raise NotFoundError("user not found")

    stmt = (
        select(Trade, Event, Market)
        .join(Market, Trade.market_id == Market.id)
        .join(Event, Market.event_id == Event.id)
        .where(Trade.user_address == user.address)
    )
    if bet_start:
        stmt = stmt.where(Trade.created_at >= bet_start)
    if bet_end:
        stmt = stmt.where(Trade.created_at <= bet_end)

    total_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = total_result.scalar() or 0

    if download:
        rows_result = await db.execute(stmt.order_by(Trade.created_at.desc()).limit(500))
    else:
        rows_result = await db.execute(
            stmt.order_by(Trade.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
    rows = rows_result.all()

    data = []
    for trade, event, market in rows:
        resolved = event.status in ("resolved", "closed")
        outcome = 0
        if resolved and market.finalized_outcome is not None:
            outcome_map = {"yes": 1, "no": 2, "void": 3}
            outcome = outcome_map.get(market.finalized_outcome, 0)
        data.append(
            {
                "id": trade.id,
                "pm_event_id": event.slug,
                "onchain_event_id": int(event.onchain_event_id) if event.onchain_event_id else None,
                "market_idx": market.market_idx,
                "is_buy": 1 if trade.side == "yes" else 0,
                "amount_base": str(trade.amount),
                "amount_eds": trade.amount / 1e8,
                "event_question": event.title,
                "market_title": market.title,
                "event_resolved": resolved,
                "event_outcome": outcome,
                "block_time": trade.block_time,
                "created_at": trade.created_at.isoformat() if trade.created_at else None,
            }
        )

    if download:
        return csv_response(
            data,
            [
                ("ID", "id"),
                ("Event", "event_question"),
                ("Market", "market_title"),
                ("Side", "is_buy"),
                ("Amount EDS", "amount_eds"),
                ("Outcome", "event_outcome"),
                ("Time", "created_at"),
            ],
            f"user_transactions_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}.csv",
        )

    return success({"data": data, "total": total, "page": page, "limit": limit})


@router.get(
    "/{id_or_address}/trading-stats",
    dependencies=[Depends(require_permission("users:list"))],
)
async def user_trading_stats(
    id_or_address: str,
    download: int = Query(default=0, ge=0, le=1),
    db: AsyncSession = Depends(get_db),
):
    """Compatibility endpoint: per-user trading stats (admin export)."""
    user_result = await db.execute(select(User).where(User.address == id_or_address))
    user = user_result.scalar_one_or_none()
    if user is None and id_or_address.isdigit():
        user_result = await db.execute(select(User).where(User.id == int(id_or_address)))
        user = user_result.scalar_one_or_none()
    if user is None:
        raise NotFoundError("user not found")

    stmt = (
        select(
            func.count(Trade.id).label("bet_count"),
            func.count(func.distinct(Trade.market_id)).label("event_count"),
            func.coalesce(func.sum(Trade.amount), 0).label("total_wagered"),
            func.max(Trade.created_at).label("last_bet_at"),
            func.min(Trade.created_at).label("first_bet_at"),
        )
        .where(Trade.user_address == user.address)
    )
    row_result = await db.execute(stmt)
    row = row_result.one()

    invitee_count_result = await db.execute(
        select(func.count(Referral.id)).where(Referral.inviter_address == user.address)
    )
    invitee_count = invitee_count_result.scalar() or 0

    data = [
        {
            "id": user.id,
            "luffa_id": user.address,
            "address": user.address,
            "nickname": user.nickname,
            "avatar": user.avatar,
            "is_pro": 1 if user.is_pro else 0,
            "bet_count": row.bet_count or 0,
            "event_count": row.event_count or 0,
            "total_wagered_eds": (row.total_wagered or 0) / 1e8,
            "last_bet_at": row.last_bet_at.isoformat() if row.last_bet_at else None,
            "first_bet_at": row.first_bet_at.isoformat() if row.first_bet_at else None,
            "invitee_count": invitee_count,
        }
    ]

    if download:
        return csv_response(
            data,
            [
                ("ID", "id"),
                ("Address", "address"),
                ("Nickname", "nickname"),
                ("Bets", "bet_count"),
                ("Events", "event_count"),
                ("Wagered EDS", "total_wagered_eds"),
                ("Invitees", "invitee_count"),
            ],
            f"user_trading_stats_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}.csv",
        )

    return success({"data": data, "total": 1, "page": 1, "limit": 1})


@router.get(
    "/{id_or_address}/invite-relations",
    dependencies=[Depends(require_permission("users:list"))],
)
async def user_invite_relations(
    id_or_address: str,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Compatibility endpoint: a user's invite code, inviter, and invitees."""
    user_result = await db.execute(select(User).where(User.address == id_or_address))
    user = user_result.scalar_one_or_none()
    if user is None and id_or_address.isdigit():
        user_result = await db.execute(select(User).where(User.id == int(id_or_address)))
        user = user_result.scalar_one_or_none()
    if user is None:
        raise NotFoundError("user not found")

    inviter = None
    if user.inviter_id:
        inviter_result = await db.execute(
            select(User.address, User.nickname).where(User.id == user.inviter_id)
        )
        inviter_row = inviter_result.fetchone()
        if inviter_row:
            inviter = {
                "luffa_id": inviter_row[0],
                "nickname": inviter_row[1] or "",
                "address": inviter_row[0],
            }

    invitees_result = await db.execute(
        select(User.address, User.nickname, User.created_at, User.inviter_bound_at)
        .join(Referral, Referral.invitee_address == User.address)
        .where(Referral.inviter_address == user.address)
        .order_by(User.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    invitees = [
        {
            "luffa_id": r[0],
            "nickname": r[1] or "",
            "address": r[0],
            "created_at": r[2].isoformat() if r[2] else None,
            "bound_at": int(r[3].timestamp()) if r[3] else None,
        }
        for r in invitees_result.fetchall()
    ]

    total_result = await db.execute(
        select(func.count(Referral.id)).where(Referral.inviter_address == user.address)
    )
    total = total_result.scalar() or 0

    return success(
        {
            "my_invite_code": user.invite_code,
            "inviter": inviter,
            "invitees": invitees,
            "total_invitees": total,
        }
    )
