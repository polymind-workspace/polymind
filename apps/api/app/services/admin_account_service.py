"""Admin account service."""

from __future__ import annotations

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, NotFoundError
from app.db.session import get_db
from app.models import AdminAccount


class AdminAccountService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_accounts(self) -> list[dict]:
        result = await self.session.execute(
            select(AdminAccount).order_by(AdminAccount.created_at.desc())
        )
        return [self._serialize_account(a) for a in result.scalars().all()]

    async def create_account(
        self,
        *,
        address: str,
        added_by: str,
        nickname: str | None = None,
        label: str | None = None,
        permissions: list[str] | None = None,
    ) -> dict:
        existing = await self.session.execute(
            select(AdminAccount).where(AdminAccount.address == address)
        )
        if existing.scalar_one_or_none() is not None:
            raise BadRequestError("admin account already exists")

        account = AdminAccount(
            address=address,
            nickname=nickname,
            label=label,
            added_by=added_by,
            permissions=permissions or [],
        )
        self.session.add(account)
        await self.session.commit()
        await self.session.refresh(account)
        return self._serialize_account(account)

    async def update_account(
        self,
        account_id: int,
        updates: dict,
    ) -> dict:
        account = await self._get_account_by_id(account_id)
        if not account:
            raise NotFoundError("admin account not found")

        allowed = {"nickname", "label", "permissions"}
        for key, value in updates.items():
            if key in allowed:
                setattr(account, key, value)

        await self.session.commit()
        await self.session.refresh(account)
        return self._serialize_account(account)

    async def delete_account(self, account_id: int) -> None:
        account = await self._get_account_by_id(account_id)
        if not account:
            raise NotFoundError("admin account not found")

        await self.session.delete(account)
        await self.session.commit()

    async def _get_account_by_id(self, account_id: int) -> AdminAccount | None:
        result = await self.session.execute(
            select(AdminAccount).where(AdminAccount.id == account_id)
        )
        return result.scalar_one_or_none()

    def _serialize_account(self, account: AdminAccount) -> dict:
        return {
            "id": account.id,
            "address": account.address,
            "nickname": account.nickname,
            "label": account.label,
            "added_by": account.added_by,
            "permissions": account.permissions or [],
            "created_at": account.created_at.isoformat() if account.created_at else None,
            "updated_at": account.updated_at.isoformat() if account.updated_at else None,
        }


def get_admin_account_service(
    session: AsyncSession = Depends(get_db),
) -> AdminAccountService:
    return AdminAccountService(session)
