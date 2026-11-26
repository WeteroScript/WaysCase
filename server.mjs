import { presentGift } from './lib/gift-art.mjs';
import { getMarket } from './lib/market.mjs';
import { trade } from './lib/trades.mjs';
import { buildCases, gifts, draw } from './lib/catalog.mjs';
import { roundView, startRound, cashOut } from './lib/rocket.mjs';
import http from 'node:http';
import { readFile, stat, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(APP_DIR, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(APP_DIR, 'data');
const DB_FILE = path.join(DATA_DIR, 'wayscase-state.json');
const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const BOT_TOKEN = (process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '').trim().replace(/^["']|["']$/g, '');
const DEFAULT_WEBAPP_URL = 'https://bot-1794953284-8098-weterochina.bothost.tech/';
function resolveWebAppUrl() {
  const configured = (process.env.WEBAPP_URL || DEFAULT_WEBAPP_URL).trim().replace(/^["']|["']$/g, '');
  try {
    const parsed = new URL(configured);
    if (parsed.protocol !== 'https:') throw new Error('Mini App URL must use HTTPS');
    return parsed.toString();
  } catch (error) {
    log('warn', 'WEBAPP_URL is invalid; using the built-in HTTPS address', error.message);
    return DEFAULT_WEBAPP_URL;
  }
}
const WEBAPP_URL = resolveWebAppUrl();
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.tgs': 'application/json',
  '.ico': 'image/x-icon',
};

const telegramStatus = {
  state: BOT_TOKEN ? 'starting' : 'missing_token',
  enabled: Boolean(BOT_TOKEN),
  username: null,
  lastError: null,
};

let database = { version: 1, users: {} };
let writeQueue = Promise.resolve();
let databaseReady = Promise.resolve();

function log(level, message, details = '') {
  const suffix = details ? ' | ' + details : '';
  console[level](new Date().toISOString() + ' | ' + level.toUpperCase() + ' | wayscase | ' + message + suffix);
}

function json(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(JSON.stringify(payload));
}

async function loadDatabase() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 1 && parsed.users && typeof parsed.users === 'object') {
      database = parsed;
    } else {
      throw new Error('Unsupported database structure');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      log('error', 'Database file could not be loaded; starting with an empty database', error.message);
      const backup = DB_FILE + '.corrupt-' + Date.now();
      try { await rename(DB_FILE, backup); } catch {}
    }
    database = { version: 1, users: {} };
    await persistDatabase();
  }
  log('info', 'Persistent collection database ready', 'file=' + DB_FILE + ' users=' + Object.keys(database.users).length);
}

async function persistDatabase(snapshot = database) {
  const tempFile = DB_FILE + '.tmp';
  await writeFile(tempFile, JSON.stringify(snapshot), { encoding: 'utf8', mode: 0o600 });
  await rename(tempFile, DB_FILE);
}

async function mutateDatabase(mutator) {
  let release;
  const previous = writeQueue;
  writeQueue = new Promise(resolve => { release = resolve; });
  await previous;
  try {
    const snapshot = structuredClone(database);
    const result = await mutator(snapshot);
    await persistDatabase(snapshot);
    database = snapshot;
    return result;
  } finally {
    release();
  }
}

function verifyTelegramInitData(rawInitData) {
  if (!BOT_TOKEN) {
    const error = new Error('Telegram authentication is not configured on the server.');
    error.status = 503;
    throw error;
  }
  if (!rawInitData || rawInitData.length > 8192) {
    const error = new Error('Open this Mini App from Telegram to sign in.');
    error.status = 401;
    throw error;
  }

  const params = new URLSearchParams(rawInitData);
  const receivedHash = params.get('hash');
  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) {
    const error = new Error('Telegram signature is missing or invalid.');
    error.status = 401;
    throw error;
  }

  const entries = Array.from(params.entries()).filter(entry => entry[0] !== 'hash');
  const keys = new Set(entries.map(entry => entry[0]));
  if (keys.size !== entries.length) {
    const error = new Error('Telegram initialization data contains duplicate fields.');
    error.status = 401;
    throw error;
  }

  const dataCheckString = entries
    .map(entry => entry[0] + '=' + entry[1])
    .sort()
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString).digest();
  const suppliedHash = Buffer.from(receivedHash, 'hex');

  if (suppliedHash.length !== calculatedHash.length || !timingSafeEqual(suppliedHash, calculatedHash)) {
    const error = new Error('Telegram initialization signature did not match.');
    error.status = 401;
    throw error;
  }

  const authDate = Number(params.get('auth_date'));
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDate) || authDate > nowSeconds + 60 || nowSeconds - authDate > 86400) {
    const error = new Error('Telegram session expired. Close and reopen the Mini App.');
    error.status = 401;
    throw error;
  }

  let user;
  try {
    user = JSON.parse(params.get('user') || '{}');
  } catch {
    const error = new Error('Telegram user data is malformed.');
    error.status = 401;
    throw error;
  }
  if (!Number.isSafeInteger(Number(user.id)) || Number(user.id) <= 0) {
    const error = new Error('Telegram user identity is unavailable.');
    error.status = 401;
    throw error;
  }
  return {
    id: String(user.id),
    firstName: String(user.first_name || 'Collector').slice(0, 80),
    username: String(user.username || '').slice(0, 80),
  };
}

function authFromRequest(req) {
  const header = String(req.headers.authorization || '');
  const raw = header.startsWith('tma ') ? header.slice(4) : String(req.headers['x-telegram-init-data'] || '');
  return verifyTelegramInitData(raw);
}

function ensureUser(db, identity) {
  if (!db.users[identity.id]) {
    db.users[identity.id] = {
      telegramId: identity.id,
      firstName: identity.firstName,
      username: identity.username,
      createdAt: new Date().toISOString(),
      balances: { stars: 0, ton: 0 },
      inventory: [],
      openCounts: {},
      lastOpenDates: {},
    };
  }
  const user = db.users[identity.id];
  user.firstName = identity.firstName;
  user.username = identity.username;
  user.balances = user.balances || { stars: 0, ton: 0 };
  user.inventory = Array.isArray(user.inventory) ? user.inventory : [];
  user.openCounts = user.openCounts || {};
  user.lastOpenDates = user.lastOpenDates || {};
  user.starterStarsClaimed = Boolean(user.starterStarsClaimed);
  user.starterTonClaimed = Boolean(user.starterTonClaimed);
  return user;
}

function userSummary(user) {
  return {
    firstName: user.firstName,
    username: user.username,
    balances: user.balances,
    inventory: user.inventory.filter(i => !i.spent).reverse().map(presentGift),
    openCounts: user.openCounts,
    lastOpenDates: user.lastOpenDates,
    starterStarsClaimed: Boolean(user.starterStarsClaimed),
    starterTonClaimed: Boolean(user.starterTonClaimed),
    totalOpens: Object.values(user.openCounts).reduce((sum, count) => sum + Number(count || 0), 0),
  };
}

async function readJsonBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk.toString('utf8');
    if (raw.length > 16384) {
      const error = new Error('Request body is too large.');
      error.status = 413;
      throw error;
    }
  }
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error('Request body must be valid JSON.');
    error.status = 400;
    throw error;
  }
}

async function telegramApi(method, payload = {}, timeoutMs = 15000) {
  const response = await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/' + method, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    const error = new Error('Telegram API ' + method + ' failed: ' + (data?.description || response.statusText));
    error.telegramCode = data?.error_code || response.status;
    error.parameters = data?.parameters || {};
    throw error;
  }
  return data.result;
}

async function sendTelegramMessage(message) {
  const chatId = message.chat?.id;
  if (!chatId) return;
  const text = message.text || '';
  if (/^\/start(?:@[_a-zA-Z0-9]+)?(?:\s|$)/i.test(text)) {
    await telegramApi('sendMessage', {
      chat_id: chatId,
      text: 'Кейсы и подарки за игровые Stars.',
      reply_markup: {
        inline_keyboard: [[{ text: 'Открыть WaysCase', web_app: { url: WEBAPP_URL } }]],
      },
      disable_web_page_preview: true,
    });
    log('info', 'Successfully replied to /start', 'chat_id=' + chatId);
  } else {
    await telegramApi('sendMessage', {
      chat_id: chatId,
      text: 'Чтобы открыть WaysCase, отправь /start и нажми кнопку приложения.',
    });
  }
}

async function runTelegramPolling() {
  if (!BOT_TOKEN) {
    telegramStatus.state = 'missing_token';
    log('warn', 'Telegram bot is disabled because BOT_TOKEN is not set.');
    return;
  }
  let offset = 0;
  let failures = 0;
  try {
    const me = await telegramApi('getMe');
    telegramStatus.username = me.username || null;
    const webhook = await telegramApi('getWebhookInfo');
    if (webhook.url) {
      await telegramApi('deleteWebhook', { drop_pending_updates: false });
      log('info', 'Removed existing Telegram webhook; pending updates preserved.');
    }
    telegramStatus.state = 'polling';
    log('info', 'Telegram authorization successful', 'bot=@' + (me.username || 'unknown'));
    log('info', 'Telegram long polling started', 'timeout=25s');
    while (true) {
      try {
        const updates = await telegramApi('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] }, 40000);
        failures = 0;
        for (const update of updates) {
          offset = update.update_id + 1;
          if (!update.message) continue;
          log('info', 'Received Telegram message', 'update_id=' + update.update_id + ' command=' + (update.message.text || '').split(/\s/, 1)[0]);
          try {
            await sendTelegramMessage(update.message);
          } catch (error) {
            log('error', 'Telegram message handler failed', error.stack || error.message);
          }
        }
      } catch (error) {
        failures += 1;
        telegramStatus.lastError = error.message;
        telegramStatus.state = error.telegramCode === 409 ? 'polling_conflict' : 'retrying';
        log('error', 'Telegram polling failed', error.stack || error.message);
        if (error.telegramCode === 401) {
          telegramStatus.state = 'unauthorized';
          return;
        }
        const retryAfter = Number(error.parameters?.retry_after || 0) * 1000;
        await new Promise(resolve => setTimeout(resolve, Math.max(retryAfter, Math.min(30000, 1000 * (2 ** Math.min(failures - 1, 5))))));
        telegramStatus.state = 'polling';
      }
    }
  } catch (error) {
    telegramStatus.state = error.telegramCode === 401 ? 'unauthorized' : 'startup_error';
    telegramStatus.lastError = error.message;
    log('error', 'Telegram bot startup failed', error.stack || error.message);
  }
}

async function handleApi(req, res, url) {
  await databaseReady;
  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, {
      ok: true,
      service: 'wayscase',
      mode: 'collection',
      storage: 'persistent-json',
      telegramBot: telegramStatus,
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/catalog') {
    const market = await getMarket();
    const catalogue = { cases: buildCases(market), gifts, market };
    return json(res, 200, { ok: true, ...catalogue });
  }

  if (req.method === 'GET' && url.pathname === '/api/me') {
    const identity = authFromRequest(req);
    const summary = await mutateDatabase(db => userSummary(ensureUser(db, identity)));
    return json(res, 200, { ok: true, user: summary });
  }

  if (req.method === 'POST' && url.pathname === '/api/claim-starter-stars') {
    const identity = authFromRequest(req);
    const outcome = await mutateDatabase(db => {
      const user = ensureUser(db, identity);
      const awardedStars = user.starterStarsClaimed ? 0 : 10000;
      const awardedTon = user.starterTonClaimed ? 0 : 500;
      if (!awardedStars && !awardedTon) {
        return { status: 409, body: { ok: false, error: 'starter_balance_already_claimed' } };
      }
      user.starterStarsClaimed = true;
      user.starterTonClaimed = true;
      user.balances.stars = Number(user.balances.stars || 0) + awardedStars;
      user.balances.ton = Number(user.balances.ton || 0) + awardedTon;
      return {
        status: 200,
        body: { ok: true, awardedStars, awardedTon, balances: user.balances, starterStarsClaimed: true, starterTonClaimed: true },
      };
    });
    return json(res, outcome.status, outcome.body);
  }

  if ((req.method === 'GET' && url.pathname === '/api/rocket') ||
      (req.method === 'POST' && ['/api/rocket/start','/api/rocket/cashout'].includes(url.pathname))) {
    const identity = authFromRequest(req);
    const view = (user, now) => ({ ok: true, round: roundView(user, now), now, balances: user.balances });
    if (req.method === 'GET') return json(res, 200, view(database.users[identity.id] || {}, Date.now()));
    const body = await readJsonBody(req);
    const result = await mutateDatabase(db => {
      const user = ensureUser(db, identity);
      const now = Date.now();
      (url.pathname.endsWith('/start') ? startRound : cashOut)(user, body, now);
      return view(user, now);
    });
    return json(res, 200, result);
  }

  if (req.method === 'POST' && ['/api/sell','/api/upgrade'].includes(url.pathname)) {
    const identity = authFromRequest(req);
    const body = await readJsonBody(req);
    const market = await getMarket();
    const result = await mutateDatabase(db => {
      const user = ensureUser(db, identity);
      const receipt = trade(user, url.pathname.slice(5), body, market);
      return {ok:true,receipt,user:userSummary(user)};
    });
    return json(res,200,result);
  }

  if (req.method === 'POST' && url.pathname === '/api/open') {
    const identity = authFromRequest(req);
    const body = await readJsonBody(req);
    const caseId = String(body?.caseId || '');
    const requestId = body?.requestId;
    if (typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(requestId)) return json(res, 400, {ok:false, error:'invalid_request_id'});
    const market = await getMarket();
    const chosenCase = buildCases(market).find(item => item.id === caseId);
    if (!chosenCase) return json(res, 404, { ok: false, error: 'case_not_found' });

    const outcome = await mutateDatabase(db => {
      const user = ensureUser(db, identity);
      const prior = user.inventory.find(i => i.requestId === requestId);
      if (prior) {
        if (prior.spent) return {status:409,body:{ok:false,error:"gift_used",message:"Подарок уже использован."}};
        if (prior.caseId !== caseId) return { status: 409, body: { ok: false, error: 'request_id_conflict' } };
        return { status: 200, body: { ok: true, item: presentGift(prior), balances: user.balances, totalOpens: Object.values(user.openCounts).reduce((a,b) => a + b, 0) } };
      }
      if (market.version !== body.version || !chosenCase.totalWeight) return {status:409,body:{ok:false,error:'quote_changed',message:'Цены изменились. Проверь цену открытия.'}};
      const previousOpens = Number(user.openCounts[caseId] || 0);
      if (user.balances.stars < chosenCase.price) return { status: 409, body: { ok: false, error: 'insufficient_balance', message: 'Недостаточно внутренних Stars.' } };
      user.balances.stars -= chosenCase.price;
      const gift = draw(chosenCase);
      const model = gift.models[0];
      const item = {
        id: randomUUID(), requestId,
        giftId: gift.id,
        giftName: gift.name,
        modelName: model?.name || null,
        rarity: model?.rarity || null,
        modelImageUrl: model?.imageUrl || null,
        caseId: chosenCase.id,
        caseName: chosenCase.title,
        receivedAt: new Date().toISOString(),
      };
      user.inventory.push(item);
      user.openCounts[caseId] = previousOpens + 1;
      return {
        status: 200,
        body: {
          ok: true,
          item: presentGift(item),
          balances: user.balances,
          totalOpens: Object.values(user.openCounts).reduce((sum, count) => sum + Number(count || 0), 0),
          chance: gift.chance,
        },
      };
    });
    return json(res, outcome.status, outcome.body);
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', 'http://' + (req.headers.host || 'localhost'));
    if (requestUrl.pathname === '/health' || requestUrl.pathname.startsWith('/api/')) {
      if (!['GET', 'POST'].includes(req.method || 'GET')) {
        res.writeHead(405, { allow: 'GET, POST' });
        return res.end('Method Not Allowed');
      }
      const handled = await handleApi(req, res, requestUrl);
      if (handled !== false) return;
      return json(res, 404, { ok: false, error: 'api_route_not_found' });
    }

    if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
      res.writeHead(405, { allow: 'GET, HEAD' });
      return res.end('Method Not Allowed');
    }
    let pathname;
    try {
      pathname = decodeURIComponent(requestUrl.pathname);
    } catch {
      res.writeHead(400);
      return res.end('Bad Request');
    }
    if (pathname === '/') pathname = '/index.html';
    const file = path.resolve(PUBLIC_DIR, '.' + pathname);
    if (!file.startsWith(PUBLIC_DIR + path.sep)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    const data = await readFile(file);
    res.writeHead(200, {
      ...(file.endsWith('.tgs') ? {'content-encoding':'gzip'} : {}),
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (error) {
    const status = Number(error.status || 500);
    if (requestUrlForError(req).startsWith('/api/') || requestUrlForError(req) === '/health') {
      if (status >= 500) log('error', 'API request failed', error.stack || error.message);
      return json(res, status, { ok: false, error: status === 401 ? 'telegram_auth_required' : 'request_failed', message: error.message });
    }
    if (status === 404) {
      res.writeHead(404);
      return res.end('Not Found');
    }
    log('error', 'HTTP request failed', error.stack || error.message);
    res.writeHead(status);
    res.end(status === 500 ? 'Internal Server Error' : error.message);
  }
});

function requestUrlForError(req) {
  return String(req.url || '/').split('?')[0];
}

server.listen(PORT, '0.0.0.0', () => {
  log('info', 'WaysCase server listening', 'port=' + server.address().port);
  databaseReady = loadDatabase()
    .then(() => {
      void runTelegramPolling();
    })
    .catch(error => {
      log('error', 'Application startup failed', error.stack || error.message);
      telegramStatus.state = 'startup_error';
    });
});

server.on('error', error => {
  log('error', 'HTTP server error', error.stack || error.message);
  process.exitCode = 1;
});

process.on('unhandledRejection', reason => {
  log('error', 'Unhandled promise rejection', reason?.stack || String(reason));
});
process.on('uncaughtException', error => {
  log('error', 'Uncaught exception', error.stack || error.message);
  process.exit(1);
});
