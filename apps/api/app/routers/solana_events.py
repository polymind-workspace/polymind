from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.response import success
from app.db.session import get_db
from app.models.chain_event_log import ChainEventLog

router = APIRouter(prefix="/api/v1/solana-events", tags=["solana-events"])


@router.get("")
async def list_solana_events(
    kind: str | None = Query(None, description="Filter by event kind"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List chain events indexed by the Python worker."""
    stmt = select(ChainEventLog).order_by(desc(ChainEventLog.slot))
    if kind:
        stmt = stmt.where(ChainEventLog.kind == kind)
    stmt = stmt.offset(offset).limit(limit)

    result = await db.execute(stmt)
    events = result.scalars().all()

    return success(
        data=[
            {
                "id": e.id,
                "program_id": e.program_id,
                "signature": e.signature,
                "slot": e.slot,
                "block_time": e.block_time,
                "kind": e.kind,
                "actor": e.actor,
                "payload": e.payload,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events
        ]
    )
