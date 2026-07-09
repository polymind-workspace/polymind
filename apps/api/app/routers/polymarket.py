"""Polymarket proxy router."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.clients.polymarket import PolymarketClient, get_polymarket_client
from app.core.response import success

router = APIRouter(prefix="/api/v1/polymarket", tags=["polymarket"])


@router.get("/events")
async def list_polymarket_events(
    category: str | None = Query(default=None),
    keyword: str | None = Query(default=None),
    active: bool = Query(default=True),
    closed: bool = Query(default=False),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    client: PolymarketClient = Depends(get_polymarket_client),
):
    data = await client.list_events(
        active=active,
        closed=closed,
        category=category,
        keyword=keyword,
        limit=limit,
        offset=offset,
    )
    return success(data=data)


@router.get("/events/{event_id}")
async def get_polymarket_event(
    event_id: str,
    client: PolymarketClient = Depends(get_polymarket_client),
):
    data = await client.get_event(event_id)
    return success(data=data)


@router.get("/orderbook/{token_id}")
async def get_polymarket_order_book(
    token_id: str,
    client: PolymarketClient = Depends(get_polymarket_client),
):
    data = await client.get_order_book(token_id)
    return success(data=data)
