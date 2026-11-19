import { randomInt } from 'node:crypto';

const GROWTH_MS = 6500;
const multiplier = ms => Math.max(100, Math.floor(100 * Math.exp(ms / GROWTH_MS)));
function fail(message, status = 409) { throw Object.assign(new Error(message), { status }); }
export function roundView(user, now) {
  const r = user.rocket;
  if (!r) return null;
  const crashed = now >= r.crashAt && !r.cashout;
  const cents = r.cashout || multiplier(Math.min(now, r.crashAt) - r.start);
  return { id: r.id, stake: r.stake, start: r.start, growthMs: GROWTH_MS, cents,
    status: r.cashout ? 'won' : crashed ? 'crashed' : 'flying', payout: r.payout || 0 };
}
export function startRound(user, {id, previous, stake}, now) {
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id) || !Number.isSafeInteger(stake) || stake < 1 || stake > 100000) fail('Ставка: от 1 до 100 000 Stars.', 400);
  if (user.rocket?.id === id) return;
  if ((user.rocket?.id ?? null) !== previous || roundView(user, now)?.status === 'flying') fail('Раунд уже изменился.');
  if (user.balances.stars < stake) fail('Недостаточно внутренних Stars.');
  const u = randomInt(1, 1000001) / 1000000;
  const duration = Math.floor(GROWTH_MS * Math.log(Math.min(100, 1/u)));
  user.balances.stars -= stake;
  user.rocket = { id, stake, start: now, crashAt: now + duration };
}
export function cashOut(user, {id}, now) {
  const r = roundView(user, now);
  if (!r || r.id !== id) fail('Раунд уже изменился.');
  if (r.status !== 'flying') return;
  const payout = Math.floor(r.stake * r.cents / 100);
  user.rocket.cashout = r.cents;
  user.rocket.payout = payout;
  user.balances.stars += payout;
}
