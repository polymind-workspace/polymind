from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.clients.solana import SolanaClient, get_solana_client
from app.core.response import fail, success

router = APIRouter(prefix="/api/v1/sync", tags=["sync"])


class SyncRequest(BaseModel):
    signature: str = Field(..., min_length=64, max_length=128)
    kind: str = Field(default="test_event")


@router.post("")
async def sync_transaction(
    body: SyncRequest,
    client: SolanaClient = Depends(get_solana_client),
):
    """Confirm a Solana transaction by signature.

    The Python indexer (`app.workers.indexer`) is the source of truth for event
    parsing; this endpoint only does a lightweight RPC confirmation so the
    frontend knows whether to poll the API for indexed data.
    """
    try:
        result = await client.confirm_transaction(body.signature)
    finally:
        await client.close()
    if not result.get("confirmed"):
        return fail(400, "transaction not confirmed", result)
    return success(result)
