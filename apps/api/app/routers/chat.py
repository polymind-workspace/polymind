"""Chat router."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.response import success
from app.dependencies.auth import get_current_user
from app.models import User
from app.services.chat_service import ChatService, get_chat_service

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])


class ChatMessageRequest(BaseModel):
    role: str = Field(default="user", pattern="^(user|assistant|system)$")
    content: str = Field(..., min_length=1, max_length=10000)
    session_id: str | None = Field(None, max_length=128)


class ChatHistoryResponse(BaseModel):
    items: list[dict]
    total: int
    limit: int
    offset: int


@router.post("")
async def send_chat_message(
    body: ChatMessageRequest,
    user: User = Depends(get_current_user),
    svc: ChatService = Depends(get_chat_service),
):
    """Record a chat message from the authenticated user.

    The actual AI response generation is handled by a separate service;
    this endpoint persists the message to PostgreSQL.
    """
    data = await svc.save_message(
        user_address=user.address,
        role=body.role,
        content=body.content,
        session_id=body.session_id,
    )
    return success(data=data)


@router.get("/history")
async def get_chat_history(
    session_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
    user: User = Depends(get_current_user),
    svc: ChatService = Depends(get_chat_service),
):
    data = await svc.list_messages(
        user.address,
        session_id=session_id,
        limit=limit,
        offset=offset,
    )
    return success(data=data)


@router.post("/save")
async def save_chat_message(
    body: ChatMessageRequest,
    user: User = Depends(get_current_user),
    svc: ChatService = Depends(get_chat_service),
):
    """Alias for send_chat_message for clients that prefer /chat/save."""
    data = await svc.save_message(
        user_address=user.address,
        role=body.role,
        content=body.content,
        session_id=body.session_id,
    )
    return success(data=data)


@router.delete("/history")
async def clear_chat_history(
    session_id: str | None = None,
    user: User = Depends(get_current_user),
    svc: ChatService = Depends(get_chat_service),
):
    count = await svc.clear_history(user.address, session_id=session_id)
    return success(data={"deleted": count})
