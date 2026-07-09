"""Admin audit log service."""

from __future__ import annotations

from typing import Any

from fastapi import Depends
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models import AdminAuditLog


class AdminAuditService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def log(
        self,
        *,
        admin_address: str,
        action: str,
        market_id: int | None = None,
        dispute_id: int | None = None,
        payload: dict[str, Any] | None = None,
        tx_signature: str | None = None,
    ) -> AdminAuditLog:
        """Append an immutable admin audit log entry."""
        row = AdminAuditLog(
            admin_address=admin_address,
            action=action,
            market_id=market_id,
            dispute_id=dispute_id,
            payload=payload,
            tx_signature=tx_signature,
        )
        self.session.add(row)
        await self.session.commit()
        await self.session.refresh(row)
        return row

    async def list_logs(
        self,
        *,
        admin_address: str | None = None,
        action: str | None = None,
        market_id: int | None = None,
        dispute_id: int | None = None,
        page: int = 1,
        limit: int = 50,
    ) -> dict:
        """List admin audit log entries with optional filters."""
        stmt = select(AdminAuditLog)

        if admin_address:
            stmt = stmt.where(AdminAuditLog.admin_address == admin_address)
        if action:
            stmt = stmt.where(AdminAuditLog.action == action)
        if market_id:
            stmt = stmt.where(AdminAuditLog.market_id == market_id)
        if dispute_id:
            stmt = stmt.where(AdminAuditLog.dispute_id == dispute_id)

        total_result = await self.session.execute(
            select(func.count()).select_from(stmt.subquery())
        )
        total = total_result.scalar() or 0

        stmt = stmt.order_by(desc(AdminAuditLog.created_at))
        stmt = stmt.offset((page - 1) * limit).limit(limit)

        result = await self.session.execute(stmt)
        items = [self._serialize(row) for row in result.scalars().all()]

        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "hasMore": page * limit < total,
        }

    @staticmethod
    def _serialize(row: AdminAuditLog) -> dict:
        return {
            "id": row.id,
            "admin_address": row.admin_address,
            "action": row.action,
            "market_id": row.market_id,
            "dispute_id": row.dispute_id,
            "payload": row.payload,
            "tx_signature": row.tx_signature,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }


def get_admin_audit_service(
    session: AsyncSession = Depends(get_db),
) -> AdminAuditService:
    return AdminAuditService(session)
