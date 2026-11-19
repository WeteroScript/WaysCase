import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gifts } from './catalog.mjs';

const feed = 'https://api.github.com/repos/Atlannn/telegram-gifts-floor-price/contents/docs/api/v1/latest.json';
const day = 86400000;
// Game accounting convention, not an exchange rate for redeeming Telegram Stars.
const usdPerPoint = 0.013;
export function parseMarket(raw) {
  const time = Date.parse(raw.date + 'T00:00:00Z');
  if (!/^\d{4}-\d\d-\d\d$/.test(raw.date) || !Number.isFinite(time) || time > Date.now() ||
      raw.source !== 'fragment.com' || raw.unit !== 'GRAM' || !(raw.rate?.usd > 0)) throw Error('Invalid Fragment snapshot');
  const prices = {};
  for (const gift of gifts) {
    const ton = raw.floors?.[gift.id.replaceAll('-', '')]?.floor_gram;
    const stars = Math.floor(ton * raw.rate.usd / usdPerPoint);
    if (Number.isFinite(ton) && ton > 0 && Number.isSafeInteger(stars) && stars > 0) prices[gift.id] = { ton, stars };
  }
  if (!Object.keys(prices).length) throw Error('Empty Fragment snapshot');
  const version = createHash('sha256').update(JSON.stringify([raw.date, prices])).digest('hex').slice(0,20);
  return { version, date:raw.date, expiresAt:time + 3*day, prices };
}
let current = parseMarket(JSON.parse(readFileSync(new URL('./fragment-snapshot.json', import.meta.url))));
let next = 0, pending;
export async function getMarket() {
  if (Date.now() >= next && !pending) {
    pending = (async () => {
      try {
        const response = await fetch(feed,{headers:{accept:'application/vnd.github.raw+json'},signal:AbortSignal.timeout(3500)});
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        const update = parseMarket(await response.json());
        if (update.date >= current.date) current = update;
        next = Date.now()+3600000;
      } catch (error) {
        console.warn('Fragment price refresh:',error.message);
        next = Date.now()+300000;
      } finally { pending = null; }
    })();
  }
  await pending;
  return { ...current, tradable:Date.now() < current.expiresAt };
}
