"""Chat message service."""

from __future__ import annotations

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models import ChatMessage


class ChatService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_messages(
        self,
        user_address: str,
        *,
        session_id: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.user_address == user_address)
            .order_by(ChatMessage.created_at.asc())
        )
        if session_id:
            stmt = stmt.where(ChatMessage.session_id == session_id)

        stmt = stmt.offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        items = [m.to_dict() for m in result.scalars().all()]

        return {
            "items": items,
            "total": len(items),
            "limit": limit,
            "offset": offset,
        }

    async def save_message(
        self,
        *,
        user_address: str,
        role: str,
        content: str,
        session_id: str | None = None,
    ) -> dict:
        message = ChatMessage(
            user_address=user_address,
            role=role,
            content=content,
            session_id=session_id,
        )
        self.session.add(message)
        await self.session.commit()
        await self.session.refresh(message)
        return message.to_dict()

    async def clear_history(
        self,
        user_address: str,
        *,
        session_id: str | None = None,
    ) -> int:
        stmt = select(ChatMessage).where(ChatMessage.user_address == user_address)
        if session_id:
            stmt = stmt.where(ChatMessage.session_id == session_id)

        result = await self.session.execute(stmt)
        messages = result.scalars().all()
        for message in messages:
            await self.session.delete(message)
        await self.session.commit()
        return len(messages)


def get_chat_service(session: AsyncSession = Depends(get_db)) -> ChatService:
    return ChatService(session)
