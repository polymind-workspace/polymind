"""Position service."""

from __future__ import annotations

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.exceptions import BadRequestError, NotFoundError
from app.db.session import get_db
from app.models import Market, Position
from app.utils.token import format_token_amount


class PositionService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_claim_preview(self, *, market_slug: str, user_address: str) -> dict:
        market, position = await self._get_market_and_position(market_slug, user_address)

        if market.status not in ("finalized", "void"):
            raise BadRequestError("market is not finalized")

        if market.finalized_outcome is None:
            raise BadRequestError("market outcome is not set")

        outcome = market.finalized_outcome

        if position and position.claimed_amount > 0:
            return self._build_claim_preview(
                market, position, outcome, 0, 0, 0, 0, 0, 0
            )

        principal = self._principal_for_outcome(position, outcome)
        payout = self._gross_payout(market, position, outcome)
        profit = max(payout - principal, 0)

        platform_fee = min(
            profit * market.platform_fee_bps // 10_000,
            market.platform_fee_max,
        )
        creator_fee = min(
            profit * market.creator_reward_bps // 10_000,
            market.creator_reward_max,
        )
        net_payout = max(payout - platform_fee - creator_fee, 0)

        return self._build_claim_preview(
            market,
            position,
            outcome,
            principal,
            payout,
            profit,
            platform_fee,
            creator_fee,
            net_payout,
        )

    async def sync_claim(
        self,
        *,
        market_slug: str,
        user_address: str,
        signature: str,
    ) -> dict:
        market, _ = await self._get_market_and_position(market_slug, user_address)

        if market.status not in ("finalized", "void"):
            raise BadRequestError("market is not finalized")

        # Phase 1: confirm the claim transaction signature. The indexer will
        # update the position row with claimed_amount and payout_amount.
        from app.clients.solana import SolanaClient

        client = SolanaClient()
        try:
            result = await client.confirm_transaction(signature)
        finally:
            await client.close()

        if not result.get("confirmed"):
            return {"confirmed": False, "signature": signature, "error": result.get("err")}

        return {"confirmed": True, "signature": signature, "slot": result.get("slot")}

    async def _get_market_and_position(
        self, market_slug: str, user_address: str
    ) -> tuple[Market, Position | None]:
        market_result = await self.session.execute(
            select(Market).where(Market.slug == market_slug)
        )
        market = market_result.scalar_one_or_none()
        if not market:
            raise NotFoundError("market not found")

        position_result = await self.session.execute(
            select(Position)
            .options(joinedload(Position.market))
            .where(
                Position.market_id == market.id,
                Position.user_address == user_address,
            )
        )
        position = position_result.unique().scalar_one_or_none()
        return market, position

    def _principal_for_outcome(self, position: Position | None, outcome: str) -> int:
        if position is None:
            return 0
        if outcome == "yes":
            return position.yes_amount
        if outcome == "no":
            return position.no_amount
        # void returns full principal
        return position.yes_amount + position.no_amount

    def _gross_payout(self, market: Market, position: Position | None, outcome: str) -> int:
        if position is None:
            return 0

        if outcome == "void":
            principal = position.yes_amount + position.no_amount
            stake_pool = market.yes_pool + market.no_pool
            if stake_pool == 0:
                return principal
            bonus_share = principal * market.bonus_pool // stake_pool
            return principal + bonus_share

        user_stake = position.yes_amount if outcome == "yes" else position.no_amount
        winning_pool = market.yes_pool if outcome == "yes" else market.no_pool
        if winning_pool == 0:
            return 0

        distributable = (
            market.distributable_pool
            if market.distributable_pool > 0
            else market.yes_pool + market.no_pool + market.bonus_pool
        )
        return user_stake * distributable // winning_pool

    def _build_claim_preview(
        self,
        market: Market,
        position: Position | None,
        outcome: str,
        principal: int,
        payout: int,
        profit: int,
        platform_fee: int,
        creator_fee: int,
        net_payout: int,
    ) -> dict:
        return {
            "market_id": str(market.id),
            "market_slug": market.slug,
            "market_title": market.title,
            "user_address": position.user_address if position else None,
            "principal": format_token_amount(principal),
            "payout": format_token_amount(payout),
            "profit": format_token_amount(profit),
            "platform_fee": format_token_amount(platform_fee),
            "creator_fee": format_token_amount(creator_fee),
            "net_payout": format_token_amount(net_payout),
            "outcome": outcome,
            "claimed": (position.claimed_amount > 0) if position else False,
        }


def get_position_service(session: AsyncSession = Depends(get_db)) -> PositionService:
    return PositionService(session)
