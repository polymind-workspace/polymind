from fastapi import APIRouter

from app.routers import solana_events, sync, users

api_router = APIRouter()
api_router.include_router(users.router)
api_router.include_router(sync.router)
api_router.include_router(solana_events.router)
