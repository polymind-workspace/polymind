"""Dispute service."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.db.session import get_db
from app.models import Dispute, Market, Position
from app.services.admin_audit_service import AdminAuditService
from app.services.chain_parser import (
    OUTCOME_NO,
    OUTCOME_VOID,
    OUTCOME_YES,
    PolyMindInstruction,
    fetch_and_parse_transaction,
    verify_admin_action,
    verify_dispute_bond,
)
from app.utils.token import format_token_amount


class DisputeService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_disputes(
        self,
        *,
        market_id: int | None = None,
        market_slug: str | None = None,
        status: str | None = None,
        disputer_address: str | None = None,
        page: int = 1,
        limit: int = 24,
    ) -> dict:
        stmt = select(Dispute).options(joinedload(Dispute.market))

        if market_id:
            stmt = stmt.where(Dispute.market_id == market_id)

        if market_slug:
            stmt = stmt.join(Dispute.market).where(Market.slug == market_slug)

        if status:
            stmt = stmt.where(Dispute.status == status)

        if disputer_address:
            stmt = stmt.where(Dispute.disputer_address == disputer_address)

        total_result = await self.session.execute(
            select(func.count()).select_from(stmt.subquery())
        )
        total = total_result.scalar() or 0

        stmt = stmt.order_by(Dispute.created_at.desc())
        stmt = stmt.offset((page - 1) * limit).limit(limit)

        result = await self.session.execute(stmt)
        items = [self._serialize_dispute(d) for d in result.unique().scalars().all()]

        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "hasMore": page * limit < total,
        }

    async def get_dispute(self, dispute_id: int) -> dict | None:
        stmt = (
            select(Dispute)
            .options(joinedload(Dispute.market))
            .where(Dispute.id == dispute_id)
        )
        result = await self.session.execute(stmt)
        dispute = result.unique().scalar_one_or_none()
        if not dispute:
            return None
        return self._serialize_dispute(dispute, detail=True)

    async def create_dispute(
        self,
        *,
        market_slug: str,
        disputer_address: str,
        claimed_outcome: str,
        signature: str,
        reason: str | None = None,
    ) -> dict:
        market = await self._get_market_by_slug(market_slug)
        if not market:
            raise NotFoundError("market not found")

        # Only participants with an open position may file a dispute.
        position_result = await self.session.execute(
            select(Position).where(
                Position.market_id == market.id,
                Position.user_address == disputer_address,
            )
        )
        position = position_result.scalar_one_or_none()
        if not position or (position.yes_amount + position.no_amount) == 0:
            raise ForbiddenError("only market participants can dispute")

        # Verify the on-chain dispute bond transaction.
        bond_event = await verify_dispute_bond(signature, expected_disputer=disputer_address)
        payload = bond_event.payload
        from app.services.chain_parser import BondDepositedPayload

        if isinstance(payload, BondDepositedPayload):
            if payload.event_id != int(market.event.onchain_event_id or 0):
                raise ForbiddenError("signature event does not match market")
            if payload.market_idx != market.market_idx:
                raise ForbiddenError("signature market index does not match")
            expected_outcome = (
                OUTCOME_YES if claimed_outcome == "yes" else
                OUTCOME_NO if claimed_outcome == "no" else OUTCOME_VOID
            )
            if payload.claimed_outcome != expected_outcome:
                raise ForbiddenError("signature claimed outcome does not match request")

        confirmation = await self._confirm_chain_action(signature)
        if not confirmation.get("confirmed"):
            return confirmation

        dispute = Dispute(
            market_id=market.id,
            disputer_address=disputer_address,
            claimed_outcome=claimed_outcome,
            bond_tx_signature=signature,
            reason=reason,
            status="active",
        )
        self.session.add(dispute)
        await self.session.commit()
        await self.session.refresh(dispute)

        return self._serialize_dispute(dispute)

    async def resolve_dispute(
        self,
        *,
        dispute_id: int,
        admin_address: str,
        resolved_outcome: str,
        signature: str,
        reason: str | None = None,
    ) -> dict:
        dispute = await self._get_dispute_by_id(dispute_id)
        if not dispute:
            raise NotFoundError("dispute not found")

        if dispute.status != "active":
            raise BadRequestError("dispute is not active")

        parsed = await fetch_and_parse_transaction(signature)
        verify_admin_action(
            parsed,
            PolyMindInstruction.ADMIN_RESOLVE,
            admin_address=admin_address,
        )

        confirmation = await self._confirm_chain_action(signature)
        if not confirmation.get("confirmed"):
            return confirmation

        dispute.status = "resolved"
        dispute.resolved_outcome = resolved_outcome
        dispute.resolved_reason = reason
        dispute.resolved_by = admin_address
        dispute.resolved_at = datetime.now(UTC)

        audit = AdminAuditService(self.session)
        await audit.log(
            admin_address=admin_address,
            action="dispute_resolve",
            market_id=dispute.market_id,
            dispute_id=dispute.id,
            payload={
                "dispute_id": dispute.id,
                "claimed_outcome": dispute.claimed_outcome,
                "resolved_outcome": resolved_outcome,
                "admin_reason": reason,
            },
            tx_signature=signature,
        )
        await self.session.commit()
        await self.session.refresh(dispute)

        return self._serialize_dispute(dispute, detail=True)

    async def dismiss_dispute(
        self,
        *,
        dispute_id: int,
        admin_address: str,
        signature: str,
        reason: str | None,
    ) -> dict:
        """Admin dismisses a dispute, siding with the proposed outcome.

        The dispute bond is slashed per the on-chain contract rules.
        """
        dispute = await self._get_dispute_by_id(dispute_id)
        if not dispute:
            raise NotFoundError("dispute not found")

        if dispute.status != "active":
            raise BadRequestError("dispute is not active")

        market = dispute.market
        proposed = market.proposed_outcome if market else None
        if not proposed:
            raise BadRequestError("market has no proposed outcome; cannot dismiss")

        parsed = await fetch_and_parse_transaction(signature)
        verify_admin_action(
            parsed,
            PolyMindInstruction.ADMIN_RESOLVE,
            admin_address=admin_address,
        )

        confirmation = await self._confirm_chain_action(signature)
        if not confirmation.get("confirmed"):
            return confirmation

        dispute.status = "rejected"
        dispute.resolved_outcome = proposed
        dispute.resolved_reason = reason
        dispute.resolved_by = admin_address
        dispute.resolved_at = datetime.now(UTC)

        audit = AdminAuditService(self.session)
        await audit.log(
            admin_address=admin_address,
            action="dispute_dismiss",
            market_id=market.id if market else None,
            dispute_id=dispute.id,
            payload={
                "dispute_id": dispute.id,
                "claimed_outcome": dispute.claimed_outcome,
                "proposed_outcome": proposed,
                "admin_reason": reason,
            },
            tx_signature=signature,
        )
        await self.session.commit()
        await self.session.refresh(dispute)

        return self._serialize_dispute(dispute, detail=True)

    async def _get_market_by_slug(self, slug: str) -> Market | None:
        from sqlalchemy.orm import joinedload

        result = await self.session.execute(
            select(Market).options(joinedload(Market.event)).where(Market.slug == slug)
        )
        return result.unique().scalar_one_or_none()

    async def _get_dispute_by_id(self, dispute_id: int) -> Dispute | None:
        result = await self.session.execute(
            select(Dispute).where(Dispute.id == dispute_id)
        )
        return result.scalar_one_or_none()

    async def _confirm_chain_action(self, signature: str) -> dict:
        from app.clients.solana import SolanaClient

        client = SolanaClient()
        try:
            result = await client.confirm_transaction(signature)
        finally:
            await client.close()

        if not result.get("confirmed"):
            return {"confirmed": False, "signature": signature, "error": result.get("err")}

        return {"confirmed": True, "signature": signature, "slot": result.get("slot")}

    def _serialize_dispute(self, dispute: Dispute, *, detail: bool = False) -> dict:
        market = dispute.market
        item = {
            "id": dispute.id,
            "market_id": dispute.market_id,
            "market_slug": market.slug if market else None,
            "market_title": market.title if market else None,
            "disputer": dispute.disputer_address,
            "claimed_outcome": dispute.claimed_outcome,
            "bond_amount": format_token_amount(dispute.bond_amount),
            "bond_tx_signature": dispute.bond_tx_signature,
            "reason": dispute.reason,
            "status": dispute.status,
            "resolved_outcome": dispute.resolved_outcome,
            "resolved_reason": dispute.resolved_reason,
            "resolved_by": dispute.resolved_by,
            "resolved_at": dispute.resolved_at.isoformat() if dispute.resolved_at else None,
            "created_at": dispute.created_at.isoformat() if dispute.created_at else None,
        }

        if detail:
            item["updated_at"] = (
                dispute.updated_at.isoformat() if dispute.updated_at else None
            )

        return item


def get_dispute_service(session: AsyncSession = Depends(get_db)) -> DisputeService:
    return DisputeService(session)
