"""Reward payout job queue service."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
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

        payout.status = "running"
        await self.session.commit()

        try:
            tx_signature = await self._send_or_verify_payout(payout, signature)
        except Exception as exc:
            payout.status = "failed"
            payout.error = str(exc)
            await self.session.commit()
            raise BadRequestError(f"payout failed: {exc}") from exc

        payout.status = "completed"
        payout.tx_signature = tx_signature
        payout.executed_at = datetime.now(UTC)
        await self.session.commit()
        await self.session.refresh(payout)
        return payout.to_dict()

    async def _send_or_verify_payout(
        self, payout: RewardPayout, signature: str | None
    ) -> str:
        """Either verify a frontend-signed tx or send one from the treasury."""
        from solders.keypair import Keypair

        from app.clients.solana import SolanaClient

        client = SolanaClient()
        try:
            if signature:
                confirmed = await client.confirm_transaction(signature)
                if not confirmed.get("confirmed"):
                    raise RuntimeError(
                        f"signature not confirmed: {confirmed.get('err')}"
                    )
                ok = await client.verify_native_transfer(
                    signature,
                    recipient_address=payout.user_address,
                    amount_lamports=payout.amount,
                )
                if not ok:
                    raise RuntimeError(
                        "signature does not match expected recipient/amount"
                    )
                return signature

            if not settings.solana_treasury_key:
                raise RuntimeError("SOLANA_TREASURY_KEY is not configured")

            keypair = Keypair.from_base58_string(settings.solana_treasury_key)
            tx_signature = await client.send_native_transfer(
                sender_keypair=keypair,
                recipient_address=payout.user_address,
                amount_lamports=payout.amount,
            )
            return tx_signature
        finally:
            await client.close()

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
