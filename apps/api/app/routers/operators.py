"""Operator / on-chain role compatibility endpoints.

The legacy Endless admin backend exposed on-chain admin/creator/distributor
roles via view functions. In the Solana rewrite those roles live in the
`AdminAccount.permissions` JSONB array, so this router translates the old
shape into the new permission model.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.response import success
from app.db.session import get_db
from app.dependencies.auth import require_permission
from app.models.admin_account import AdminAccount

router = APIRouter(prefix="/api/v1/operators", tags=["operators"])

_ROLE_PERMISSION = {
    "admin": "markets:finalize",
    "creator": "events:create",
    "distributor": "reward_payouts:create",
}


@router.get("", dependencies=[Depends(require_permission("admin_accounts:list"))])
async def list_admins(
    role: str = Query(default="admin", pattern="^(admin|creator|distributor)$"),
    db: AsyncSession = Depends(get_db),
):
    permission = _ROLE_PERMISSION.get(role, role)
    result = await db.execute(
        select(AdminAccount.address).where(AdminAccount.permissions.contains([permission]))
    )
    return success(result.scalars().all())


@router.get("/roles", dependencies=[Depends(require_permission("admin_accounts:list"))])
async def list_all_roles(db: AsyncSession = Depends(get_db)):
    out: dict[str, list[str]] = {"admins": [], "creators": [], "distributors": []}
    for role, permission in _ROLE_PERMISSION.items():
        result = await db.execute(
            select(AdminAccount.address).where(AdminAccount.permissions.contains([permission]))
        )
        out[f"{role}s"] = result.scalars().all()
    return success(out)
