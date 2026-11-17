import os
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
API_ROOT = f"https://api.telegram.org/bot{BOT_TOKEN}"
FILE_ROOT = f"https://api.telegram.org/file/bot{BOT_TOKEN}"

app = FastAPI(title="WaysCase Telegram Gifts API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "WaysCase"}

@app.get("/api/gifts")
async def available_gifts() -> dict[str, Any]:
    if not BOT_TOKEN:
        raise HTTPException(status_code=503, detail="BOT_TOKEN is not configured")
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(f"{API_ROOT}/getAvailableGifts")
        response.raise_for_status()
        payload = response.json()
    if not payload.get("ok"):
        raise HTTPException(status_code=502, detail="Telegram Bot API request failed")
    result = []
    for gift in payload.get("result", {}).get("gifts", []):
        sticker = gift.get("sticker", {})
        thumb = sticker.get("thumbnail") or sticker
        file_id = thumb.get("file_id")
        result.append({
            "id": gift.get("id"),
            "name": "Telegram Gift",
            "stars": gift.get("star_count", 0),
            "premium": bool(gift.get("is_premium")),
            "limited": "total_count" in gift,
            "total": gift.get("total_count"),
            "remaining": gift.get("remaining_count"),
            "upgradeStars": gift.get("upgrade_star_count"),
            "emoji": sticker.get("emoji"),
            "stickerFormat": sticker.get("format"),
            "imageUrl": f"/api/sticker/{file_id}" if file_id else None,
        })
    return {
        "gifts": result,
        "source": "Telegram Bot API getAvailableGifts",
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

@app.get("/api/sticker/{file_id}")
async def sticker_image(file_id: str) -> Response:
    if not BOT_TOKEN:
        raise HTTPException(status_code=503, detail="BOT_TOKEN is not configured")
    async with httpx.AsyncClient(timeout=20) as client:
        meta_response = await client.get(f"{API_ROOT}/getFile", params={"file_id": file_id})
        meta_response.raise_for_status()
        meta = meta_response.json()
        if not meta.get("ok"):
            raise HTTPException(status_code=404, detail="Telegram sticker not found")
        file_path = meta["result"]["file_path"]
        image_response = await client.get(f"{FILE_ROOT}/{file_path}")
        image_response.raise_for_status()
    content_type = image_response.headers.get("content-type", "application/octet-stream")
    return Response(content=image_response.content, media_type=content_type, headers={"Cache-Control": "public, max-age=3600"})
