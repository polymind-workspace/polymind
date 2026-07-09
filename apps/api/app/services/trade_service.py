"""Trade service."""

from __future__ import annotations

from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.db.session import get_db
from app.models import Market, Trade
from app.services.chain_parser import verify_trade
from app.utils.token import format_token_amount


class TradeService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_trades(
        self,
        *,
        market_id: int | None = None,
        market_slug: str | None = None,
        user_address: str | None = None,
        side: str | None = None,
        confirmed_only: bool = True,
        download: bool = False,
        page: int = 1,
        limit: int = 24,
    ) -> dict:
        stmt = select(Trade).options(joinedload(Trade.market))

        if market_id:
            stmt = stmt.where(Trade.market_id == market_id)

        if market_slug:
            stmt = stmt.join(Trade.market).where(Market.slug == market_slug)

        if user_address:
            stmt = stmt.where(Trade.user_address == user_address)

        if side:
            stmt = stmt.where(Trade.side == side.lower())

        if confirmed_only:
            stmt = stmt.where(Trade.slot.isnot(None))

        total_result = await self.session.execute(
            select(func.count()).select_from(stmt.subquery())
        )
        total = total_result.scalar() or 0

        stmt = stmt.order_by(Trade.created_at.desc())

        if download:
            stmt = stmt.limit(500)
            result = await self.session.execute(stmt)
            items = [self._serialize_trade_row(t) for t in result.unique().scalars().all()]
            return {"items": items, "total": total}

        stmt = stmt.offset((page - 1) * limit).limit(limit)
        result = await self.session.execute(stmt)
        items = [self._serialize_trade(t) for t in result.unique().scalars().all()]

        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "hasMore": page * limit < total,
        }

    async def sync_trade(self, signature: str) -> dict:
        """Confirm a trade transaction has landed on-chain.

        Verifies the transaction contains a PolyMind bet instruction before
        confirming.
        """
        await verify_trade(signature)

        from app.clients.solana import SolanaClient

        client = SolanaClient()
        try:
            result = await client.confirm_transaction(signature)
        finally:
            await client.close()

        if not result.get("confirmed"):
            return {"confirmed": False, "signature": signature, "error": result.get("err")}

        return {"confirmed": True, "signature": signature, "slot": result.get("slot")}

    def _serialize_trade(self, trade: Trade) -> dict:
        market = trade.market
        return {
            "id": str(trade.id),
            "market_id": str(trade.market_id),
            "market_slug": market.slug if market else None,
            "market_title": market.title if market else None,
            "user": trade.user_address,
            "side": trade.side,
            "amount": format_token_amount(trade.amount),
            "tx_signature": trade.tx_signature,
            "slot": trade.slot,
            "block_time": trade.block_time,
            "created_at": trade.created_at.isoformat() if trade.created_at else None,
        }

    def _serialize_trade_row(self, trade: Trade) -> dict:
        """Flat dict suitable for CSV export."""
        market = trade.market
        return {
            "id": str(trade.id),
            "market_id": str(trade.market_id),
            "market_slug": market.slug if market else "",
            "market_title": market.title if market else "",
            "user_address": trade.user_address,
            "side": trade.side,
            "amount": format_token_amount(trade.amount),
            "tx_signature": trade.tx_signature,
            "slot": trade.slot,
            "block_time": trade.block_time,
            "created_at": trade.created_at.isoformat() if trade.created_at else "",
        }


def get_trade_service(session: AsyncSession = Depends(get_db)) -> TradeService:
    return TradeService(session)
