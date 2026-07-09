from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.exceptions import ForbiddenError, NotFoundError
from app.db.session import get_db
from app.models import Market, Trade


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

        # Phase 1: only confirm the Solana transaction.
        return await self._confirm_chain_action(signature)

    async def finalize_market(
        self,
        slug: str,
        signature: str,
    ) -> dict:
        await self._get_market_or_raise(slug)
        return await self._confirm_chain_action(signature)

    async def void_market(
        self,
        *,
        slug: str,
        admin_address: str,
        signature: str,
        reason: str | None,
    ) -> dict:
        await self._get_market_or_raise(slug)
        # Phase 1: only confirm the Solana transaction.
        # Reason is stored for audit but the real state change comes from the indexer.
        return {**await self._confirm_chain_action(signature), "reason": reason}

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
            "status",
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
        stmt = select(Market).where(Market.slug == slug)
        result = await self.session.execute(stmt)
        market = result.scalar_one_or_none()
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
            "yesProbability": yes_probability,
            "noProbability": no_probability,
            "yesPool": market.yes_pool / 1_000_000,
            "noPool": market.no_pool / 1_000_000,
            "volume": market.volume / 1_000_000,
            "players": market.players_count,
            "endTime": market.deadline.isoformat() if market.deadline else None,
            "resolvedOutcome": market.finalized_outcome,
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
