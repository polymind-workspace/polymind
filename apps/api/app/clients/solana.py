"""Solana RPC client."""

from typing import Any

from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Commitment
from solders.signature import Signature

from app.core.config import settings


class SolanaClient:
    """Thin async wrapper around solana-py AsyncClient for transaction confirmation."""

    def __init__(self, rpc_url: str | None = None) -> None:
        self.client = AsyncClient(rpc_url or settings.solana_rpc_url)

    async def confirm_transaction(
        self,
        signature: str,
        commitment: Commitment = Commitment("confirmed"),
    ) -> dict[str, Any]:
        """Check whether a transaction has reached the requested commitment."""
        try:
            sig = Signature.from_string(signature)
        except ValueError:
            return {"confirmed": False, "err": "invalid signature"}
        resp = await self.client.get_signature_statuses([sig])
        if resp.value is None or len(resp.value) == 0:
            return {"confirmed": False, "err": "not found"}
        status = resp.value[0]
        if status is None:
            return {"confirmed": False, "err": "not found"}
        return {
            "confirmed": status.confirmation_status == commitment,
            "err": status.err,
            "slot": status.slot,
        }

    async def get_transaction(self, signature: str) -> dict[str, Any] | None:
        """Fetch transaction details, if available."""
        sig = Signature.from_string(signature)
        resp = await self.client.get_transaction(
            sig,
            max_supported_transaction_version=0,
        )
        if resp.value is None:
            return None
        return resp.value.to_json()

    async def close(self) -> None:
        await self.client.close()


def get_solana_client() -> SolanaClient:
    """Dependency factory for SolanaClient."""
    return SolanaClient()
