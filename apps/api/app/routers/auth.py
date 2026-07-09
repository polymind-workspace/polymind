"""Authentication routers for wallet sign-in."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from solders.pubkey import Pubkey
from solders.signature import Signature
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import BadRequestError, UnauthorizedError
from app.core.response import success
from app.db.session import get_db
from app.dependencies.auth import (
    consume_login_nonce,
    create_admin_jwt,
    create_user_jwt,
    generate_nonce,
    generate_siws_message,
    get_current_user,
    require_permission,
    store_login_nonce,
)
from app.models import AdminAccount, User

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class NonceRequest(BaseModel):
    address: str = Field(..., min_length=32, max_length=44)


class NonceResponse(BaseModel):
    nonce: str
    message: str


class VerifyRequest(BaseModel):
    address: str = Field(..., min_length=32, max_length=44)
    nonce: str
    message: str
    signature: str = Field(..., min_length=64, max_length=256)


class VerifyResponse(BaseModel):
    token: str
    expires_at: int


class MeResponse(BaseModel):
    address: str
    nickname: str | None
    avatar: str | None
    is_admin: bool


def _parse_signature(signature: str) -> Signature:
    """Parse a hex or base58 signature string into a Solders Signature."""
    raw = signature.strip()
    try:
        if len(raw) == 128:
            return Signature.from_bytes(bytes.fromhex(raw))
    except ValueError:
        pass
    try:
        return Signature.from_string(raw)
    except ValueError as exc:
        raise BadRequestError("invalid signature format") from exc


def _verify_siws_signature(address: str, message: str, signature: str) -> None:
    try:
        pubkey = Pubkey.from_string(address)
        sig = _parse_signature(signature)
        if not sig.verify(pubkey, message.encode("utf-8")):
            raise UnauthorizedError("signature verification failed")
    except Exception as exc:
        if isinstance(exc, UnauthorizedError):
            raise
        raise UnauthorizedError("signature verification failed") from exc


@router.post("/nonce")
async def create_user_nonce(
    body: NonceRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Issue a SIWS nonce for user login."""
    nonce = generate_nonce()
    message = generate_siws_message(
        domain="poly-mind.ai",
        address=body.address,
        nonce=nonce,
        statement="Sign in to PolyMind",
        chain_id=settings.solana_cluster,
    )
    await store_login_nonce(db, body.address, nonce)
    return success(data=NonceResponse(nonce=nonce, message=message).model_dump())


@router.post("/verify")
async def verify_user_login(
    body: VerifyRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Verify a SIWS signature and issue a user JWT."""
    if not await consume_login_nonce(db, body.address, body.nonce):
        raise UnauthorizedError("nonce invalid or expired")

    _verify_siws_signature(body.address, body.message, body.signature)

    token, exp = create_user_jwt(body.address)
    return success(data=VerifyResponse(token=token, expires_at=exp).model_dump())


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)) -> dict:
    """Return the currently authenticated user."""
    return success(
        data=MeResponse(
            address=user.address,
            nickname=user.nickname,
            avatar=user.avatar,
            is_admin=user.is_admin,
        ).model_dump()
    )


@router.post("/admin/nonce")
async def create_admin_nonce(
    body: NonceRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Issue a SIWS nonce for admin login."""
    nonce = generate_nonce()
    message = generate_siws_message(
        domain="admin.poly-mind.ai",
        address=body.address,
        nonce=nonce,
        statement="Sign in to PolyMind Admin",
        chain_id=settings.solana_cluster,
    )
    await store_login_nonce(db, body.address, nonce)
    return success(data=NonceResponse(nonce=nonce, message=message).model_dump())


@router.post("/admin/verify")
async def verify_admin_login(
    body: VerifyRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Verify a SIWS signature and issue an admin JWT."""
    if not await consume_login_nonce(db, body.address, body.nonce):
        raise UnauthorizedError("nonce invalid or expired")

    _verify_siws_signature(body.address, body.message, body.signature)

    result = await db.execute(select(AdminAccount).where(AdminAccount.address == body.address))
    if result.scalar_one_or_none() is None:
        raise UnauthorizedError("address is not an admin")

    token, exp = create_admin_jwt(body.address)
    return success(data=VerifyResponse(token=token, expires_at=exp).model_dump())


@router.get("/admin/me", dependencies=[Depends(require_permission("admin:me"))])
async def get_admin_me(account: AdminAccount = Depends(require_permission("admin:me"))) -> dict:
    """Return the currently authenticated admin."""
    return success(
        data={
            "address": account.address,
            "nickname": account.nickname,
            "label": account.label,
            "permissions": account.permissions,
        }
    )
