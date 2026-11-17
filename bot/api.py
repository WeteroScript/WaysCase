import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
API_ROOT = f"https://api.telegram.org/bot{BOT_TOKEN}"
FILE_ROOT = f"https://api.telegram.org/file/bot{BOT_TOKEN}"
WEB_DIST = Path(os.getenv("WEB_DIST_DIR", "/opt/wayscase/web/dist")).resolve()

logger = logging.getLogger("wayscase.api")

app = FastAPI(title="WaysCase Telegram Gifts API", version="1.1.0")


@app.middleware("http")
async def request_logging(request, call_next):
    started = time.perf_counter()
    logger.info("REQUEST START method=%s path=%s host=%s", request.method, request.url.path, request.headers.get("host", "-"))
    try:
        response = await call_next(request)
    except Exception:
        elapsed = (time.perf_counter() - started) * 1000
        logger.exception("REQUEST FAILED method=%s path=%s duration_ms=%.1f", request.method, request.url.path, elapsed)
        raise
    elapsed = (time.perf_counter() - started) * 1000
    logger.info("REQUEST END method=%s path=%s status=%s duration_ms=%.1f", request.method, request.url.path, response.status_code, elapsed)
    return response


@app.on_event("startup")
async def log_startup():
    logger.info("API STARTUP web_dist=%s exists=%s index_exists=%s bot_token_configured=%s", WEB_DIST, WEB_DIST.is_dir(), (WEB_DIST / "index.html").is_file(), bool(BOT_TOKEN))


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict[str, str]:
    logger.info("HEALTH CHECK OK")
    return {"status": "ok", "service": "WaysCase"}


@app.get("/api/gifts")
async def available_gifts() -> dict[str, Any]:
    if not BOT_TOKEN:
        raise HTTPException(status_code=503, detail="BOT_TOKEN is not configured")
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(f"{API_ROOT}/getAvailableGifts")
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Telegram Bot API is unavailable") from exc
    if not payload.get("ok"):
        raise HTTPException(status_code=502, detail="Telegram Bot API request failed")

    result = []
    for gift in payload.get("result", {}).get("gifts", []):
        sticker = gift.get("sticker", {})
        thumb = sticker.get("thumbnail") or sticker
        file_id = thumb.get("file_id")
        result.append({
            "id": gift.get("id"),
            "name": sticker.get("emoji") or f"Telegram Gift {gift.get('id', '')[:8]}",
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
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            meta_response = await client.get(
                f"{API_ROOT}/getFile", params={"file_id": file_id}
            )
            meta_response.raise_for_status()
            meta = meta_response.json()
            if not meta.get("ok"):
                raise HTTPException(status_code=404, detail="Telegram sticker not found")
            file_path = meta["result"]["file_path"]
            image_response = await client.get(f"{FILE_ROOT}/{file_path}")
            image_response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Telegram sticker service is unavailable") from exc

    content_type = image_response.headers.get("content-type", "application/octet-stream")
    return Response(
        content=image_response.content,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=3600"},
    )


@app.get("/{path:path}", include_in_schema=False)
async def frontend(path: str) -> FileResponse:
    index_file = WEB_DIST / "index.html"
    logger.info("FRONTEND REQUEST path=%r resolved_dist=%s index_exists=%s", path, WEB_DIST, index_file.is_file())
    if not index_file.is_file():
        logger.error("FRONTEND BUILD MISSING: expected %s", index_file)
        raise HTTPException(status_code=503, detail="Frontend build is missing")

    requested = (WEB_DIST / path).resolve() if path else index_file
    if requested != WEB_DIST and WEB_DIST not in requested.parents:
        raise HTTPException(status_code=404, detail="Not found")
    if requested.is_file():
        return FileResponse(requested)
    return FileResponse(index_file)
