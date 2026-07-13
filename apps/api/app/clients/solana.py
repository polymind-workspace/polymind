"""Solana RPC client."""

import json
import logging
from typing import Any

from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Commitment
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.signature import Signature
from solders.system_program import TransferParams, transfer
from solders.transaction import Transaction

from app.core.config import settings

logger = logging.getLogger(__name__)


class SignatureNotFoundError(Exception):
    """Raised when a pagination signature is no longer available on chain."""


class SolanaClient:
    """Async wrapper around solana-py AsyncClient for confirmation and transfers."""

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

    async def send_native_transfer(
        self,
        *,
        sender_keypair: Keypair,
        recipient_address: str,
        amount_lamports: int,
    ) -> str:
        """Sign and send a native SOL transfer. Returns the tx signature."""
        recipient = Pubkey.from_string(recipient_address)
        sender = sender_keypair.pubkey()
        blockhash_resp = await self.client.get_latest_blockhash()
        blockhash = blockhash_resp.value.blockhash

        ix = transfer(
            TransferParams(from_pubkey=sender, to_pubkey=recipient, lamports=amount_lamports)
        )
        tx = Transaction.new_signed_with_payer(
            [ix],
            payer=sender,
            signing_keypairs=[sender_keypair],
            recent_blockhash=blockhash,
        )

        resp = await self.client.send_transaction(tx)
        if resp.value is None:
            raise RuntimeError("failed to send transaction")
        return str(resp.value)

    async def verify_native_transfer(
        self,
        signature: str,
        *,
        recipient_address: str,
        amount_lamports: int,
    ) -> bool:
        """Verify a native SOL transfer reached the expected recipient/amount."""
        tx_json = await self.get_transaction(signature)
        if tx_json is None:
            return False

        meta = tx_json.get("meta", {})
        if meta.get("err") is not None:
            return False

        message = tx_json["transaction"]["message"]
        account_keys = message.get("accountKeys", [])
        try:
            recipient_idx = account_keys.index(recipient_address)
        except ValueError:
            return False

        post_balances = meta.get("postBalances", [])
        pre_balances = meta.get("preBalances", [])
        if len(post_balances) <= recipient_idx or len(pre_balances) <= recipient_idx:
            return False

        balance_change = post_balances[recipient_idx] - pre_balances[recipient_idx]
        return balance_change >= amount_lamports

    async def get_signatures_for_address(
        self,
        account: str,
        before: str | None = None,
        until: str | None = None,
        limit: int = 1000,
        commitment: Commitment = Commitment("confirmed"),
    ) -> list[str]:
        """Fetch transaction signatures for an account, paginated.

        Args:
            account: base58 account/program address.
            before: signature to search backwards from (newer).
            until: signature to search until (older); results will be older than this.
            limit: max signatures per request (Solana max 1000).
            commitment: confirmation level.

        Returns:
            List of signature strings, ordered newest-first (Solana default).
        """
        pubkey = Pubkey.from_string(account)
        before_sig = Signature.from_string(before) if before else None
        until_sig = Signature.from_string(until) if until else None

        resp = await self.client.get_signatures_for_address(
            pubkey,
            before=before_sig,
            until=until_sig,
            limit=limit,
            commitment=commitment,
        )

        # solana-py + httpx2 can return a raw RPC error code as an int when the
        # `until` signature no longer exists (e.g., localnet was reset). Detect
        # that case and raise a dedicated exception so the caller can reset its
        # cursor instead of retrying forever.
        if not hasattr(resp, "value"):
            if until:
                tx_resp = await self.client.get_transaction(
                    Signature.from_string(until),
                    max_supported_transaction_version=0,
                )
                if tx_resp.value is None:
                    raise SignatureNotFoundError(
                        f"pagination signature {until} not found on chain; cursor may be stale"
                    )
            logger.warning("Unexpected get_signatures_for_address response: %r", resp)
            return []

        if resp.value is None:
            return []
        return [str(item.signature) for item in resp.value]

    async def get_transaction(self, signature: str) -> dict[str, Any] | None:
        """Fetch transaction details, if available."""
        sig = Signature.from_string(signature)
        resp = await self.client.get_transaction(
            sig,
            max_supported_transaction_version=0,
        )
        if resp.value is None:
            return None
        return json.loads(resp.value.to_json())

    async def close(self) -> None:
        await self.client.close()


def get_solana_client() -> SolanaClient:
    """Dependency factory for SolanaClient."""
    return SolanaClient()
