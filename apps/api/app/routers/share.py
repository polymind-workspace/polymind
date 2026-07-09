"""Share router."""

from __future__ import annotations

import io

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse, Response
from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models import Event, User

router = APIRouter(prefix="/api/v1/share", tags=["share"])

SHARE_CARD_WIDTH = 1200
SHARE_CARD_HEIGHT = 630
BACKGROUND_COLOR = (15, 23, 42)  # slate-900
TEXT_COLOR = (255, 255, 255)
ACCENT_COLOR = (56, 189, 248)  # sky-400


@router.get("/{slug}.png")
async def share_event_card(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Generate a simple PNG share card for an event.

    MVP uses Pillow synchronously. Future versions should move this to an
    async worker and upload the result to object storage / CDN.
    """
    result = await db.execute(select(Event).where(Event.slug == slug))
    event = result.scalar_one_or_none()
    if not event:
        raise NotFoundError("event not found")

    image = Image.new(
        "RGB",
        (SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT),
        BACKGROUND_COLOR,
    )
    draw = ImageDraw.Draw(image)

    # Use default font; custom fonts can be configured later.
    try:
        title_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 72)
        subtitle_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 40)
    except OSError:
        title_font = ImageFont.load_default()
        subtitle_font = ImageFont.load_default()

    title = event.title or "PolyMind Market"
    # Wrap title roughly to fit width.
    wrapped_title = _wrap_text(draw, title, title_font, SHARE_CARD_WIDTH - 160)
    draw.text((80, 120), wrapped_title, fill=TEXT_COLOR, font=title_font)

    subtitle = "PolyMind Prediction Market"
    draw.text((80, 480), subtitle, fill=ACCENT_COLOR, font=subtitle_font)

    buf = io.BytesIO()
    image.save(buf, format="PNG")
    buf.seek(0)

    return Response(content=buf.getvalue(), media_type="image/png")


@router.get("/invite/{code}")
async def share_invite_landing(
    code: str,
    db: AsyncSession = Depends(get_db),
):
    """Return an invite landing page with Open Graph meta tags."""
    result = await db.execute(select(User).where(User.invite_code == code))
    user = result.scalar_one_or_none()

    nickname = user.nickname if user else "a friend"
    title = f"Join {nickname} on PolyMind"
    description = "Predict the future and earn rewards on PolyMind."
    image_url = "https://poly-mind.ai/og-image.png"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <meta property="og:title" content="{title}">
    <meta property="og:description" content="{description}">
    <meta property="og:image" content="{image_url}">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{title}">
    <meta name="twitter:description" content="{description}">
    <meta name="twitter:image" content="{image_url}">
</head>
<body>
    <h1>{title}</h1>
    <p>{description}</p>
    <p>Invite code: <strong>{code}</strong></p>
</body>
</html>"""
    return HTMLResponse(content=html)


def _wrap_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont,
    max_width: int,
) -> str:
    """Naive text wrapper for share cards."""
    words = text.split()
    lines = []
    current_line = []
    for word in words:
        test_line = " ".join(current_line + [word])
        bbox = draw.textbbox((0, 0), test_line, font=font)
        if bbox and (bbox[2] - bbox[0]) <= max_width:
            current_line.append(word)
        else:
            if current_line:
                lines.append(" ".join(current_line))
            current_line = [word]
    if current_line:
        lines.append(" ".join(current_line))
    return "\n".join(lines[:4])  # limit to 4 lines
