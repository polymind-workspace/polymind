"""Invite reward / claim admin compatibility router.

Maps legacy Endless invite_rewards / claim_requests tables onto the new
Solana User/Referral data model.  For MVP the compatibility layer treats
`luffa_id` as the user's Solana address.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.response import success
from app.db.session import get_db
from app.dependencies.auth import require_permission
from app.models.invite import InviteReward
from app.utils.csv import csv_response

logger = logging.getLogger("admin.invite")
router = APIRouter(prefix="/api/v1/invite", tags=["invite"])


def _now() -> datetime:
    return datetime.now(UTC)


@router.get(
    "/pending-summary",
    dependencies=[Depends(require_permission("users:list"))],
)
async def pending_summary(db: AsyncSession = Depends(get_db)):
    rows = await db.execute(
        text("""
            SELECT
              r.inviter_luffa_id,
              COALESCE(SUM(CAST(r.reward_base AS BIGINT)), 0) AS pending_base,
              COUNT(*) AS pending_count,
              MAX(r.created_at) AS last_at,
              u.address AS inviter_address,
              u.nickname AS inviter_nickname
            FROM invite_rewards r
            LEFT JOIN users u ON u.address = r.inviter_luffa_id
            WHERE r.status = 'pending'
            GROUP BY r.inviter_luffa_id, u.address, u.nickname
            ORDER BY pending_base DESC, r.inviter_luffa_id
        """)
    )
    data = [
        {
            "inviter_luffa_id": r[0],
            "pending_base": str(int(r[1] or 0)),
            "pending_count": int(r[2] or 0),
            "last_reward_at": r[3].isoformat() if r[3] else None,
            "inviter_address": r[4] or "",
            "inviter_nickname": r[5] or "",
        }
        for r in rows.fetchall()
    ]
    return success({"data": data, "total": len(data)})


@router.get(
    "/rewards",
    dependencies=[Depends(require_permission("users:list"))],
)
async def list_rewards(
    inviter_luffa_id: str | None = None,
    invitee_luffa_id: str | None = None,
    status: str | None = None,
    page: int = 1,
    limit: int = 100,
    download: int = 0,
    db: AsyncSession = Depends(get_db),
):
    page = max(1, int(page))
    limit = max(1, min(500, int(limit)))
    where = ["1=1"]
    params: dict[str, object] = {}
    if inviter_luffa_id:
        where.append("inviter_luffa_id = :inv")
        params["inv"] = inviter_luffa_id
    if invitee_luffa_id:
        where.append("invitee_luffa_id = :invtee")
        params["invtee"] = invitee_luffa_id
    if status in ("pending", "paid"):
        where.append("status = :st")
        params["st"] = status
    where_sql = " AND ".join(where)

    total_result = await db.execute(
        text(f"SELECT COUNT(*) FROM invite_rewards WHERE {where_sql}"),
        params,
    )
    total = total_result.scalar() or 0

    if download:
        rows = await db.execute(
            text(f"""
                SELECT id, inviter_luffa_id, invitee_luffa_id, invitee_address,
                       onchain_event_id, market_idx, bet_tx_version, bet_tx_index,
                       bet_amount_base, reward_base,
                       status, paid_at, paid_tx_hash, created_at
                FROM invite_rewards
                WHERE {where_sql}
                ORDER BY created_at DESC, id DESC
                LIMIT 500
            """),
            params,
        )
    else:
        params_page = dict(params, offset=(page - 1) * limit, lim=limit)
        rows = await db.execute(
            text(f"""
                SELECT id, inviter_luffa_id, invitee_luffa_id, invitee_address,
                       onchain_event_id, market_idx, bet_tx_version, bet_tx_index,
                       bet_amount_base, reward_base,
                       status, paid_at, paid_tx_hash, created_at
                FROM invite_rewards
                WHERE {where_sql}
                ORDER BY created_at DESC, id DESC
                LIMIT :lim OFFSET :offset
            """),
            params_page,
        )

    data = [
        {
            "id": int(r[0]),
            "inviter_luffa_id": r[1],
            "invitee_luffa_id": r[2],
            "invitee_address": r[3],
            "onchain_event_id": int(r[4] or 0),
            "market_idx": int(r[5] or 0),
            "bet_tx_version": r[6],
            "bet_tx_index": int(r[7] or 0),
            "bet_amount_base": str(r[8] or "0"),
            "reward_base": str(r[9] or "0"),
            "status": r[10],
            "paid_at": r[11].isoformat() if r[11] else None,
            "paid_tx_hash": r[12],
            "created_at": r[13].isoformat() if r[13] else None,
        }
        for r in rows.fetchall()
    ]

    if download:
        return csv_response(
            data,
            [
                ("ID", "id"),
                ("Inviter Luffa ID", "inviter_luffa_id"),
                ("Invitee Luffa ID", "invitee_luffa_id"),
                ("Invitee Address", "invitee_address"),
                ("Onchain Event ID", "onchain_event_id"),
                ("Bet Amount Base", "bet_amount_base"),
                ("Reward Base", "reward_base"),
                ("Status", "status"),
                ("Paid At", "paid_at"),
                ("Created At", "created_at"),
            ],
            f"invite_rewards_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}.csv",
        )

    return success(
        {
            "data": data,
            "total": int(total),
            "page": page,
            "limit": limit,
        }
    )


@router.get("/ops-wallet")
async def ops_wallet_info():
    # Solana operator payout wallet is not wired yet.
    return success(
        {
            "address": "",
            "balance_base": "0",
            "configured": False,
            "warning": "Solana operator payout wallet is not wired yet.",
        }
    )


@router.get("/invitees", dependencies=[Depends(require_permission("users:list"))])
async def list_invitees(
    inviter_luffa_id: str,
    db: AsyncSession = Depends(get_db),
):
    if not inviter_luffa_id:
        raise HTTPException(400, "inviter_luffa_id required")
    rows = await db.execute(
        text("""
            SELECT
              u.address AS luffa_id,
              u.nickname,
              u.avatar,
              u.address,
              u.created_at,
              u.inviter_bound_at,
              COALESCE(SUM(CASE WHEN r.status = 'pending'
                                THEN CAST(r.reward_base AS BIGINT) ELSE 0 END), 0) AS pending_base,
              COALESCE(SUM(CASE WHEN r.status = 'paid'
                                THEN CAST(r.reward_base AS BIGINT) ELSE 0 END), 0) AS paid_base,
              COUNT(r.id) AS reward_count
            FROM referrals ref
            JOIN users u ON u.address = ref.invitee_address
            LEFT JOIN invite_rewards r ON r.invitee_luffa_id = u.address
                                       AND r.inviter_luffa_id = :inv
            WHERE ref.inviter_address = :inv
            GROUP BY u.address, u.nickname, u.avatar,
                     u.created_at, u.inviter_bound_at
            ORDER BY u.inviter_bound_at DESC NULLS LAST, u.address
        """),
        {"inv": inviter_luffa_id},
    )
    data = [
        {
            "luffa_id": r[0],
            "nickname": r[1] or "",
            "avatar": r[2] or "",
            "address": r[3] or "",
            "created_at": r[4].isoformat() if r[4] else None,
            "bound_at": int(r[5]) if r[5] is not None else None,
            "pending_base": str(int(r[6] or 0)),
            "paid_base": str(int(r[7] or 0)),
            "reward_count": int(r[8] or 0),
        }
        for r in rows.fetchall()
    ]
    return success({"data": data, "total": len(data)})


class _MarkPaidReq(BaseModel):
    ids: list[int]
    tx_hash: str | None = None


@router.post("/mark-paid", dependencies=[Depends(require_permission("reward_payouts:create"))])
async def mark_paid(req: _MarkPaidReq, db: AsyncSession = Depends(get_db)):
    if not req.ids:
        raise HTTPException(400, "ids required")
    ids = [int(x) for x in req.ids if int(x) > 0]
    if not ids:
        raise HTTPException(400, "no valid ids")
    tx_hash = (req.tx_hash or "").strip() or None

    snap = await db.execute(
        select(
            InviteReward.id,
            InviteReward.inviter_luffa_id,
            InviteReward.reward_base,
            InviteReward.status,
        )
        .where(InviteReward.id.in_(ids))
    )
    snap_rows = snap.fetchall()
    to_flip = [r for r in snap_rows if r[3] == "pending"]
    if not to_flip:
        return success({"flipped": 0, "skipped": len(snap_rows), "tx_hash": tx_hash})

    flip_ids = [r[0] for r in to_flip]
    now = _now()
    await db.execute(
        text("""
            UPDATE invite_rewards
            SET status = 'paid', paid_at = :now, paid_tx_hash = :tx
            WHERE id = ANY(:ids) AND status = 'pending'
        """),
        {"now": now, "tx": tx_hash, "ids": flip_ids},
    )

    per_inviter: dict[str, int] = {}
    for r in to_flip:
        per_inviter[r[1]] = per_inviter.get(r[1], 0) + int(r[2] or 0)
    for inviter, delta in per_inviter.items():
        await db.execute(
            text("""
                INSERT INTO invite_balances (inviter_luffa_id, pending_base, paid_base)
                VALUES (:uid, :p, :d)
                ON CONFLICT (inviter_luffa_id) DO UPDATE
                SET pending_base = GREATEST(CAST(invite_balances.pending_base AS BIGINT) - :d, 0),
                    paid_base    = CAST(invite_balances.paid_base AS BIGINT) + :d
            """),
            {"uid": inviter, "p": "0", "d": delta},
        )

    await db.commit()
    logger.info(
        "mark_paid: flipped=%s skipped=%s tx_hash=%s",
        len(flip_ids),
        len(snap_rows) - len(flip_ids),
        tx_hash,
    )
    return success(
        {
            "flipped": len(flip_ids),
            "skipped": len(snap_rows) - len(flip_ids),
            "tx_hash": tx_hash,
        }
    )


@router.get("/claims", dependencies=[Depends(require_permission("users:list"))])
async def list_claims(
    status: str | None = None,
    page: int = 1,
    limit: int = 50,
    download: int = 0,
    db: AsyncSession = Depends(get_db),
):
    page = max(1, int(page))
    limit = max(1, min(200, int(limit)))
    where = "1=1"
    params: dict = {}
    if status in ("pending", "processing", "done", "failed"):
        where = "c.status = :st"
        params["st"] = status

    total_result = await db.execute(
        text(f"SELECT COUNT(*) FROM claim_requests c WHERE {where}"),
        params,
    )
    total = total_result.scalar() or 0

    if download:
        rows = await db.execute(
            text(f"""
                SELECT c.id, c.uid, c.user_address, c.amount_base,
                       c.reward_ids, c.status, c.tx_hash, c.error,
                       c.created_at, c.processed_at,
                       u.nickname
                FROM claim_requests c
                LEFT JOIN users u ON u.address = c.uid
                WHERE {where}
                ORDER BY c.id DESC
                LIMIT 500
            """),
            params,
        )
    else:
        params_page = dict(params, offset=(page - 1) * limit, lim=limit)
        rows = await db.execute(
            text(f"""
                SELECT c.id, c.uid, c.user_address, c.amount_base,
                       c.reward_ids, c.status, c.tx_hash, c.error,
                       c.created_at, c.processed_at,
                       u.nickname
                FROM claim_requests c
                LEFT JOIN users u ON u.address = c.uid
                WHERE {where}
                ORDER BY c.id DESC
                LIMIT :lim OFFSET :offset
            """),
            params_page,
        )

    data = [
        {
            "id": int(r[0]),
            "uid": r[1],
            "user_address": r[2] or "",
            "amount_base": str(r[3] or "0"),
            "reward_ids": r[4] or "",
            "status": r[5],
            "tx_hash": r[6] or "",
            "error": r[7] or "",
            "created_at": r[8].isoformat() if r[8] else None,
            "processed_at": r[9].isoformat() if r[9] else None,
            "nickname": r[10] or "",
        }
        for r in rows.fetchall()
    ]

    if download:
        return csv_response(
            data,
            [
                ("ID", "id"),
                ("UID", "uid"),
                ("Nickname", "nickname"),
                ("User Address", "user_address"),
                ("Amount Base", "amount_base"),
                ("Status", "status"),
                ("TX Hash", "tx_hash"),
                ("Error", "error"),
                ("Created At", "created_at"),
                ("Processed At", "processed_at"),
            ],
            f"invite_claims_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}.csv",
        )

    return success({"data": data, "total": int(total)})


class _ConfirmClaimReq(BaseModel):
    tx_hash: str


@router.post(
    "/claims/{claim_id}/confirm",
    dependencies=[Depends(require_permission("reward_payouts:create"))],
)
async def confirm_claim(
    claim_id: int,
    req: _ConfirmClaimReq,
    db: AsyncSession = Depends(get_db),
):
    tx_hash = (req.tx_hash or "").strip()
    if not tx_hash:
        raise HTTPException(400, "tx_hash is required")

    row = await db.execute(
        text("""
            SELECT id, uid, reward_ids, status
            FROM claim_requests
            WHERE id = :id
            FOR UPDATE
        """),
        {"id": claim_id},
    )
    r = row.fetchone()
    if not r:
        raise HTTPException(404, "claim not found")
    if r[3] not in ("pending", "processing"):
        raise HTTPException(409, f"claim status is '{r[3]}', cannot confirm")

    uid = r[1]
    reward_ids_str = r[2] or ""
    reward_ids = [int(x) for x in reward_ids_str.split(",") if x.strip().isdigit()]
    now = _now()

    await db.execute(
        text("""
            UPDATE claim_requests
            SET status = 'done', tx_hash = :tx, processed_at = :now
            WHERE id = :id
        """),
        {"tx": tx_hash, "now": now, "id": claim_id},
    )

    if reward_ids:
        await db.execute(
            text("""
                UPDATE invite_rewards
                SET status = 'paid', paid_at = :now, paid_tx_hash = :tx
                WHERE id = ANY(:ids) AND status = 'pending'
            """),
            {"now": now, "tx": tx_hash, "ids": reward_ids},
        )

    await _rebuild_invite_balance(db, uid)
    await db.commit()

    logger.info(
        "confirm_claim: id=%s uid=%s tx=%s rewards=%s",
        claim_id,
        uid,
        tx_hash,
        len(reward_ids),
    )
    return success({"claim_id": claim_id, "status": "done"})


class _FailClaimReq(BaseModel):
    error: str = ""


@router.post(
    "/claims/{claim_id}/fail",
    dependencies=[Depends(require_permission("reward_payouts:create"))],
)
async def fail_claim(
    claim_id: int,
    req: _FailClaimReq,
    db: AsyncSession = Depends(get_db),
):
    row = await db.execute(
        text("""
            SELECT id, status FROM claim_requests WHERE id = :id FOR UPDATE
        """),
        {"id": claim_id},
    )
    r = row.fetchone()
    if not r:
        raise HTTPException(404, "claim not found")
    if r[1] not in ("pending", "processing"):
        raise HTTPException(409, f"claim status is '{r[1]}', cannot fail")

    await db.execute(
        text("""
            UPDATE claim_requests
            SET status = 'failed', error = :err, processed_at = :now
            WHERE id = :id
        """),
        {"err": req.error or "manually rejected", "now": _now(), "id": claim_id},
    )
    await db.commit()

    logger.info("fail_claim: id=%s", claim_id)
    return success({"claim_id": claim_id, "status": "failed"})


async def _rebuild_invite_balance(db: AsyncSession, uid: str) -> None:
    row = await db.execute(
        text("""
            SELECT
              COALESCE(SUM(CASE WHEN status = 'pending'
                                THEN CAST(reward_base AS BIGINT) ELSE 0 END), 0),
              COALESCE(SUM(CASE WHEN status = 'paid'
                                THEN CAST(reward_base AS BIGINT) ELSE 0 END), 0)
            FROM invite_rewards
            WHERE inviter_luffa_id = :uid
        """),
        {"uid": uid},
    )
    r = row.fetchone()
    pending = str(int(r[0] or 0))
    paid = str(int(r[1] or 0))
    await db.execute(
        text("""
            INSERT INTO invite_balances (inviter_luffa_id, pending_base, paid_base)
            VALUES (:uid, :p, :d)
            ON CONFLICT (inviter_luffa_id) DO UPDATE
            SET pending_base = :p, paid_base = :d
        """),
        {"uid": uid, "p": pending, "d": paid},
    )
