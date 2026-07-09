"""Admin event compatibility router (legacy Endless adminevent → Solana Event)."""

from __future__ import annotations

import os
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.response import success
from app.db.session import get_db
from app.dependencies.auth import require_permission
from app.models.admin_event_admin import AdminEventAdmin
from app.models.event import Event
from app.utils.csv import csv_response
from app.utils.slugify import unique_event_slug

router = APIRouter(prefix="/api/v1/admin-events", tags=["admin-events"])

_H5_BASE_URL = os.getenv("H5_BASE_URL", "https://polymind-h5.yournpc.ai").rstrip("/")


def _h5_url(slug: str) -> str:
    return f"{_H5_BASE_URL}/{slug}.html"


def _serialize_admin_event(e: Event) -> dict:
    now_sec = int(datetime.now(UTC).timestamp())
    ended = bool(e.deadline and int(e.deadline.timestamp()) < now_sec)
    return {
        "slug": e.slug,
        "question": e.title or "",
        "answers": e.rules.split("\n") if e.rules else [],
        "end_time": int(e.deadline.timestamp()) if e.deadline else 0,
        "ended": ended,
        "status": e.status or "open",
        "h5_url": e.image_url or _h5_url(e.slug),
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


@router.get("/is-admin")
async def check_is_admin(addr: str = Query(..., description="Address in any format"), db: AsyncSession = Depends(get_db)):
    addr = (addr or "").strip()
    if not addr:
        return success({"is_admin": False})
    result = await db.execute(
        select(func.count()).select_from(AdminEventAdmin).where(AdminEventAdmin.address == addr)
    )
    is_admin = bool(result.scalar() or 0)
    return success({"is_admin": is_admin})


@router.get("/admins", dependencies=[Depends(require_permission("admin_accounts:list"))])
async def list_adminevent_admins(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AdminEventAdmin.address).order_by(AdminEventAdmin.created_at.asc())
    )
    return success(result.scalars().all())


class _AdminReq(BaseModel):
    addr: str


@router.post("/admins", dependencies=[Depends(require_permission("admin_accounts:create"))])
async def add_adminevent_admin_db(req: _AdminReq, db: AsyncSession = Depends(get_db)):
    addr = (req.addr or "").strip()
    if not addr:
        raise HTTPException(400, "addr required")
    existing = await db.execute(
        select(AdminEventAdmin).where(AdminEventAdmin.address == addr)
    )
    if not existing.scalar_one_or_none():
        db.add(AdminEventAdmin(address=addr))
        await db.commit()
    return success({"addr": addr})


@router.delete(
    "/admins/{addr:path}",
    dependencies=[Depends(require_permission("admin_accounts:delete"))],
)
async def remove_adminevent_admin_db(addr: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AdminEventAdmin).where(AdminEventAdmin.address == addr)
    )
    rec = result.scalar_one_or_none()
    if rec:
        await db.delete(rec)
        await db.commit()
    return success({"addr": addr})


class _CreateReq(BaseModel):
    tx_hash: str
    question: str
    answers: list[str]
    start_time: int
    end_time: int
    min_bet_eds: float = 0.0
    prize_eds: float = 1.0
    slug: str | None = None


@router.post("", dependencies=[Depends(require_permission("events:create"))])
async def create_admin_event(req: _CreateReq, db: AsyncSession = Depends(get_db)):
    if not req.question.strip():
        raise HTTPException(400, "question is required")
    if len(req.answers) < 2:
        raise HTTPException(400, "at least 2 answers required")

    answer_texts = [a.strip() for a in req.answers if a.strip()]
    slug = (req.slug or "").strip() or None
    if slug:
        existing = await db.execute(select(Event).where(Event.slug == slug))
        if existing.scalar_one_or_none():
            raise HTTPException(400, f"slug '{slug}' already exists")
    else:
        slug = await unique_event_slug(req.question, db)

    h5_url = _h5_url(slug)
    ev = Event(
        slug=slug,
        title=req.question,
        description=req.question,
        rules="\n".join(answer_texts),
        deadline=datetime.fromtimestamp(req.end_time, UTC),
        image_url=h5_url,
        pinned=True,
        source="admin",
        status="open",
        is_trending=True,
    )
    db.add(ev)
    await db.commit()
    return success({"slug": slug, "h5_url": h5_url, "tx_hash": req.tx_hash})


@router.get("", dependencies=[Depends(require_permission("events:list"))])
async def list_admin_events(
    page: int = 1,
    limit: int = 50,
    download: int = Query(default=0, ge=0, le=1),
    db: AsyncSession = Depends(get_db),
):
    page = max(1, page)
    limit = max(1, min(100, limit))
    stmt = select(Event).where(Event.pinned.is_(True), Event.source == "admin")
    total_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = total_result.scalar() or 0

    if download:
        rows_result = await db.execute(stmt.order_by(Event.created_at.desc()).limit(500))
    else:
        rows_result = await db.execute(
            stmt.order_by(Event.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
    rows = rows_result.scalars().all()
    items = [_serialize_admin_event(r) for r in rows]

    if download:
        return csv_response(
            items,
            [
                ("Slug", "slug"),
                ("Question", "question"),
                ("Answers", "answers"),
                ("End Time", "end_time"),
                ("Ended", "ended"),
                ("Status", "status"),
                ("H5 URL", "h5_url"),
                ("Created At", "created_at"),
            ],
            f"admin_events_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}.csv",
        )

    return success({"data": items, "total": total})


@router.get("/{slug}/stats", dependencies=[Depends(require_permission("events:list"))])
async def get_admin_event_stats(slug: str, db: AsyncSession = Depends(get_db)):
    # Solana adminevent stats are not wired yet; return zeros.
    return success(
        {
            "participant_count": 0,
            "collected_bets": 0,
            "min_bet_amount": 0,
        }
    )


class _FinalizeReq(BaseModel):
    tx_hash: str
    correct_answer: str


@router.post(
    "/{slug}/finalize",
    dependencies=[Depends(require_permission("events:update"))],
)
async def finalize_admin_event(
    slug: str,
    req: _FinalizeReq,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Event).where(Event.slug == slug))
    ev = result.scalar_one_or_none()
    if not ev:
        raise HTTPException(404, "event not found")
    if ev.status == "resolved":
        raise HTTPException(400, "event already resolved")

    answers = ev.rules.split("\n") if ev.rules else []
    if req.correct_answer not in answers:
        raise HTTPException(
            400,
            f"'{req.correct_answer}' is not a valid answer for this event",
        )

    ev.status = "resolved"
    ev.updated_at = datetime.now(UTC)
    await db.commit()
    return success(
        {
            "slug": slug,
            "correct_answer": req.correct_answer,
            "tx_hash": req.tx_hash,
        }
    )
