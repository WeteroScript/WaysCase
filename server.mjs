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
const GIFT_API = 'https://api.changes.tg';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

const GIFTS = [
  { id: 'eternal-rose', name: 'Eternal Rose', emoji: '🌹' },
  { id: 'plush-pepe', name: 'Plush Pepe', emoji: '🐸' },
  { id: 'durovs-cap', name: 'Durov’s Cap', emoji: '🧢' },
  { id: 'diamond-ring', name: 'Diamond Ring', emoji: '💍' },
  { id: 'toy-bear', name: 'Toy Bear', emoji: '🧸' },
  { id: 'heart-locket', name: 'Heart Locket', emoji: '💝' },
  { id: 'golden-star', name: 'Golden Star', emoji: '🌟' },
  { id: 'bunny-muffin', name: 'Bunny Muffin', emoji: '🐰' },
  { id: 'magic-key', name: 'Magic Key', emoji: '🗝️' },
  { id: 'precious-peach', name: 'Precious Peach', emoji: '🍑' },
];

const CASES = [
  { id: 'first-light', title: 'First Light', subtitle: 'Первая коллекция', cover: 'eternal-rose', gifts: ['eternal-rose', 'toy-bear', 'precious-peach', 'bunny-muffin'] },
  { id: 'emerald-room', title: 'Emerald Room', subtitle: 'Изумрудная подборка', cover: 'plush-pepe', gifts: ['plush-pepe', 'bunny-muffin', 'magic-key', 'eternal-rose'] },
  { id: 'royal-objects', title: 'Royal Objects', subtitle: 'Королевские предметы', cover: 'durovs-cap', gifts: ['durovs-cap', 'diamond-ring', 'golden-star', 'toy-bear'] },
  { id: 'love-letter', title: 'Love Letter', subtitle: 'Коллекция чувств', cover: 'heart-locket', gifts: ['heart-locket', 'eternal-rose', 'diamond-ring', 'precious-peach'] },
  { id: 'night-sky', title: 'Night Sky', subtitle: 'Ночная коллекция', cover: 'golden-star', gifts: ['golden-star', 'magic-key', 'durovs-cap', 'plush-pepe'] },
  { id: 'toy-world', title: 'Toy World', subtitle: 'Мир игрушек', cover: 'toy-bear', gifts: ['toy-bear', 'bunny-muffin', 'plush-pepe', 'precious-peach'] },
  { id: 'ice-crown', title: 'Ice Crown', subtitle: 'Ледяная корона', cover: 'diamond-ring', gifts: ['diamond-ring', 'golden-star', 'toy-bear', 'heart-locket'] },
  { id: 'neon-wave', title: 'Neon Wave', subtitle: 'Неоновая волна', cover: 'magic-key', gifts: ['magic-key', 'durovs-cap', 'precious-peach', 'eternal-rose'] },
  { id: 'peach-club', title: 'Peach Club', subtitle: 'Персиковый клуб', cover: 'precious-peach', gifts: ['precious-peach', 'heart-locket', 'bunny-muffin', 'toy-bear'] },
  { id: 'grand-archive', title: 'Grand Archive', subtitle: 'Большой архив', cover: 'golden-star', gifts: ['golden-star', 'plush-pepe', 'diamond-ring', 'magic-key'] },
];

const giftById = new Map(GIFTS.map(gift => [gift.id, gift]));
const modelCache = new Map();
const modelImageCache = new Map();
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

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function nextUtcDay() {
  const date = new Date();
  date.setUTCHours(24, 0, 0, 0);
  return date.toISOString();
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

async function persistDatabase() {
  const tempFile = DB_FILE + '.tmp';
  await writeFile(tempFile, JSON.stringify(database), { encoding: 'utf8', mode: 0o600 });
  await rename(tempFile, DB_FILE);
}

async function mutateDatabase(mutator) {
  let release;
  const previous = writeQueue;
  writeQueue = new Promise(resolve => { release = resolve; });
  await previous;
  try {
    const result = await mutator(database);
    await persistDatabase();
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
  return user;
}

function userSummary(user) {
  return {
    firstName: user.firstName,
    username: user.username,
    balances: user.balances,
    inventory: user.inventory.slice().reverse(),
    openCounts: user.openCounts,
    lastOpenDates: user.lastOpenDates,
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

async function getGiftModels(gift) {
  const cached = modelCache.get(gift.id);
  if (cached && cached.expiresAt > Date.now()) return cached.models;

  try {
    const response = await fetch(GIFT_API + '/models/' + encodeURIComponent(gift.id) + '?sorted', {
      headers: { 'accept': 'application/json', 'user-agent': 'WaysCase/1.0 (Gift Changes attribution)' },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error('Gift model source returned HTTP ' + response.status);
    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload : (Array.isArray(payload.models) ? payload.models : []);
    const models = rows
      .filter(row => row && (row.name || row.telegramName))
      .map(row => {
        const modelName = String(row.name || row.telegramName);
        return {
          name: modelName,
          telegramName: String(row.telegramName || modelName),
          rarity: String(row.rarityTier || row.rarity || 'Collectible'),
          rarityPermille: Number(row.rarityPermille || 0),
          crafted: Boolean(row.crafted),
          documentId: row.documentId ? String(row.documentId) : null,
          imageUrl: '/api/model.svg?gift=' + encodeURIComponent(gift.id) + '&model=' + encodeURIComponent(modelName),
        };
      });
    modelCache.set(gift.id, { models, expiresAt: Date.now() + 60 * 60 * 1000 });
    return models;
  } catch (error) {
    log('warn', 'Telegram gift model catalogue unavailable', 'gift=' + gift.id + ' reason=' + error.message);
    modelCache.set(gift.id, { models: [], expiresAt: Date.now() + 2 * 60 * 1000 });
    return [];
  }
}

async function buildCatalogue() {
  const modelLists = await Promise.all(GIFTS.map(async gift => [gift.id, await getGiftModels(gift)]));
  const byGift = Object.fromEntries(modelLists);
  return {
    modelSource: 'Gift Changes — independent Telegram collectible model catalogue',
    attribution: 'Gift model data and preview rendering provided by Gift Changes.',
    modelCount: Object.values(byGift).reduce((sum, list) => sum + list.length, 0),
    cases: CASES.map((item, index) => ({
      id: item.id,
      number: index + 1,
      title: item.title,
      subtitle: item.subtitle,
      gifts: item.gifts.map(giftId => {
        const gift = giftById.get(giftId);
        return { ...gift, models: byGift[giftId] || [] };
      }),
      cover: (() => {
        const gift = giftById.get(item.cover);
        const models = byGift[item.cover] || [];
        return { ...gift, models, imageUrl: models[0]?.imageUrl || null };
      })(),
    })),
  };
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
    const firstName = String(message.from?.first_name || 'коллекционер')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    await telegramApi('sendMessage', {
      chat_id: chatId,
      text: 'Привет, <b>' + firstName + '</b>! ✨\n\nДобро пожаловать в <b>WaysCase</b> — коллекционное приложение с моделями Telegram Gifts.\n\nНажми кнопку ниже, чтобы открыть приложение.',
      parse_mode: 'HTML',
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

  if (req.method === 'GET' && url.pathname === '/api/model.svg') {
    const giftId = String(url.searchParams.get('gift') || '');
    const modelName = String(url.searchParams.get('model') || '');
    const gift = giftById.get(giftId);
    if (!gift || !modelName || modelName.length > 100) return json(res, 404, { ok: false, error: 'model_not_found' });
    const cacheKey = giftId + ':' + modelName;
    const cachedImage = modelImageCache.get(cacheKey);
    if (cachedImage && cachedImage.expiresAt > Date.now()) {
      res.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=3600', 'x-content-type-options': 'nosniff' });
      return res.end(cachedImage.svg);
    }
    const upstream = await fetch(GIFT_API + '/model/' + encodeURIComponent(giftId) + '/' + encodeURIComponent(modelName) + '.svg', {
      headers: { 'accept': 'image/svg+xml', 'user-agent': 'WaysCase/1.0 (Gift Changes attribution)' },
      signal: AbortSignal.timeout(12000),
    });
    if (!upstream.ok) return json(res, 502, { ok: false, error: 'model_source_unavailable' });
    const svg = await upstream.text();
    if (!/<svg[\\s>]/i.test(svg) || svg.length > 1500000) return json(res, 502, { ok: false, error: 'invalid_model_asset' });
    modelImageCache.set(cacheKey, { svg, expiresAt: Date.now() + 60 * 60 * 1000 });
    res.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=3600', 'x-content-type-options': 'nosniff' });
    return res.end(svg);
  }

  if (req.method === 'GET' && url.pathname === '/api/catalog') {
    const catalogue = await buildCatalogue();
    return json(res, 200, { ok: true, ...catalogue });
  }

  if (req.method === 'GET' && url.pathname === '/api/me') {
    const identity = authFromRequest(req);
    const summary = await mutateDatabase(db => userSummary(ensureUser(db, identity)));
    return json(res, 200, { ok: true, user: summary });
  }

  if (req.method === 'POST' && url.pathname === '/api/open') {
    const identity = authFromRequest(req);
    const body = await readJsonBody(req);
    const caseId = String(body.caseId || '');
    const chosenCase = CASES.find(item => item.id === caseId);
    if (!chosenCase) return json(res, 404, { ok: false, error: 'case_not_found' });

    const modelLists = Object.fromEntries(await Promise.all(chosenCase.gifts.map(async giftId => {
      const gift = giftById.get(giftId);
      return [giftId, await getGiftModels(gift)];
    })));
    const outcome = await mutateDatabase(db => {
      const user = ensureUser(db, identity);
      const currentDate = todayUtc();
      if (user.lastOpenDates[caseId] === currentDate) {
        return {
          status: 409,
          body: { ok: false, error: 'already_opened_today', nextOpenAt: nextUtcDay() },
        };
      }
      const previousOpens = Number(user.openCounts[caseId] || 0);
      const gift = giftById.get(chosenCase.gifts[previousOpens % chosenCase.gifts.length]);
      const giftModels = modelLists[gift.id] || [];
      const model = giftModels.length ? giftModels[previousOpens % giftModels.length] : null;
      const item = {
        id: randomUUID(),
        giftId: gift.id,
        giftName: gift.name,
        giftEmoji: gift.emoji,
        modelName: model?.name || null,
        rarity: model?.rarity || null,
        modelImageUrl: model?.imageUrl || null,
        caseId: chosenCase.id,
        caseName: chosenCase.title,
        receivedAt: new Date().toISOString(),
      };
      user.inventory.push(item);
      if (user.inventory.length > 250) user.inventory = user.inventory.slice(-250);
      user.openCounts[caseId] = previousOpens + 1;
      user.lastOpenDates[caseId] = currentDate;
      user.balances.stars = Number(user.balances.stars || 0) + 10;
      user.balances.ton = Number(user.balances.ton || 0) + 1;
      return {
        status: 200,
        body: {
          ok: true,
          item,
          balances: user.balances,
          totalOpens: Object.values(user.openCounts).reduce((sum, count) => sum + Number(count || 0), 0),
          nextOpenAt: nextUtcDay(),
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
  log('info', 'WaysCase server listening', 'port=' + PORT);
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
