"""Campaign / Champion admin compatibility router."""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.response import success
from app.db.session import get_db
from app.dependencies.auth import require_permission
from app.models.campaign_meta import CampaignMeta
from app.models.chain_event_log import ChainEventLog
from app.utils.csv import csv_response

router = APIRouter(prefix="/api/v1/campaigns", tags=["campaigns"])

MODULE = "champion"
EDS = 100_000_000
H5_BASE = os.getenv("CHAMPION_H5_BASE", "https://polymind-h5.yournpc.ai/campaign.html")
API_PUBLIC_BASE = os.getenv("CHAMPION_API_BASE", "").rstrip("/")
LANGS = ("en", "zh")


def _pl(row: ChainEventLog) -> dict[str, Any]:
    return row.payload or {}


async def _onchain_summary(db: AsyncSession, cid: str) -> dict[str, Any]:
    created = (
        await db.execute(
            select(ChainEventLog).where(
                ChainEventLog.module == MODULE,
                ChainEventLog.subject == cid,
                ChainEventLog.kind == "CampaignCreated",
            )
        )
    ).scalar_one_or_none()
    updated = (
        await db.execute(
            select(ChainEventLog)
            .where(
                ChainEventLog.module == MODULE,
                ChainEventLog.subject == cid,
                ChainEventLog.kind == "CampaignUpdated",
            )
            .order_by(ChainEventLog.id.desc())
        )
    ).scalar_one_or_none()
    fin = (
        await db.execute(
            select(ChainEventLog).where(
                ChainEventLog.module == MODULE,
                ChainEventLog.subject == cid,
                ChainEventLog.kind == "CampaignFinalized",
            )
        )
    ).scalar_one_or_none()
    cancel = (
        await db.execute(
            select(ChainEventLog).where(
                ChainEventLog.module == MODULE,
                ChainEventLog.subject == cid,
                ChainEventLog.kind == "CampaignCancelled",
            )
        )
    ).scalar_one_or_none()

    total_result = await db.execute(
        select(func.sum(ChainEventLog.payload["amount"].as_string().cast(func.BigInteger)))
        .where(
            ChainEventLog.module == MODULE,
            ChainEventLog.subject == cid,
            ChainEventLog.kind == "BetPlaced",
        )
    )
    total = total_result.scalar() or 0

    participants_result = await db.execute(
        select(func.count(func.distinct(ChainEventLog.actor)))
        .where(
            ChainEventLog.module == MODULE,
            ChainEventLog.subject == cid,
            ChainEventLog.kind == "BetPlaced",
        )
    )
    participants = participants_result.scalar() or 0

    cp = _pl(created) if created else {}
    cur = _pl(updated) if updated else cp
    option_count = int(cp.get("option_count") or 0)
    status = (
        "settled" if fin else "cancelled" if cancel else "betting" if created else "draft"
    )
    created_ts = 0
    if created:
        created_ts = int(created.block_time or 0)
    return {
        "has_onchain": created is not None,
        "created_ts": created_ts,
        "status": status,
        "option_count": option_count,
        "participants": int(participants),
        "total_stake_eds": round(int(total) / EDS, 2),
        "has_bets": int(total) > 0,
        "question": str(cur.get("question") or ""),
        "start_time": int(cur.get("start_time") or 0),
        "end_time": int(cur.get("end_time") or 0),
        "min_bet_eds": round(int(cur.get("min_bet") or 0) / EDS, 4),
    }


def _meta_to_dict(m: CampaignMeta) -> dict[str, Any]:
    labels: list[str] = []
    if m.option_labels:
        try:
            labels = json.loads(m.option_labels)
        except Exception:
            labels = []
    return {
        "lang": m.lang,
        "title": m.title or "",
        "description": m.description or "",
        "window_label": m.window_label or "",
        "pick_label": m.pick_label or "",
        "option_labels": labels if isinstance(labels, list) else [],
    }


def _share_urls(cid: str) -> dict[str, str]:
    tail = f"&api_base={quote(API_PUBLIC_BASE, safe='')}" if API_PUBLIC_BASE else ""
    return {lang: f"{H5_BASE}?cid={cid}&lang={lang}{tail}" for lang in LANGS}


async def _labels(db: AsyncSession, cid: str) -> list[str]:
    for lang in ("en", "zh"):
        result = await db.execute(
            select(CampaignMeta.option_labels).where(
                CampaignMeta.campaign_id == cid, CampaignMeta.lang == lang
            )
        )
        raw = result.scalar_one_or_none()
        if raw:
            try:
                v = json.loads(raw)
                if isinstance(v, list) and v:
                    return v
            except Exception:
                pass
    return []


@router.get("", dependencies=[Depends(require_permission("events:list"))])
async def list_campaigns(
    include_hidden: int = Query(default=0, ge=0, le=1),
    db: AsyncSession = Depends(get_db),
):
    subjects_result = await db.execute(
        select(ChainEventLog.subject)
        .where(ChainEventLog.module == MODULE, ChainEventLog.subject.isnot(None))
        .distinct()
    )
    subjects = {r for r in subjects_result.scalars().all() if r}

    meta_ids_result = await db.execute(select(CampaignMeta.campaign_id).distinct())
    subjects |= {r for r in meta_ids_result.scalars().all() if r}

    items = []
    for cid in sorted(subjects):
        metas_result = await db.execute(
            select(CampaignMeta).where(CampaignMeta.campaign_id == cid)
        )
        metas = metas_result.scalars().all()
        by_lang = {m.lang: m for m in metas}
        hidden = any(bool(m.hidden) for m in metas)
        if hidden and not include_hidden:
            continue
        summary = await _onchain_summary(db, cid)
        title = ""
        for lang in ("en", "zh"):
            if lang in by_lang and by_lang[lang].title:
                title = by_lang[lang].title
                break
        created_ts = summary.get("created_ts") or 0
        if not created_ts:
            created_ts = max(
                (int(m.created_at.timestamp()) for m in metas if m.created_at),
                default=0,
            )
        items.append(
            {
                "campaign_id": cid,
                "title": title,
                "langs": sorted(by_lang.keys()),
                "hidden": hidden,
                "options": await _labels(db, cid),
                **summary,
                "created_ts": created_ts,
                "h5_base": H5_BASE,
                "share_urls": _share_urls(cid),
            }
        )
    items.sort(key=lambda it: it.get("created_ts") or 0, reverse=True)
    return success({"data": items, "total": len(items), "h5_base": H5_BASE})


@router.get("/is-admin")
async def champion_is_admin(addr: str = Query(..., min_length=4)):
    # Solana champion admin check is not wired yet; default to false.
    return success({"is_admin": False, "warning": "Solana champion admin check is not wired yet."})


@router.get("/admins")
async def champion_admins():
    # Solana champion admin list is not wired yet; default to empty.
    return success([])


@router.get("/{cid}", dependencies=[Depends(require_permission("events:list"))])
async def get_campaign(cid: str = Path(..., min_length=1), db: AsyncSession = Depends(get_db)):
    metas_result = await db.execute(
        select(CampaignMeta).where(CampaignMeta.campaign_id == cid)
    )
    metas = metas_result.scalars().all()
    meta_by_lang = {m.lang: _meta_to_dict(m) for m in metas}
    return success(
        {
            "campaign_id": cid,
            "meta": meta_by_lang,
            "onchain": await _onchain_summary(db, cid),
            "h5_base": H5_BASE,
            "share_urls": _share_urls(cid),
        }
    )


@router.get("/{cid}/bets", dependencies=[Depends(require_permission("events:list"))])
async def list_campaign_bets(
    cid: str = Path(..., min_length=1),
    q: str | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=500),
    download: int = Query(default=0, ge=0, le=1),
    db: AsyncSession = Depends(get_db),
):
    labels = await _labels(db, cid)
    stmt = select(ChainEventLog).where(
        ChainEventLog.module == MODULE,
        ChainEventLog.subject == cid,
        ChainEventLog.kind == "BetPlaced",
    )
    if q:
        stmt = stmt.where(ChainEventLog.actor.ilike(f"%{q.strip()}%"))

    total_result = await db.execute(
        select(func.count()).select_from(stmt.subquery())
    )
    total = total_result.scalar() or 0

    stmt = stmt.order_by(ChainEventLog.id.desc())
    if download:
        rows_result = await db.execute(stmt.limit(5000))
    else:
        rows_result = await db.execute(stmt.offset((page - 1) * limit).limit(limit))
    rows = rows_result.scalars().all()

    items = []
    for r in rows:
        p = _pl(r)
        i = p.get("option_idx") if isinstance(p, dict) else None
        if i is None:
            i = r.event_index if r.event_index is not None else -1
        items.append(
            {
                "id": int(r.id),
                "user": r.actor or "",
                "name": p.get("name") if isinstance(p, dict) else "",
                "option_idx": i,
                "team": (
                    labels[i]
                    if isinstance(i, int) and 0 <= i < len(labels)
                    else f"Option {i + 1}"
                ),
                "amount_eds": (
                    round(int(p.get("amount") or 0) / EDS, 4) if isinstance(p, dict) else 0
                ),
                "ts": int(r.block_time or 0),
                "tx_version": r.signature,
            }
        )

    if download:
        return csv_response(
            items,
            [
                ("User", "user"),
                ("Name", "name"),
                ("Team", "team"),
                ("Amount EDS", "amount_eds"),
                ("Time", "ts"),
                ("Tx", "tx_version"),
            ],
            f"champion_bets_{cid}.csv",
        )

    participants_result = await db.execute(
        select(func.count(func.distinct(ChainEventLog.actor)))
        .where(
            ChainEventLog.module == MODULE,
            ChainEventLog.subject == cid,
            ChainEventLog.kind == "BetPlaced",
        )
    )
    participants = participants_result.scalar() or 0
    return success(
        {
            "data": items,
            "total": total,
            "page": page,
            "limit": limit,
            "participants": int(participants),
        }
    )


class MetaLangPayload(BaseModel):
    title: str | None = None
    description: str | None = None
    window_label: str | None = None
    pick_label: str | None = None
    option_labels: list[str] | None = None


class MetaUpsertRequest(BaseModel):
    langs: dict[str, MetaLangPayload] = Field(..., min_length=1)


@router.put(
    "/{cid}/meta",
    dependencies=[Depends(require_permission("events:update"))],
)
async def upsert_meta(
    body: MetaUpsertRequest,
    cid: str = Path(..., min_length=1),
    db: AsyncSession = Depends(get_db),
):
    for lang, p in body.langs.items():
        if lang not in LANGS:
            raise HTTPException(400, f"Unsupported lang: {lang}")
        result = await db.execute(
            select(CampaignMeta).where(
                CampaignMeta.campaign_id == cid, CampaignMeta.lang == lang
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            row = CampaignMeta(
                campaign_id=cid,
                lang=lang,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            db.add(row)
        row.title = p.title
        row.description = p.description
        row.window_label = p.window_label
        row.pick_label = p.pick_label
        row.option_labels = (
            json.dumps(p.option_labels, ensure_ascii=False)
            if p.option_labels is not None
            else None
        )
        row.updated_at = datetime.now(UTC)
    await db.commit()
    metas_result = await db.execute(
        select(CampaignMeta).where(CampaignMeta.campaign_id == cid)
    )
    metas = metas_result.scalars().all()
    return success(
        {
            "campaign_id": cid,
            "meta": {m.lang: _meta_to_dict(m) for m in metas},
            "share_urls": _share_urls(cid),
        }
    )


class HiddenRequest(BaseModel):
    hidden: bool


@router.post(
    "/{cid}/hidden",
    dependencies=[Depends(require_permission("events:update"))],
)
async def set_hidden(
    body: HiddenRequest,
    cid: str = Path(..., min_length=1),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CampaignMeta).where(CampaignMeta.campaign_id == cid)
    )
    rows = result.scalars().all()
    if not rows:
        row = CampaignMeta(
            campaign_id=cid,
            lang="en",
            hidden=False,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        db.add(row)
        rows = [row]
    for r in rows:
        r.hidden = body.hidden
        r.updated_at = datetime.now(UTC)
    await db.commit()
    return success({"campaign_id": cid, "hidden": body.hidden})


@router.delete(
    "/{cid}",
    dependencies=[Depends(require_permission("events:delete"))],
)
async def delete_campaign_meta(
    cid: str = Path(..., min_length=1),
    db: AsyncSession = Depends(get_db),
):
    summary = await _onchain_summary(db, cid)
    if summary.get("has_onchain"):
        raise HTTPException(
            400,
            "On-chain campaign cannot be deleted; cancel or hide it instead",
        )
    result = await db.execute(
        select(CampaignMeta).where(CampaignMeta.campaign_id == cid)
    )
    rows = result.scalars().all()
    for r in rows:
        await db.delete(r)
    await db.commit()
    return success({"deleted_rows": len(rows)})
