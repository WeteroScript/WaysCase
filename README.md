# WaysCase

Telegram Mini App for exploring collectible Telegram Gift model variants.

## Current application

- Telegram bot /start opens the Mini App.
- Telegram initData is verified on the server before a personal profile, inventory, and balances are returned.
- Ten collections use model metadata and SVG previews from the independent Gift Changes catalogue.
- Each collection has a horizontal roulette-style reveal animation.
- Each collection has a free random gift draw once per UTC day. Gift types in that case have equal odds; model variants within the selected gift type are selected uniformly.
- The available collection contents and odds are shown before opening.
- Each free opening adds 10 internal Stars points and 1 internal TON point. The point balances are not spent on openings.
- The profile has a one-time claim for 10,000 internal Stars points. The claim is stored server-side and cannot be repeated for the same Telegram account.
- Gift entries, balances, and progress are saved to the persistent JSON store under /data.

## Important distinction

Stars and TON shown by WaysCase are internal non-transferable progression points. They are not Telegram Stars or Toncoin, cannot be purchased, transferred, withdrawn, exchanged, or sold.

The random draw is free. There are no deposits, wagers, paid random rewards, or cash-outs. Gift records in the WaysCase inventory are collection records for the Mini App; they do not mint, transfer, or prove ownership of an NFT in Telegram or on the TON blockchain. The app does not offer gift sale or exchange for value.

Gift model data and SVG previews are supplied by the independent Gift Changes project (https://t.me/GiftChangesAPI). Gift Changes is not Telegram. The upstream catalogue must be reachable for live model variants and previews.

## Environment

- BOT_TOKEN: Telegram bot token already configured in Bothost.
- TELEGRAM_BOT_TOKEN: accepted as an alternative variable name.
- WEBAPP_URL: public HTTPS address of this Mini App.
- PORT: HTTP port (default 3000).
- DATA_DIR: persistent application data directory (default /data in Docker).

Do not commit tokens or .env files.

## Bothost deployment

Build the included Dockerfile and expose port 3000. The image declares /data as a volume so WaysCase can store its database outside the application filesystem. If Bothost offers persistent volumes, mount one at /data; without persistent storage provided by the host, data may be lost when the container is replaced.

The bot and web application run in the same Node process. The app starts Telegram long polling after the database is ready. Logs include startup state, Telegram authorization, webhook state, polling errors, incoming commands, and successful /start replies.

- GET /health reports application and bot status.
- GET /api/catalog returns collection and model metadata.
- GET /api/me returns the verified Telegram user's balances, inventory, and progress.
- POST /api/claim-starter-stars grants 10,000 internal Stars once per Telegram account.
- POST /api/open records one free random gift draw for a collection per UTC day.

## Local validation

Run node --check server.mjs and start the app with BOT_TOKEN, WEBAPP_URL, and DATA_DIR configured. Open the Mini App from the Telegram bot so that Telegram supplies signed initData.
