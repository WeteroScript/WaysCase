# WaysCase

Telegram Mini App with ten gift cases and a personal rocket game. Balances and inventory are internal game records; there are no purchases, transfers or withdrawals.

## Cases

Each opening costs 100–550 game Stars and awards one inventory entry. Each case lists the actual probability for every gift. `lib/gifts.json` is the editable reference table `[id, gift, model, value]`; the values are gameplay estimates, **not live market quotes**. A gift has `round(90000000 / value)` tickets. The server draws one uniform integer across the case's tickets. The catalogue and draw share the same pool and weights (`lib/catalog.mjs`).

Model previews in `public/assets/gifts` are locally bundled WebP thumbnails from [sendboc/Gifts-Assets](https://github.com/sendboc/Gifts-Assets/tree/b17b2072f0d760b29aba2ce5b6ad502e0a4ac44b), under the corresponding gift/model names. No external catalogue or image service is needed at runtime.

## Rocket

Claim the one-time starter balance in Profile (10,000 Stars and 500 TON points). Stake whole internal Stars, then collect before the crash. Payout includes the stake, rounded down to whole Stars. Only the server chooses the crash time and calculates the multiplier. The last round is persisted, including when the Mini App is closed. TON points are not spent.

## Run

Use Node 20+, `node --test`, then `BOT_TOKEN=… WEBAPP_URL=https://… DATA_DIR=./data node server.mjs`. Open the Mini App via the bot; personal routes verify Telegram initData. The default port is 3000. Docker includes the bot and server in one process. Mount persistent storage at `/data`; run a single server process per database. Do not commit tokens or state files.

`GET /health`, `GET /api/catalog` are public. Authenticated routes: `GET /api/me`, `POST /api/claim-starter-stars`, `POST /api/open` (`caseId`, UUID `requestId`), `GET /api/rocket`, `POST /api/rocket/start` (`stake`, new UUID `id`, last round ID `previous` or null), `POST /api/rocket/cashout` (`id`). Replaying an opening request or the current round's start/cashout does not charge or credit twice.
