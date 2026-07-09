from fastapi import APIRouter

from app.routers import (
    activities,
    admin_accounts,
    auth,
    batch_transfers,
    chat,
    configs,
    dashboard,
    disputes,
    events,
    leaderboard,
    markets,
    media,
    notifications,
    polymarket,
    positions,
    predictions,
    profile,
    push,
    referrals,
    reward_payouts,
    share,
    solana_events,
    sync,
    tags,
    trades,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(admin_accounts.router)
api_router.include_router(configs.router)
api_router.include_router(tags.router)
api_router.include_router(events.router)
api_router.include_router(sync.router)
api_router.include_router(solana_events.router)
api_router.include_router(markets.router)
api_router.include_router(positions.router)
api_router.include_router(trades.router)
api_router.include_router(disputes.router)
api_router.include_router(activities.router)
api_router.include_router(media.router)
api_router.include_router(push.router)
api_router.include_router(dashboard.router)
api_router.include_router(polymarket.router)
api_router.include_router(chat.router)
api_router.include_router(share.router)
api_router.include_router(reward_payouts.router)
api_router.include_router(batch_transfers.router)
api_router.include_router(leaderboard.router)
api_router.include_router(predictions.router)
api_router.include_router(notifications.router)
api_router.include_router(profile.router)
api_router.include_router(referrals.router)
