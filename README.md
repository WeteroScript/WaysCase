# WaysCase

Telegram Mini App showcase for collectible Telegram gifts.

## Included
- Telegram /start bot with Mini App button.
- Responsive gift catalog with ten curated collections.
- Preview-only rocket animation and model styling.
- Local demo inventory; no transfers or ownership claims.
- Node.js server on port 3000 and aiogram bot, supervised in one Docker container.

## Safety and demo boundaries
This is a non-monetary showcase. There are no Stars/TON deposits, wagers, paid random rewards, cash-outs, purchases, withdrawals, or transfers. Collection contents are displayed in advance. The flight is decorative only.

## Environment
- BOT_TOKEN: Telegram bot token (required for bot process)
- WEBAPP_URL: public HTTPS Mini App URL
- PORT: HTTP port (default 3000)

Do not commit real tokens or .env files.

## Bothost
Build from the included Dockerfile, expose port 3000, set BOT_TOKEN and WEBAPP_URL, then deploy. Health endpoint: /health.
