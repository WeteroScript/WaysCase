# WaysCase

WaysCase is a Telegram Mini App for browsing real Telegram Gifts.

## Current implementation

- React/Vite Mini App with a responsive gift catalogue, search, filters and gift detail cards.
- FastAPI backend reads the live gift list from Telegram Bot API `getAvailableGifts`.
- Gift sticker thumbnails are served through the backend; the bot token is never sent to the browser.
- The catalogue displays the actual Telegram gift records returned to the bot. It does not invent collections, rarity tiers or ownership.
- The app is a read-only catalogue. It has no paid random cases, betting, cash-out, purchase or paid upgrade flows.

**API scope:** `getAvailableGifts` returns gifts that the bot can send. It is not a complete catalogue of unique collectible gifts and does not prove that a Telegram user owns a gift.

## Bothost deployment

Use the standard Bothost hostname (no custom domain):

```
https://bot-1794945234-9845-weterochina.bothost.tech/
```

In the Bothost app settings:
- Leave the custom domain field empty.
- Set the web application/container port to `3000`.
- Set `BOT_TOKEN` to the token from BotFather.
- Set `WEBAPP_URL` to the standard HTTPS hostname above, including the trailing slash.

The Docker image builds the Vite frontend and runs the frontend, FastAPI API and aiogram bot in one container. FastAPI serves the compiled frontend and handles `/api/*`, so only one public container port is needed.

### Docker build

Run from the repository root:

```bash
docker build -t wayscase .
```

### Docker run

```bash
docker run -d \
  --name wayscase \
  --restart unless-stopped \
  -p 3000:3000 \
  -e BOT_TOKEN="your-telegram-bot-token" \
  -e WEBAPP_URL="https://bot-1794945234-9845-weterochina.bothost.tech/" \
  wayscase
```

The application listens on `0.0.0.0:3000`. Bothost should terminate HTTPS and forward traffic to container port `3000`.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `BOT_TOKEN` | Yes | Telegram bot token from BotFather |
| `WEBAPP_URL` | No | Public HTTPS Mini App URL; defaults to the standard Bothost hostname above |

Keep `BOT_TOKEN` only in the server environment. Never add it to frontend source.

## Health check

- `GET /api/health` — container/API health
- `GET /api/gifts` — current gifts returned by Telegram
- `GET /api/sticker/{file_id}` — Telegram sticker image

The app itself is served at `/`. The Docker image exposes port `3000`.

## Logs

```bash
docker logs -f wayscase
```

The API and bot run as separate supervised processes in the same container. If the bot exits, Supervisor restarts it.

## Local development without Docker

### Frontend

```bash
cd web
npm install
npm run build
```

### Backend API

```bash
cd bot
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export BOT_TOKEN="your-telegram-bot-token"
uvicorn api:app --host 0.0.0.0 --port 8000
```

### Telegram bot

Set `BOT_TOKEN` and, if needed, `WEBAPP_URL` before running:

```bash
cd bot
python app.py
```
