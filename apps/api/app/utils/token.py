"""Token amount formatting utilities."""

from __future__ import annotations

MICRO_UNITS = 1_000_000


def format_token_amount(micro: int | None, decimals: int = 6) -> float:
    """Convert a micro-token amount to token units.

    Args:
        micro: Amount in the smallest token unit (e.g. micro-USDC).
        decimals: Number of decimal places the token uses. Defaults to 6 (USDC).

    Returns:
        Token-unit amount as a float.
    """
    if micro is None:
        return 0.0
    return micro / (10**decimals)


def parse_token_amount(value: float | None, decimals: int = 6) -> int:
    """Convert a token-unit amount to micro-token integer.

    Args:
        value: Amount in token units.
        decimals: Number of decimal places the token uses. Defaults to 6 (USDC).

    Returns:
        Micro-token amount as an integer.
    """
    if value is None:
        return 0
    return int(value * (10**decimals))
