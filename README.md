# WaysCase

WaysCase is a Telegram Mini App for browsing real Telegram Gifts.

## Current implementation

- React/Vite Mini App with a responsive gift catalogue, search, filters and gift detail cards.
- FastAPI backend reads the live gift list from Telegram Bot API `getAvailableGifts`.
- Gift sticker thumbnails are served through the backend; the bot token is never sent to the browser.
- The catalogue displays the actual Telegram gift records returned to the bot. It does not invent names, collections, rarity tiers or ownership.
- The app is a read-only catalogue. It has no paid random cases, betting, cash-out, purchase or paid upgrade flows.

**API scope:** `getAvailableGifts` returns gifts that the bot can send. It is not a complete catalogue of unique collectible gifts and does not prove that a Telegram user owns a gift. The frontend explicitly communicates this limitation.

## Requirements

- Node.js 20+
- Python 3.11+
- Telegram bot token

## Frontend

```bash
cd web
npm install
npm run build
```

Deploy the contents of `web/dist` to the HTTPS domain configured for the Telegram Mini App. Configure the web server to proxy `/api/` requests to the FastAPI service.

## Backend API

```bash
cd bot
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export BOT_TOKEN="your-telegram-bot-token"
uvicorn api:app --host 0.0.0.0 --port 8000
```

On Windows PowerShell, use `$env:BOT_TOKEN="your-telegram-bot-token"`.

Endpoints:
- `GET /api/health`
- `GET /api/gifts`
- `GET /api/sticker/{file_id}`

Keep `BOT_TOKEN` only in the backend environment. Never add it to Vite variables or frontend source.

## Telegram bot

The existing aiogram bot remains a separate process. Set `BOT_TOKEN` and `WEBAPP_URL=https://wayscase.ru/` in `bot/.env`, then run `python app.py`.

## Deployment note

Both the frontend and API must be deployed. Serving only `web/dist` is not enough: the catalogue requires the backend API. Configure a reverse proxy so `https://wayscase.ru/api/... ` reaches the FastAPI service.
