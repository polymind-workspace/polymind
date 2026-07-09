"""Reward payout job queue service."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, NotFoundError
from app.db.session import get_db
from app.models import RewardPayout


class RewardPayoutService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_payouts(
        self,
        *,
        user_address: str | None = None,
        status: str | None = None,
        payout_type: str | None = None,
        page: int = 1,
        limit: int = 24,
    ) -> dict:
        stmt = select(RewardPayout)
        if user_address:
            stmt = stmt.where(RewardPayout.user_address == user_address)
        if status:
            stmt = stmt.where(RewardPayout.status == status)
        if payout_type:
            stmt = stmt.where(RewardPayout.payout_type == payout_type)

        total_result = await self.session.execute(
            select(func.count()).select_from(stmt.subquery())
        )
        total = total_result.scalar() or 0

        stmt = stmt.order_by(RewardPayout.created_at.desc())
        stmt = stmt.offset((page - 1) * limit).limit(limit)

        result = await self.session.execute(stmt)
        items = [p.to_dict() for p in result.scalars().all()]

        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "hasMore": page * limit < total,
        }

    async def create_payout(
        self,
        *,
        user_address: str,
        payout_type: str,
        amount: int,
        payload: dict | None = None,
    ) -> dict:
        payout = RewardPayout(
            user_address=user_address,
            payout_type=payout_type,
            amount=amount,
            payload=payload or {},
            status="pending",
        )
        self.session.add(payout)
        await self.session.commit()
        await self.session.refresh(payout)
        return payout.to_dict()

    async def execute_payout(self, payout_id: int, signature: str | None = None) -> dict:
        payout = await self._get_payout_by_id(payout_id)
        if not payout:
            raise NotFoundError("payout not found")
        if payout.status not in ("pending", "failed"):
            raise BadRequestError(f"cannot execute payout in status {payout.status}")

        # Phase 4 MVP: simulate chain execution. Real implementation will call
        # the Solana program and confirm the transaction signature.
        payout.status = "running"
        await self.session.commit()

        payout.status = "completed"
        payout.tx_signature = signature or "simulated_tx_signature"
        payout.executed_at = datetime.now(UTC)
        await self.session.commit()
        await self.session.refresh(payout)
        return payout.to_dict()

    async def fail_payout(self, payout_id: int, error: str) -> dict:
        payout = await self._get_payout_by_id(payout_id)
        if not payout:
            raise NotFoundError("payout not found")

        payout.status = "failed"
        payout.error = error
        await self.session.commit()
        await self.session.refresh(payout)
        return payout.to_dict()

    async def _get_payout_by_id(self, payout_id: int) -> RewardPayout | None:
        result = await self.session.execute(
            select(RewardPayout).where(RewardPayout.id == payout_id)
        )
        return result.scalar_one_or_none()


def get_reward_payout_service(
    session: AsyncSession = Depends(get_db),
) -> RewardPayoutService:
    return RewardPayoutService(session)
