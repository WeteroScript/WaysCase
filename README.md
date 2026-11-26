# WaysCase

Telegram Mini App with ten gift cases and a personal rocket game. Balances and inventory are internal game records; there are no purchases, transfers or withdrawals.

## Cases

Cases use daily **collection floors on Fragment**, not Telegram issue prices or appraisals of individual serial numbers/models. The Gifts tab shows all 22 playable gifts. The i-panel and roulette show the same dated quotes. A gift has `max(1, round(1000000 / floorTON))` tickets; an unpriced gift has zero tickets. Opening costs the weighted mean sell value in internal Stars, rounded up. The client confirms the quote version so a changed case price cannot be charged silently.

### Prices and settlement

Source: [Telegram gifts floor prices, Baltic Assets](https://balticassets.eu/en/crypto/telegram-gifts/) ([dataset](https://github.com/Atlannn/telegram-gifts-floor-price), CC BY 4.0). `lib/market.mjs` reads their daily Fragment feed via GitHub, refreshing at most hourly (5-minute retry on error). The included `lib/fragment-snapshot.json` is a subset of the 2026-11-18 dataset for offline startup. `floor_gram` is the lowest listed price including auctions, in the coin labelled TON in the app, **not** a guaranteed buy-now offer. Internal Stars are an estimate: `floor(floorTON × daily USD rate / 0.013)`. There is no exchange, marketplace purchase or external NFT transfer. A failed refresh keeps the last dated snapshot in memory. Missing listings are unpriced; quotes older than 72 hours cannot be traded.

The reveal automatically keeps the gift if dismissed. Keep or sell it immediately, or reopen it in Inventory. Sale credits internal Stars only. Upgrades consume one owned item and require a strictly higher floor; the server samples a uniform ticket in `[0, 1000000)` and wins below `floor(sourceTON / targetTON × 1000000)`. The ring animates to this ticket. Trades verify ownership and quote version and commit as one database mutation. Spent rows are hidden but retained as receipts, so retries cannot sell twice, resurrect a draw or reroll an upgrade.

WebP previews: [sendboc/Gifts-Assets](https://github.com/sendboc/Gifts-Assets/tree/b17b2072f0d760b29aba2ce5b6ad502e0a4ac44b). Original model TGS animations and the matching Compass, Honey Gold, Cozy Galaxy and Diamond posters: [TelegramGiftsAssests](https://github.com/ssamy2/TelegramGiftsAssests/tree/1eb0666fff81b63f9002004084ff0ee3a9eed10f/models). The local Lottie Web SVG light player v5.13.0 (MIT, `public/vendor/lottie-LICENSE.md`) plays them without an external CDN; reduced-motion mode uses the poster.

Case covers are original, individually themed SVGs in `public/assets/cases/series`. Old inventory records are resolved by gift ID and model name at the API boundary (`lib/gift-art.mjs`), never by a retired image URL. Unbundled variants keep their original identity and use a labelled collection preview rather than another model’s animation.

## Rocket

Claim the one-time starter balance in Profile (10,000 Stars and 500 TON points). Stake whole internal Stars, then collect before the crash. Payout includes the stake, rounded down to whole Stars. Only the server chooses the crash time and calculates the multiplier. The last round is persisted, including when the Mini App is closed. TON points are not spent.

## Run

Use Node 20+, `node --test`, then `BOT_TOKEN=… WEBAPP_URL=https://… DATA_DIR=./data node server.mjs`. Open the Mini App via the bot; personal routes verify Telegram initData. The default port is 3000. Docker includes the bot and server in one process. Mount persistent storage at `/data`; run a single server process per database. Do not commit tokens or state files.

### Bothost

Use the repository root as the build context, not `bot/`. The included Dockerfile starts `node server.mjs` directly. For a generated Node.js container, use Node 20 or later, `npm ci --omit=dev` to install and `npm start` to launch. There are no npm dependencies or frontend compilation steps; keep both `package.json` and `package-lock.json` in the deployment. A successful start serves `/health` on `PORT` (default `3000`).

`GET /health`, `GET /api/catalog` are public. Authenticated routes: `GET /api/me`, `POST /api/claim-starter-stars`, `POST /api/open` (`caseId`, UUID `requestId`, market `version`), `POST /api/sell` (`itemId`, `version`), `POST /api/upgrade` (`itemId`, `targetId`, `version`), `GET /api/rocket`, `POST /api/rocket/start` (`stake`, new UUID `id`, last round ID `previous` or null), `POST /api/rocket/cashout` (`id`). Replaying an opening request or the current round's start/cashout does not charge or credit twice.
