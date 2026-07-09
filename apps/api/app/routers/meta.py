"""Admin metadata endpoints for backwards compatibility."""

from fastapi import APIRouter

from app.core.config import settings
from app.core.response import success

router = APIRouter(prefix="/api/v1/meta", tags=["meta"])


@router.get("")
async def meta():
    """Return key contract / program addresses used by the admin frontend.

    Legacy Endless contracts have been replaced by Solana program IDs.
    Fields are kept identical to the old admin backend so existing pages
    continue to compile.
    """
    program_id = settings.solana_program_id or ""
    adminevent_id = getattr(settings, "solana_adminevent_program_id", None) or program_id
    champion_id = getattr(settings, "solana_champion_program_id", None) or program_id
    return success(
        {
            "contract_addr": program_id,
            "adminevent_addr": adminevent_id,
            "champion_addr": champion_id,
        }
    )
