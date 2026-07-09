from datetime import UTC, datetime, timedelta

from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.exceptions import ForbiddenError, NotFoundError
from app.db.session import get_db
from app.models import Market, Trade
from app.services.admin_audit_service import AdminAuditService
from app.services.chain_parser import (
    OUTCOME_NO,
    OUTCOME_VOID,
    OUTCOME_YES,
    PolyMindInstruction,
    fetch_and_parse_transaction,
    verify_admin_action,
    verify_creator_action,
    verify_instruction,
)


class MarketService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_markets(
        self,
        *,
        category: str | None = None,
        tag: str | None = None,
        search: str | None = None,
        status: str | None = None,
        source: str | None = None,
        sort: str = "created_at",
        page: int = 1,
        limit: int = 24,
        is_admin: bool = False,
    ) -> dict:
        stmt = select(Market).options(joinedload(Market.event))

        if category and category != "all":
            stmt = stmt.join(Market.event).join(Market.event.property.class_.category)
            stmt = stmt.where(Market.event.property.class_.category.has(slug=category))

        if tag:
            from app.models import Tag

            stmt = (
                stmt.join(Market.event)
                .join(Market.event.property.class_.tags)
                .where(Tag.slug == tag)
            )

        if search:
            like = f"%{search.strip()}%"
            stmt = stmt.where(
                (Market.title.ilike(like)) | (Market.event.property.class_.title.ilike(like))
            )

        if status:
            stmt = stmt.where(Market.status == status)

        if source:
            stmt = stmt.join(Market.event).where(Market.event.property.class_.source == source)

        if not is_admin:
            stmt = stmt.join(Market.event).where(Market.event.property.class_.is_flagged.is_(False))

        total_result = await self.session.execute(select(func.count()).select_from(stmt.subquery()))
        total = total_result.scalar() or 0

        sort_column = getattr(Market, sort, Market.created_at)
        stmt = stmt.order_by(
            Market.event.property.class_.pinned.desc(),
            Market.event.property.class_.pinned_at.desc(),
            sort_column.desc(),
        )
        stmt = stmt.offset((page - 1) * limit).limit(limit)

        result = await self.session.execute(stmt)
        items = [self._serialize_market(m) for m in result.unique().scalars().all()]

        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "hasMore": page * limit < total,
        }

    async def get_market_by_slug(self, slug: str) -> dict | None:
        stmt = select(Market).options(joinedload(Market.event)).where(Market.slug == slug)
        result = await self.session.execute(stmt)
        market = result.unique().scalar_one_or_none()
        if not market:
            return None

        data = self._serialize_market(market, detail=True)
        data["activity"] = await self._market_activity(market.id)
        data["related_markets"] = await self._related_markets(market.id, market.event_id)
        return data

    async def _market_activity(self, market_id: int) -> list[dict]:
        stmt = (
            select(Trade)
            .where(Trade.market_id == market_id)
            .order_by(Trade.created_at.desc())
            .limit(50)
        )
        result = await self.session.execute(stmt)
        return [
            {
                "id": str(t.id),
                "type": "bet",
                "user": t.user_address,
                "side": t.side,
                "amount": t.amount / 1_000_000,
                "timestamp": t.created_at.isoformat() if t.created_at else None,
            }
            for t in result.scalars().all()
        ]

    async def _related_markets(self, market_id: int, event_id: int) -> list[dict]:
        stmt = (
            select(Market)
            .options(joinedload(Market.event))
            .where(Market.id != market_id)
            .where(Market.event_id == event_id)
            .order_by(Market.created_at.desc())
            .limit(4)
        )
        result = await self.session.execute(stmt)
        return [self._serialize_market(m) for m in result.unique().scalars().all()]

    async def get_market_config(self, slug: str) -> dict | None:
        stmt = select(Market).where(Market.slug == slug)
        result = await self.session.execute(stmt)
        market = result.scalar_one_or_none()
        if not market:
            return None

        return {
            "platform_fee_bps": market.platform_fee_bps,
            "platform_fee_max": market.platform_fee_max / 1_000_000,
            "creator_reward_bps": market.creator_reward_bps,
            "creator_reward_max": market.creator_reward_max / 1_000_000,
            "dispute_window_secs": market.dispute_window_secs,
            "admin_timeout_secs": market.admin_timeout_secs,
            "creator_propose_timeout": market.creator_propose_timeout,
            "min_bet": market.min_bet / 1_000_000,
            "expired_propose_mode": market.expired_propose_mode,
            "single_side_only": market.single_side_only,
        }

    async def propose_outcome(
        self,
        *,
        slug: str,
        user_address: str,
        outcome: str,
        signature: str,
    ) -> dict:
        market = await self._get_market_or_raise(slug)
        if market.creator_address != user_address:
            raise ForbiddenError("only market creator can propose")

        parsed = await fetch_and_parse_transaction(signature)
        verify_creator_action(
            parsed,
            PolyMindInstruction.PROPOSE_OUTCOME,
            creator_address=user_address,
        )
        event = parsed.polymind_events
        proposed_event = next(
            (ev for ev in event if ev.type.value == "OutcomeProposed"), None
        )
        if proposed_event is not None:
            from app.services.chain_parser import OutcomeProposedPayload

            payload = proposed_event.payload
            if isinstance(payload, OutcomeProposedPayload):
                expected_outcome = (
                    OUTCOME_YES if outcome == "yes" else
                    OUTCOME_NO if outcome == "no" else OUTCOME_VOID
                )
                if payload.outcome != expected_outcome:
                    raise ForbiddenError("signature outcome does not match request")
                if payload.event_id != int(market.event.onchain_event_id or 0):
                    raise ForbiddenError("signature event does not match market")
                if payload.market_idx != market.market_idx:
                    raise ForbiddenError("signature market index does not match")

        return await self._confirm_chain_action(signature)

    async def finalize_market(
        self,
        slug: str,
        signature: str,
    ) -> dict:
        market = await self._get_market_or_raise(slug)

        parsed = await fetch_and_parse_transaction(signature)
        verify_instruction(parsed, PolyMindInstruction.FINALIZE_PROPOSED)

        # Optionally verify the event matches the requested market.
        finalized_event = next(
            (ev for ev in parsed.polymind_events if ev.type.value == "Finalized"), None
        )
        if finalized_event is not None:
            from app.services.chain_parser import FinalizedPayload

            payload = finalized_event.payload
            if isinstance(payload, FinalizedPayload):
                if payload.event_id != int(market.event.onchain_event_id or 0):
                    raise ForbiddenError("signature event does not match market")
                if payload.market_idx != market.market_idx:
                    raise ForbiddenError("signature market index does not match")

        return await self._confirm_chain_action(signature)

    async def admin_finalize_market(
        self,
        *,
        slug: str,
        admin_address: str,
        outcome: str,
        signature: str,
        reason: str | None,
    ) -> dict:
        """Admin force-finalizes a market outcome.

        Verifies the on-chain admin_finalize instruction, writes an audit log,
        and immediately reflects the finalized state in the market row.
        """
        market = await self._get_market_or_raise(slug)

        parsed = await fetch_and_parse_transaction(signature)
        verify_admin_action(
            parsed,
            PolyMindInstruction.ADMIN_FINALIZE,
            admin_address=admin_address,
        )

        finalized_event = next(
            (ev for ev in parsed.polymind_events if ev.type.value == "Finalized"), None
        )
        if finalized_event is None:
            raise ForbiddenError("admin_finalize transaction did not emit Finalized event")

        from app.services.chain_parser import FinalizedPayload

        payload = finalized_event.payload
        if not isinstance(payload, FinalizedPayload):
            raise ForbiddenError("unexpected Finalized payload")

        if payload.event_id != int(market.event.onchain_event_id or 0):
            raise ForbiddenError("signature event does not match market")
        if payload.market_idx != market.market_idx:
            raise ForbiddenError("signature market index does not match")

        expected_outcome = (
            OUTCOME_YES if outcome == "yes" else
            OUTCOME_NO if outcome == "no" else OUTCOME_VOID
        )
        if payload.outcome != expected_outcome:
            raise ForbiddenError("signature outcome does not match request")

        confirmation = await self._confirm_chain_action(signature)
        if not confirmation.get("confirmed"):
            return confirmation

        # Sync market row immediately.
        if payload.outcome == OUTCOME_YES:
            outcome_str = "yes"
        elif payload.outcome == OUTCOME_NO:
            outcome_str = "no"
        else:
            outcome_str = "void"
        market.finalized_outcome = outcome_str
        market.finalized_by = admin_address
        market.finalized_at = datetime.now(UTC)
        market.finalization_path = 2
        market.admin_reason = reason or market.admin_reason
        market.dispute_active = False
        market.status = "void" if outcome_str == "void" else "finalized"

        audit = AdminAuditService(self.session)
        await audit.log(
            admin_address=admin_address,
            action="market_finalize",
            market_id=market.id,
            payload={
                "market_slug": slug,
                "final_outcome": outcome,
                "admin_reason": reason,
            },
            tx_signature=signature,
        )
        await self.session.commit()
        await self.session.refresh(market)
        return {**confirmation, "reason": reason}

    async def void_market(
        self,
        *,
        slug: str,
        admin_address: str,
        signature: str,
        reason: str | None,
    ) -> dict:
        market = await self._get_market_or_raise(slug)

        parsed = await fetch_and_parse_transaction(signature)
        # Either emergency_void (anyone after admin timeout) or expire_unproposed
        # (mode1 slash) results in a VOID market.
        instruction_names = {ix.instruction_name for ix in parsed.polymind_instructions}
        if (
            PolyMindInstruction.EMERGENCY_VOID not in instruction_names
            and PolyMindInstruction.EXPIRE_UNPROPOSED not in instruction_names
        ):
            raise ForbiddenError(
                "void transaction must contain emergency_void or expire_unproposed instruction"
            )

        finalized_event = next(
            (ev for ev in parsed.polymind_events if ev.type.value == "Finalized"), None
        )
        if finalized_event is not None:
            from app.services.chain_parser import FinalizedPayload

            payload = finalized_event.payload
            if isinstance(payload, FinalizedPayload):
                if payload.event_id != int(market.event.onchain_event_id or 0):
                    raise ForbiddenError("signature event does not match market")
                if payload.market_idx != market.market_idx:
                    raise ForbiddenError("signature market index does not match")
                if payload.outcome != OUTCOME_VOID:
                    raise ForbiddenError("signature outcome is not void")

        confirmation = await self._confirm_chain_action(signature)
        if not confirmation.get("confirmed"):
            return confirmation

        # Sync market row immediately.
        market.finalized_outcome = "void"
        market.finalized_by = admin_address
        market.finalized_at = datetime.now(UTC)
        market.finalization_path = (
            3 if PolyMindInstruction.EMERGENCY_VOID in instruction_names else 4
        )
        market.admin_reason = reason or market.admin_reason
        market.dispute_active = False
        market.status = "void"

        audit = AdminAuditService(self.session)
        await audit.log(
            admin_address=admin_address,
            action="market_void",
            market_id=market.id,
            payload={
                "market_slug": slug,
                "final_outcome": "void",
                "admin_reason": reason,
            },
            tx_signature=signature,
        )
        await self.session.commit()
        await self.session.refresh(market)
        return {**confirmation, "reason": reason}

    async def update_market(
        self,
        slug: str,
        updates: dict,
    ) -> dict:
        stmt = select(Market).where(Market.slug == slug)
        result = await self.session.execute(stmt)
        market = result.scalar_one_or_none()
        if not market:
            raise NotFoundError("market not found")

        allowed = {
            "title",
            "label_yes",
            "label_no",
            "is_flagged",
            "can_bet",
            "deadline",
        }
        for key, value in updates.items():
            if key in allowed:
                setattr(market, key, value)

        await self.session.commit()
        await self.session.refresh(market)
        return self._serialize_market(market, detail=True)

    async def _get_market_or_raise(self, slug: str) -> Market:
        stmt = select(Market).options(joinedload(Market.event)).where(Market.slug == slug)
        result = await self.session.execute(stmt)
        market = result.unique().scalar_one_or_none()
        if not market:
            raise NotFoundError("market not found")
        return market

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

    def _compute_market_stage(self, market: Market) -> str:
        """Compute the UI-facing stage from on-chain state and current time."""
        now = datetime.now(UTC)

        if market.status in ("finalized", "void"):
            return "settled"

        if market.dispute_active:
            return "dispute_pending"

        if market.proposed_outcome is not None and market.proposed_at is not None:
            review_end = market.proposed_at + timedelta(seconds=market.dispute_window_secs)
            if now < review_end:
                return "in_review"
            admin_deadline = market.proposed_at + timedelta(seconds=market.admin_timeout_secs)
            if now >= admin_deadline:
                return "emergency_voidable"
            return "ready_finalize"

        if market.deadline is not None:
            if now < market.deadline:
                return "betting"
            propose_deadline = market.deadline + timedelta(
                seconds=market.creator_propose_timeout
            )
            if now < propose_deadline:
                return "awaiting_proposal"
            if market.expired_propose_mode == 0:
                return "expired_takeover"
            return "expired_voidable"

        return market.status or "unknown"

    def _serialize_market(self, market: Market, *, detail: bool = False) -> dict:
        event = market.event
        total_pool = market.yes_pool + market.no_pool
        if total_pool == 0:
            yes_probability = 0.5
            no_probability = 0.5
        else:
            yes_probability = market.yes_pool / total_pool
            no_probability = market.no_pool / total_pool

        item = {
            "id": str(market.id),
            "slug": market.slug,
            "title": market.title,
            "description": event.description or "",
            "imageUrl": event.image_url,
            "category": event.category.name if event.category else "all",
            "status": market.status,
            "stage": self._compute_market_stage(market),
            "yesProbability": yes_probability,
            "noProbability": no_probability,
            "yesPool": market.yes_pool / 1_000_000,
            "noPool": market.no_pool / 1_000_000,
            "volume": market.volume / 1_000_000,
            "players": market.players_count,
            "endTime": market.deadline.isoformat() if market.deadline else None,
            "resolvedOutcome": market.finalized_outcome,
            "finalizationPath": market.finalization_path,
            "adminReason": market.admin_reason,
            "tags": [t.slug for t in event.tags],
            "source": event.source,
        }

        if detail:
            item["outcomes"] = {
                "yes": {"probability": yes_probability, "pool": market.yes_pool / 1_000_000},
                "no": {"probability": no_probability, "pool": market.no_pool / 1_000_000},
            }
            item["rules"] = event.rules or ""

        return item


def get_market_service(session: AsyncSession = Depends(get_db)) -> MarketService:
    return MarketService(session)
