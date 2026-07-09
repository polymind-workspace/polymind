"""Authentication and authorization dependencies."""

from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from fastapi import Depends, Header
from fastapi.security import HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.db.session import get_db
from app.models import AdminAccount, LoginNonce, User

_bearer_scheme = HTTPBearer(auto_error=False)


def _extract_bearer(authorization: str | None) -> str | None:
    if not authorization:
        return None
    if authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return authorization.strip() or None


def _decode_jwt(token: str, secret: str, audience: str) -> dict[str, Any]:
    try:
        return jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            issuer="polymind-api",
            audience=audience,
            options={"require": ["sub", "exp", "iat", "iss", "aud"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise UnauthorizedError("token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise UnauthorizedError("invalid token") from exc


def create_user_jwt(address: str) -> tuple[str, int]:
    """Issue a user access token. Returns (token, expires_at timestamp)."""
    if not settings.jwt_secret:
        raise RuntimeError("JWT_SECRET is not configured")
    now = int(datetime.now(UTC).timestamp())
    exp = now + 7 * 24 * 3600  # 7 days
    payload = {
        "sub": address,
        "iss": "polymind-api",
        "aud": "polymind-user",
        "iat": now,
        "exp": exp,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
    return token, exp


def create_admin_jwt(address: str) -> tuple[str, int]:
    """Issue an admin access token. Returns (token, expires_at timestamp)."""
    if not settings.admin_jwt_secret:
        raise RuntimeError("ADMIN_JWT_SECRET is not configured")
    now = int(datetime.now(UTC).timestamp())
    exp = now + 4 * 3600  # 4 hours
    payload = {
        "sub": address,
        "iss": "polymind-api",
        "aud": "polymind-admin",
        "iat": now,
        "exp": exp,
    }
    token = jwt.encode(payload, settings.admin_jwt_secret, algorithm="HS256")
    return token, exp


def _decode_user_jwt(token: str) -> dict[str, Any]:
    if not settings.jwt_secret:
        raise RuntimeError("JWT_SECRET is not configured")
    return _decode_jwt(token, settings.jwt_secret, "polymind-user")


def _decode_admin_jwt(token: str) -> dict[str, Any]:
    if not settings.admin_jwt_secret:
        raise RuntimeError("ADMIN_JWT_SECRET is not configured")
    return _decode_jwt(token, settings.admin_jwt_secret, "polymind-admin")


async def _get_or_create_user(db: AsyncSession, address: str) -> User:
    result = await db.execute(select(User).where(User.address == address))
    user = result.scalar_one_or_none()
    if not user:
        user = User(
            address=address,
            nickname=f"User {address[:8]}",
            invite_code=address[:8].upper(),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user


async def get_current_user(
    authorization: str = Header(default=""),
    x_wallet_address: str | None = Header(default=None, alias="X-Wallet-Address"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve current user from Authorization header.

    In debug mode, X-Wallet-Address may be used as a development bypass.
    In production, only valid user JWTs are accepted.
    """
    if settings.debug and x_wallet_address:
        return await _get_or_create_user(db, x_wallet_address.strip())

    token = _extract_bearer(authorization)
    if not token:
        raise UnauthorizedError("Missing authentication")

    payload = _decode_user_jwt(token)
    address = payload["sub"]
    return await _get_or_create_user(db, address)


async def get_current_user_optional(
    authorization: str = Header(default=""),
    x_wallet_address: str | None = Header(default=None, alias="X-Wallet-Address"),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Optional current user. Returns None if no valid auth is provided."""
    try:
        return await get_current_user(authorization, x_wallet_address, db)
    except UnauthorizedError:
        return None


async def get_admin_account_optional(
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    """Return the admin account if a valid admin JWT is provided, else None."""
    token = _extract_bearer(authorization)
    if not token:
        return None
    try:
        payload = _decode_admin_jwt(token)
    except UnauthorizedError:
        return None

    result = await db.execute(
        select(AdminAccount).where(AdminAccount.address == payload["sub"])
    )
    return result.scalar_one_or_none()


def require_permission(*permissions: str):
    async def _checker(
        authorization: str = Header(default=""),
        db: AsyncSession = Depends(get_db),
    ):
        account = await get_admin_account_optional(authorization, db)
        if account is None:
            raise UnauthorizedError("Missing authentication")

        perms = set(account.permissions or [])
        if "*" in perms:
            return account

        for p in permissions:
            if p not in perms:
                raise ForbiddenError(f"Missing permission: {p}")
        return account

    return _checker


# ---- SIWS nonce helpers used by auth router / service ----


def generate_siws_message(
    *,
    domain: str,
    address: str,
    nonce: str,
    statement: str,
    chain_id: str = "devnet",
    ttl_seconds: int | None = None,
) -> str:
    """Build a SIWS-compatible sign-in message."""
    ttl = ttl_seconds or settings.nonce_ttl_seconds
    now = datetime.now(UTC)
    issued_at = now.isoformat().replace("+00:00", "Z")
    expires_at = (now + timedelta(seconds=ttl)).isoformat().replace("+00:00", "Z")
    return (
        f"{domain} wants you to sign in with your Solana account:\n"
        f"{address}\n"
        f"\n"
        f"URI: https://{domain}\n"
        f"Version: 1\n"
        f"Chain ID: {chain_id}\n"
        f"Nonce: {nonce}\n"
        f"Issued At: {issued_at}\n"
        f"Expiration Time: {expires_at}\n"
        f"Statement: {statement}"
    )


def generate_nonce() -> str:
    return secrets.token_hex(16)


async def store_login_nonce(
    db: AsyncSession,
    address: str,
    nonce: str,
    ttl_seconds: int | None = None,
) -> None:
    """Store a fresh login nonce for the given address."""
    ttl = ttl_seconds or settings.nonce_ttl_seconds
    expires_at = datetime.now(UTC) + timedelta(seconds=ttl)
    db.add(
        LoginNonce(
            nonce=nonce,
            address=address.lower(),
            expires_at=expires_at,
            used=False,
        )
    )
    await db.commit()


async def consume_login_nonce(
    db: AsyncSession,
    address: str,
    nonce: str,
) -> bool:
    """Atomically consume a nonce. Returns True iff the nonce was valid and unused."""
    from sqlalchemy import update

    result = await db.execute(
        update(LoginNonce)
        .where(
            LoginNonce.nonce == nonce,
            LoginNonce.address == address.lower(),
            LoginNonce.used.is_(False),
            LoginNonce.expires_at > datetime.now(UTC),
        )
        .values(used=True)
    )
    await db.commit()
    return getattr(result, "rowcount", 0) == 1
