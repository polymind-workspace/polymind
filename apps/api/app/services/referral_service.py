"""Referral service."""

from __future__ import annotations

import hashlib

from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.exceptions import BadRequestError, NotFoundError
from app.db.session import get_db
from app.models import Config, Referral, ReferralReward, User
from app.utils.token import format_token_amount

DEFAULT_MAX_INVITEES = 100


class ReferralService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @staticmethod
    def generate_invite_code(address: str) -> str:
        """Generate a deterministic short invite code from a Solana address.

        Format: first 8 chars of address (uppercase) + 2-char checksum.
        """
        prefix = address[:8].upper()
        checksum = hashlib.sha256(address.encode("utf-8")).hexdigest()[:2].upper()
        return f"{prefix}{checksum}"

    async def get_invite_code(self, user_address: str) -> dict:
        result = await self.session.execute(
            select(User).where(User.address == user_address)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise NotFoundError("user not found")

        code = user.invite_code or self.generate_invite_code(user.address)
        if not user.invite_code:
            user.invite_code = code
            await self.session.commit()

        return {"code": code, "address": user.address}

    async def get_referral_summary(self, user_address: str) -> dict:
        code_result = await self.get_invite_code(user_address)
        invite_code = code_result["code"]

        stmt = select(func.count(Referral.id)).where(Referral.inviter_address == user_address)
        result = await self.session.execute(stmt)
        invitee_count = result.scalar() or 0

        pending_stmt = (
            select(func.sum(ReferralReward.amount))
            .join(Referral, ReferralReward.referral_id == Referral.id)
            .where(Referral.inviter_address == user_address)
            .where(ReferralReward.status == "pending")
        )
        pending_result = await self.session.execute(pending_stmt)
        pending = pending_result.scalar() or 0

        paid_stmt = (
            select(func.sum(ReferralReward.amount))
            .join(Referral, ReferralReward.referral_id == Referral.id)
            .where(Referral.inviter_address == user_address)
            .where(ReferralReward.status == "paid")
        )
        paid_result = await self.session.execute(paid_stmt)
        paid = paid_result.scalar() or 0

        return {
            "code": invite_code,
            "invitee_count": invitee_count,
            "pending_rewards": format_token_amount(pending),
            "paid_rewards": format_token_amount(paid),
        }

    async def bind_inviter(
        self,
        *,
        invitee_address: str,
        invite_code: str,
    ) -> dict:
        result = await self.session.execute(
            select(User).where(User.address == invitee_address)
        )
        invitee = result.scalar_one_or_none()
        if not invitee:
            raise NotFoundError("user not found")

        if invitee.inviter_id is not None:
            raise BadRequestError("inviter already bound")

        inviter_result = await self.session.execute(
            select(User).where(User.invite_code == invite_code)
        )
        inviter = inviter_result.scalar_one_or_none()
        if not inviter:
            # Fallback: try to match a deterministic code for any user.
            inviter = await self._find_user_by_deterministic_code(invite_code)
        if not inviter:
            raise NotFoundError("invalid invite code")

        if inviter.address == invitee_address:
            raise BadRequestError("cannot invite yourself")

        if await self._would_create_cycle(inviter.id, invitee_address):
            raise BadRequestError("circular referral not allowed")

        max_invitees = await self._max_invitees()
        current_count_result = await self.session.execute(
            select(func.count(Referral.id)).where(Referral.inviter_address == inviter.address)
        )
        if (current_count_result.scalar() or 0) >= max_invitees:
            raise BadRequestError("inviter has reached the maximum number of invitees")

        invitee.inviter_id = inviter.id
        referral = Referral(
            inviter_address=inviter.address,
            invitee_address=invitee.address,
            invite_code_used=invite_code,
            status="active",
        )
        self.session.add(referral)
        await self.session.commit()
        await self.session.refresh(referral)

        return {
            "inviter_address": inviter.address,
            "invitee_address": invitee.address,
            "invite_code": invite_code,
            "status": referral.status,
        }

    async def get_referral_rewards(
        self,
        user_address: str,
        *,
        page: int = 1,
        limit: int = 24,
    ) -> dict:
        stmt = (
            select(ReferralReward)
            .options(joinedload(ReferralReward.referral))
            .join(Referral, ReferralReward.referral_id == Referral.id)
            .where(Referral.inviter_address == user_address)
            .order_by(ReferralReward.created_at.desc())
        )

        total_result = await self.session.execute(
            select(func.count()).select_from(stmt.subquery())
        )
        total = total_result.scalar() or 0

        stmt = stmt.offset((page - 1) * limit).limit(limit)
        result = await self.session.execute(stmt)
        items = [
            {
                "id": r.id,
                "referral_id": r.referral_id,
                "invitee_address": r.referral.invitee_address if r.referral else None,
                "market_id": r.market_id,
                "amount": format_token_amount(r.amount),
                "status": r.status,
                "tx_signature": r.tx_signature,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "paid_at": r.paid_at.isoformat() if r.paid_at else None,
            }
            for r in result.unique().scalars().all()
        ]

        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "hasMore": page * limit < total,
        }

    async def _find_user_by_deterministic_code(self, code: str) -> User | None:
        """Find a user whose deterministic invite code matches the input."""
        result = await self.session.execute(select(User))
        for user in result.scalars().all():
            if self.generate_invite_code(user.address) == code:
                return user
        return None

    async def _would_create_cycle(self, inviter_id: int, invitee_address: str) -> bool:
        """Detect whether binding would create a referral cycle."""
        visited = {inviter_id}
        current_id = inviter_id
        for _ in range(100):  # safety limit
            result = await self.session.execute(
                select(User).where(User.id == current_id)
            )
            user = result.scalar_one_or_none()
            if not user or not user.inviter_id:
                return False
            if user.address == invitee_address:
                return True
            if user.inviter_id in visited:
                return False
            visited.add(user.inviter_id)
            current_id = user.inviter_id
        return False

    async def _max_invitees(self) -> int:
        result = await self.session.execute(
            select(Config).where(Config.key == "invite.max_invitees")
        )
        config = result.scalar_one_or_none()
        if config and isinstance(config.value, dict):
            return int(config.value.get("value", DEFAULT_MAX_INVITEES))
        if config and isinstance(config.value, int):
            return config.value
        return DEFAULT_MAX_INVITEES


def get_referral_service(session: AsyncSession = Depends(get_db)) -> ReferralService:
    return ReferralService(session)
