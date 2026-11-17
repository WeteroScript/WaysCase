# WaysCase

Telegram Mini App for exploring collectible Telegram Gift models.

## Current application

- Telegram bot /start opens the Mini App.
- Telegram initData is verified on the server using the bot token before a personal profile, inventory, or balance is returned.
- Ten curated collections are populated with collectible model variants from the independent Gift Changes catalogue.
- Each collection has a horizontal scrolling reveal animation.
- The next item follows a fixed, visible sequence. It is not random.
- Each collection can be opened for free once per UTC day.
- Opened items, per-case progress, and internal point balances are stored server-side.
- Each free opening adds 10 internal Stars points and 1 internal TON point. Points are not spent to open a collection.
- Inventory is persistent in the /data directory.

## Important distinction

WaysCase's Stars and TON counters are internal, non-transferable progression points. They are not Telegram Stars or Toncoin, cannot be purchased, transferred, withdrawn, or exchanged.

The catalogue displays model previews of real Telegram collectible gift types. A WaysCase inventory entry is a record inside this app; it does not transfer, mint, issue, or prove ownership of an NFT in Telegram or on the TON blockchain.

Gift model data and SVG previews are supplied by the independent Gift Changes project (https://t.me/GiftChangesAPI). Gift Changes is not Telegram. The external model service must be reachable for the model previews to load.

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
- GET /api/catalog returns collection and current model metadata.
- GET /api/me returns the verified Telegram user's balances, inventory, and progress.
- POST /api/open records one free, fixed-sequence opening for a collection per UTC day.

## Local validation

Run node --check server.mjs and start the app with BOT_TOKEN, WEBAPP_URL, and DATA_DIR configured. Open the Mini App from the Telegram bot so that Telegram supplies signed initData.
