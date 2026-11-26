import { upgradePercent } from '../public/upgrade-odds.mjs';
import { randomInt, randomUUID } from 'node:crypto';
import { gifts } from './catalog.mjs';

function reject(message) { throw Object.assign(new Error(message), {status:409}); }
// Retain spent rows as receipts: retries cannot replay a draw, sale or upgrade.
export function trade(user, action, body, market, roll = randomInt) {
  const item = user.inventory.find(i => i.id === body?.itemId);
  if (!item) reject('Подарок не найден в инвентаре.');
  if (item.spent) {
    if (item.spent.action === action && (action === 'sell' || item.spent.targetId === body.targetId)) return item.spent;
    reject('Подарок уже использован.');
  }
  if (!market.tradable || Date.now() >= market.expiresAt) reject('Нет свежих цен рынка.');
  if (body.version !== market.version) reject('Цены изменились. Проверь новую стоимость.');
  const source = market.prices[item.giftId];
  if (!source) reject('Нет цены для этого подарка.');
  if (action === 'sell') {
    user.balances.stars += source.stars;
    return item.spent = {action, credited:source.stars, version:market.version};
  }
  const target = gifts.find(g => g.id === body.targetId);
  const price = target && market.prices[target.id];
  const percent = upgradePercent(source.ton, price?.ton);
  if (!percent) reject('Выбери подарок дороже своего.');
  const threshold = percent * 10000;
  const ticket = roll(1000000);
  const won = ticket < threshold;
  if (won) user.inventory.push({id:randomUUID(),giftId:target.id,giftName:target.name,
    modelName:target.models[0].name,modelImageUrl:target.models[0].imageUrl,
    caseName:'Апгрейд',receivedAt:new Date().toISOString()});
  return item.spent = {action, targetId:target.id, threshold,ticket,won,version:market.version};
}
