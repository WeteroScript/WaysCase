# WaysCase

Telegram Mini App showcase for collectible Telegram gifts.

## Included
- Telegram /start bot with Mini App button.
- Responsive gift catalog with ten curated collections.
- Preview-only rocket animation and model styling.
- Local demo inventory; no transfers or ownership claims.
- Node.js server and Telegram Bot API long polling run in the same process on port 3000.

## Safety and demo boundaries
This is a non-monetary showcase. There are no Stars/TON deposits, wagers, paid random rewards, cash-outs, purchases, withdrawals, or transfers. Collection contents are displayed in advance. The flight is decorative only.

## Environment
- BOT_TOKEN: Telegram bot token (required for bot replies)
- TELEGRAM_BOT_TOKEN: accepted as an alternative environment variable name
- WEBAPP_URL: public HTTPS Mini App URL (defaults to the Bothost app URL)
- PORT: HTTP port (default 3000)

Do not commit real tokens or .env files.

## Bothost
Build from the included Dockerfile, expose port 3000, set BOT_TOKEN and WEBAPP_URL, then deploy. Health endpoint: /health. The web server and Telegram bot run in the same Node process, so starting `node server.mjs` also starts the bot. Logs include token presence (never the token itself), Telegram authorization, webhook state, long-polling, incoming messages, and successful `/start` replies. `/health` reports the bot state. If it reports `missing_token`, add `BOT_TOKEN` in Bothost. If it reports `unauthorized`, replace the token. If logs show `polling_conflict` or API error 409, stop other instances using the same token.
