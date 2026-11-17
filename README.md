# WaysCase

Telegram Mini App + Telegram bot for a collectible NFT-gift showcase.

## Current scope
- Personalized Telegram `/start` greeting with a Mini App button.
- Responsive React/Vite Mini App.
- Ten fixed NFT-gift catalogues with disclosed contents.
- Demo inventory, profile, one-time demo-points counter, model preview and animated flight showroom.

Demo points are not Telegram Stars or TON. They have no monetary value and cannot be purchased, transferred, wagered, or withdrawn. This prototype does not contain paid random rewards, betting, cash-out, or prize upgrades.

## Requirements
- Node.js 20+
- Python 3.11+
- Telegram bot token
- Public HTTPS URL for the deployed Mini App

## Mini App
```bash
cd web
npm install
npm run dev
```

## Bot
```bash
cd bot
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Set `BOT_TOKEN` and `WEBAPP_URL` in `.env`, then run `python app.py`.
On Windows PowerShell activate with `.venv\\Scripts\\Activate.ps1`.

## Layout
- `web/` — React Mini App
- `bot/` — aiogram bot

## Next engineering stage
Add persistent API/database storage, server-side Telegram `initData` verification, authoritative ownership records, and read-only Telegram Gift / TON NFT metadata integration. Client-side Telegram identity and localStorage are not proof of ownership.
