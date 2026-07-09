"""Slug generation utilities."""

from __future__ import annotations

import re
import unicodedata

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


def slugify(text: str, max_len: int = 80) -> str:
    """Normalize a string into a URL-safe slug."""
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = text.strip("-")
    if len(text) > max_len:
        text = text[:max_len].rstrip("-")
    return text or "untitled"


async def unique_event_slug(
    session: AsyncSession,
    title: str,
    onchain_event_id: str | None = None,
) -> str:
    """Generate a unique event slug.

    Falls back to onchain_event_id if title cannot produce a slug.
    """
    from app.models import Event

    base = slugify(title) or f"event-{onchain_event_id or 'draft'}"
    candidate = base
    counter = 2
    while True:
        existing = await session.execute(select(Event).where(Event.slug == candidate))
        if existing.scalar_one_or_none() is None:
            return candidate
        candidate = f"{base}-{counter}"
        counter += 1


async def unique_market_slug(
    session: AsyncSession,
    title: str,
    event_slug: str,
    market_idx: int = 0,
) -> str:
    """Generate a unique market slug based on event slug and market index/title."""
    from app.models import Market

    base = slugify(title) or f"{event_slug}-market"
    candidate = f"{event_slug}-{base}"
    if market_idx > 0:
        candidate = f"{candidate}-{market_idx}"
    counter = 2
    while True:
        existing = await session.execute(select(Market).where(Market.slug == candidate))
        if existing.scalar_one_or_none() is None:
            return candidate
        candidate = f"{event_slug}-{base}-{counter}"
        counter += 1
