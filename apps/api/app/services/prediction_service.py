from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Market, Position


class PredictionService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_user_positions(
        self,
        user_address: str,
        *,
        status: str | None = None,
    ) -> list[dict]:
        stmt = (
            select(Position, Market)
            .join(Market, Position.market_id == Market.id)
            .where(Position.user_address == user_address)
        )

        if status == "active":
            stmt = stmt.where(Market.status == "open")
        elif status == "resolved":
            stmt = stmt.where(Market.status == "resolved")

        stmt = stmt.order_by(Position.created_at.desc())
        result = await self.session.execute(stmt)

        items = []
        for position, market in result.unique().all():
            side = "yes" if position.yes_amount > position.no_amount else "no"
            amount = max(position.yes_amount, position.no_amount)
            items.append(
                {
                    "marketId": str(market.id),
                    "marketTitle": market.title,
                    "side": side,
                    "amount": amount / 1_000_000,
                    "value": (position.payout_amount or 0) / 1_000_000,
                    "pnl": ((position.payout_amount or 0) - amount) / 1_000_000,
                    "status": "active" if market.status == "open" else "resolved",
                }
            )
        return items
