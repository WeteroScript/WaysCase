import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const port = Number.parseInt(process.env.PORT || '3000', 10);
const DEFAULT_WEBAPP_URL = 'https://bot-1794953284-8098-weterochina.bothost.tech/';
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

const telegramStatus = {
  state: 'starting',
  enabled: Boolean((process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '').trim()),
  username: null,
  lastError: null,
};

function log(level, message, details = '') {
  const suffix = details ? ` | ${details}` : '';
  console[level](`${new Date().toISOString()} | ${level.toUpperCase()} | wayscase | ${message}${suffix}`);
}

function getBotToken() {
  return (process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

function getWebAppUrl() {
  const configured = (process.env.WEBAPP_URL || DEFAULT_WEBAPP_URL).trim();
  try {
    const parsed = new URL(configured);
    if (parsed.protocol !== 'https:') throw new Error('URL must use HTTPS');
    return parsed.toString();
  } catch (error) {
    log('warn', 'WEBAPP_URL is invalid; using the built-in HTTPS address', error.message);
    return DEFAULT_WEBAPP_URL;
  }
}

class TelegramApiError extends Error {
  constructor(method, code, description, parameters = {}) {
    super(`Telegram API ${method} failed (${code}): ${description}`);
    this.name = 'TelegramApiError';
    this.telegramCode = code;
    this.parameters = parameters;
  }
}

async function telegramApi(token, method, payload = {}, timeoutMs = 15000) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw new TelegramApiError(
      method,
      data?.error_code || response.status,
      data?.description || response.statusText || 'Unknown Telegram API error',
      data?.parameters || {},
    );
  }
  return data.result;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function answerTelegramMessage(token, message, webAppUrl) {
  const chatId = message.chat?.id;
  if (chatId === undefined || chatId === null) {
    log('warn', 'Ignored Telegram message without chat id');
    return;
  }

  const text = message.text || '';
  const isStart = /^\/start(?:@[_a-zA-Z0-9]+)?(?:\s|$)/i.test(text);
  let replyText;
  let replyMarkup;

  if (isStart) {
    const firstName = escapeHtml(message.from?.first_name || 'коллекционер');
    replyText =
      `Привет, <b>${firstName}</b>! ✨\n\n` +
      'Добро пожаловать в <b>WaysCase</b> — коллекционный каталог.\n\n' +
      'Нажми кнопку ниже, чтобы открыть Mini App.';
    replyMarkup = {
      inline_keyboard: [[{
        text: 'Открыть WaysCase',
        web_app: { url: webAppUrl },
      }]],
    };
    log('info', 'Handling /start', `chat_id=${chatId} user_id=${message.from?.id ?? 'unknown'}`);
  } else {
    replyText = 'Чтобы открыть WaysCase, отправь /start и нажми кнопку Mini App.';
  }

  await telegramApi(token, 'sendMessage', {
    chat_id: chatId,
    text: replyText,
    parse_mode: 'HTML',
    reply_markup: replyMarkup,
    disable_web_page_preview: true,
  });

  if (isStart) {
    log('info', 'Successfully replied to /start', `chat_id=${chatId}`);
  } else {
    log('info', 'Sent fallback reply', `chat_id=${chatId}`);
  }
}

async function runTelegramPolling(token, webAppUrl) {
  let offset = 0;
  let failures = 0;

  while (true) {
    try {
      const updates = await telegramApi(
        token,
        'getUpdates',
        { offset, timeout: 25, allowed_updates: ['message'] },
        40000,
      );
      failures = 0;

      for (const update of updates) {
        offset = update.update_id + 1;
        if (!update.message) continue;

        const message = update.message;
        const kind = message.text?.startsWith('/') ? message.text.split(/\s/, 1)[0] : 'text';
        log('info', 'Received Telegram update', `update_id=${update.update_id} kind=${kind}`);

        try {
          await answerTelegramMessage(token, message, webAppUrl);
        } catch (error) {
          log('error', 'Failed to process Telegram message', error.stack || error.message);
          telegramStatus.lastError = error.message;
        }
      }
    } catch (error) {
      failures += 1;
      telegramStatus.state = error.telegramCode === 409 ? 'polling_conflict' : 'retrying';
      telegramStatus.lastError = error.message;
      log('error', 'Telegram long-polling request failed', error.stack || error.message);

      if (error.telegramCode === 401) {
        telegramStatus.state = 'unauthorized';
        log('error', 'BOT_TOKEN was rejected by Telegram. Update the BOT_TOKEN environment variable.');
        return;
      }

      const retryAfter = Number(error.parameters?.retry_after || 0) * 1000;
      const backoff = Math.min(30000, 1000 * (2 ** Math.min(failures - 1, 5)));
      await delay(Math.max(retryAfter, backoff));
      log('info', 'Retrying Telegram long polling', `attempt=${failures + 1}`);
      telegramStatus.state = 'polling';
    }
  }
}

async function startTelegramBot() {
  const token = getBotToken();
  if (!token) {
    telegramStatus.state = 'missing_token';
    telegramStatus.enabled = false;
    log('error', 'Telegram bot is disabled: BOT_TOKEN is not set in the hosting environment');
    return;
  }

  const webAppUrl = getWebAppUrl();
  telegramStatus.enabled = true;
  log('info', 'Telegram bot startup requested', `token_present=true webapp_host=${new URL(webAppUrl).host}`);

  try {
    const me = await telegramApi(token, 'getMe');
    telegramStatus.username = me.username || null;
    log('info', 'Telegram authorization successful', `bot=@${me.username || 'unknown'} bot_id=${me.id}`);

    const webhook = await telegramApi(token, 'getWebhookInfo');
    log('info', 'Telegram webhook status', `configured=${Boolean(webhook.url)} pending_updates=${webhook.pending_update_count}`);

    if (webhook.url) {
      await telegramApi(token, 'deleteWebhook', { drop_pending_updates: false });
      log('info', 'Removed webhook; pending updates preserved');
    }

    telegramStatus.state = 'polling';
    telegramStatus.lastError = null;
    log('info', 'Telegram long polling started', 'allowed_updates=message timeout=25s');
    await runTelegramPolling(token, webAppUrl);
  } catch (error) {
    telegramStatus.state = error.telegramCode === 401 ? 'unauthorized' : 'startup_error';
    telegramStatus.lastError = error.message;
    log('error', 'Telegram bot could not start', error.stack || error.message);
  }
}

const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
    res.writeHead(405, { allow: 'GET, HEAD' });
    return res.end('Method Not Allowed');
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({
      ok: true,
      service: 'wayscase',
      mode: 'demo',
      telegramBot: telegramStatus,
    }));
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    return res.end('Bad Request');
  }

  if (pathname === '/') pathname = '/index.html';
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    const data = await readFile(file);
    res.writeHead(200, {
      'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(port, '0.0.0.0', () => {
  log('info', 'WaysCase web server listening', `port=${port}`);
  void startTelegramBot();
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
