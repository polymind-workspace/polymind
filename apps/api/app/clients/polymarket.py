"""Polymarket API client."""

from __future__ import annotations

from typing import Any

import httpx

GAMMA_API_BASE = "https://gamma-api.polymarket.com"
CLOB_API_BASE = "https://clob.polymarket.com"


class PolymarketClient:
    """Thin async client for Polymarket Gamma / CLOB APIs."""

    def __init__(self) -> None:
        self.gamma = httpx.AsyncClient(base_url=GAMMA_API_BASE, timeout=20.0)
        self.clob = httpx.AsyncClient(base_url=CLOB_API_BASE, timeout=20.0)

    async def list_categories(self) -> list[dict[str, Any]]:
        """Return a static list of Polymarket categories for the MVP.

        Polymarket does not expose a stable public category endpoint, so we
        return the most common categories used by the import UI.
        """
        return [
            {"slug": "politics", "name": "Politics"},
            {"slug": "crypto", "name": "Crypto"},
            {"slug": "sports", "name": "Sports"},
            {"slug": "entertainment", "name": "Entertainment"},
            {"slug": "business", "name": "Business"},
            {"slug": "science", "name": "Science"},
            {"slug": "technology", "name": "Technology"},
            {"slug": "world", "name": "World"},
        ]

    async def list_events(
        self,
        *,
        active: bool = True,
        closed: bool = False,
        category: str | None = None,
        keyword: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {
            "active": str(active).lower(),
            "closed": str(closed).lower(),
            "limit": limit,
            "offset": offset,
        }
        if category:
            params["category"] = category

        resp = await self.gamma.get("/events", params=params)
        resp.raise_for_status()
        events = resp.json()

        if keyword:
            keyword_lower = keyword.lower()
            events = [
                e
                for e in events
                if keyword_lower in (e.get("title") or "").lower()
                or keyword_lower in (e.get("description") or "").lower()
            ]

        return [self._normalize_event(e) for e in events]

    async def get_event(self, event_id: str) -> dict[str, Any] | None:
        resp = await self.gamma.get(f"/events/{event_id}")
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return self._normalize_event(resp.json())

    async def get_order_book(self, token_id: str) -> dict[str, Any]:
        resp = await self.clob.get(f"/book/{token_id}")
        resp.raise_for_status()
        return resp.json()

    async def close(self) -> None:
        await self.gamma.aclose()
        await self.clob.aclose()

    def _normalize_event(self, event: dict[str, Any]) -> dict[str, Any]:
        """Normalize Polymarket event shape into our API envelope."""
        return {
            "external_id": event.get("id") or event.get("eventId"),
            "title": event.get("title"),
            "description": event.get("description"),
            "category": event.get("category"),
            "image_url": event.get("imageUrl"),
            "active": event.get("active"),
            "closed": event.get("closed"),
            "end_date": event.get("endDate"),
            "markets": [
                {
                    "id": m.get("id"),
                    "question": m.get("question"),
                    "outcomes": [o.get("name") for o in m.get("outcomes", [])],
                }
                for m in event.get("markets", [])
            ],
            "source": "polymarket",
        }


def get_polymarket_client() -> PolymarketClient:
    return PolymarketClient()
