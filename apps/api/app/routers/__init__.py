from fastapi import APIRouter

from app.routers import (
    admin_accounts,
    auth,
    configs,
    disputes,
    events,
    leaderboard,
    markets,
    notifications,
    positions,
    predictions,
    profile,
    referrals,
    solana_events,
    sync,
    trades,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(admin_accounts.router)
api_router.include_router(configs.router)
api_router.include_router(events.router)
api_router.include_router(sync.router)
api_router.include_router(solana_events.router)
api_router.include_router(markets.router)
api_router.include_router(positions.router)
api_router.include_router(trades.router)
api_router.include_router(disputes.router)
api_router.include_router(leaderboard.router)
api_router.include_router(predictions.router)
api_router.include_router(notifications.router)
api_router.include_router(profile.router)
api_router.include_router(referrals.router)
