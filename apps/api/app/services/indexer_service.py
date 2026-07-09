"""Indexer persistence helpers.

This module mirrors OLD ``api/services/v3_indexer.py``'s ``add_v3_event``:
every parsed on-chain event is first persisted to ``chain_event_log`` as an
idempotent anchor, then business handlers consume it.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models.chain_event_log import ChainEventLog
from app.models.indexer_cursor import IndexerCursor

logger = logging.getLogger(__name__)


async def get_worker_cursor(db: Any, cursor_id: int) -> str | None:
    """Return the signature field for a worker cursor row, or None.

    Workers reuse ``indexer_cursor`` to track the last processed
    ``chain_event_log.id`` (stored as a string in the ``signature`` column).
    """
    row = await db.get(IndexerCursor, cursor_id)
    return row.signature if row is not None else None


async def set_worker_cursor(
    db: Any, cursor_id: int, signature: str | None, *, slot: int = 0
) -> None:
    """Persist a worker cursor, creating the row if it does not exist."""
    row = await db.get(IndexerCursor, cursor_id)
    if row is None:
        row = IndexerCursor(id=cursor_id, slot=slot, signature=signature)
        db.add(row)
    else:
        row.signature = signature
        row.slot = slot
    await db.flush()


async def persist_chain_event(
    db: Any,
    *,
    program_id: str,
    signature: str,
    slot: int,
    block_time: int | None,
    event_index: int,
    kind: str,
    actor: str | None,
    payload: dict[str, Any],
    module: str | None = None,
    subject: str | None = None,
) -> bool:
    """Insert a parsed event into chain_event_log, ignoring duplicates.

    Returns:
        True if the row was inserted, False if it already existed.
    """
    stmt = pg_insert(ChainEventLog).values(
        program_id=program_id,
        module=module,
        subject=subject,
        signature=signature,
        slot=slot,
        block_time=block_time,
        event_index=event_index,
        kind=kind,
        actor=actor,
        payload=payload,
    ).on_conflict_do_nothing(
        index_elements=["signature", "kind", "event_index"]
    )
    result = await db.execute(stmt)
    # rowcount is 1 on insert, 0 on conflict skip.
    return (getattr(result, "rowcount", 0) or 0) > 0


async def is_event_processed(
    db: Any,
    *,
    signature: str,
    kind: str,
    event_index: int,
) -> bool:
    """Check whether a specific event has already been persisted."""
    stmt = select(ChainEventLog.id).where(
        ChainEventLog.signature == signature,
        ChainEventLog.kind == kind,
        ChainEventLog.event_index == event_index,
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none() is not None
