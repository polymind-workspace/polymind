"""Batch transfer job queue service."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, NotFoundError
from app.db.session import get_db
from app.models import BatchTransfer


class BatchTransferService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_transfers(
        self,
        *,
        sender_address: str | None = None,
        recipient_address: str | None = None,
        status: str | None = None,
        page: int = 1,
        limit: int = 24,
    ) -> dict:
        stmt = select(BatchTransfer)
        if sender_address:
            stmt = stmt.where(BatchTransfer.sender_address == sender_address)
        if recipient_address:
            stmt = stmt.where(BatchTransfer.recipient_address == recipient_address)
        if status:
            stmt = stmt.where(BatchTransfer.status == status)

        total_result = await self.session.execute(
            select(func.count()).select_from(stmt.subquery())
        )
        total = total_result.scalar() or 0

        stmt = stmt.order_by(BatchTransfer.created_at.desc())
        stmt = stmt.offset((page - 1) * limit).limit(limit)

        result = await self.session.execute(stmt)
        items = [t.to_dict() for t in result.scalars().all()]

        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "hasMore": page * limit < total,
        }

    async def create_transfer(
        self,
        *,
        sender_address: str | None,
        recipient_address: str,
        amount: int,
        token_mint: str | None = None,
        payload: dict | None = None,
    ) -> dict:
        transfer = BatchTransfer(
            sender_address=sender_address,
            recipient_address=recipient_address,
            amount=amount,
            token_mint=token_mint,
            payload=payload or {},
            status="pending",
        )
        self.session.add(transfer)
        await self.session.commit()
        await self.session.refresh(transfer)
        return transfer.to_dict()

    async def execute_transfer(
        self,
        transfer_id: int,
        signature: str | None = None,
    ) -> dict:
        transfer = await self._get_transfer_by_id(transfer_id)
        if not transfer:
            raise NotFoundError("transfer not found")
        if transfer.status not in ("pending", "failed"):
            raise BadRequestError(f"cannot execute transfer in status {transfer.status}")

        transfer.status = "running"
        await self.session.commit()

        # Phase 4 MVP: simulate chain execution.
        transfer.status = "completed"
        transfer.tx_signature = signature or "simulated_tx_signature"
        transfer.executed_at = datetime.now(UTC)
        await self.session.commit()
        await self.session.refresh(transfer)
        return transfer.to_dict()

    async def fail_transfer(self, transfer_id: int, error: str) -> dict:
        transfer = await self._get_transfer_by_id(transfer_id)
        if not transfer:
            raise NotFoundError("transfer not found")

        transfer.status = "failed"
        transfer.error = error
        await self.session.commit()
        await self.session.refresh(transfer)
        return transfer.to_dict()

    async def _get_transfer_by_id(self, transfer_id: int) -> BatchTransfer | None:
        result = await self.session.execute(
            select(BatchTransfer).where(BatchTransfer.id == transfer_id)
        )
        return result.scalar_one_or_none()


def get_batch_transfer_service(
    session: AsyncSession = Depends(get_db),
) -> BatchTransferService:
    return BatchTransferService(session)
