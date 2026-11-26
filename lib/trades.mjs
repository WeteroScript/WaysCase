import { upgradeThreshold } from '../public/upgrade-odds.mjs';
import { randomInt, randomUUID } from 'node:crypto';
import { gifts } from './catalog.mjs';

function reject(message) { throw Object.assign(new Error(message), {status:409}); }
function checkMarket(body,market) {
  if (!market.tradable || Date.now() >= market.expiresAt) reject('Нет свежих цен рынка.');
  if (body.version !== market.version) reject('Цены изменились. Проверь новую стоимость.');
}

// Resolve the entire opening from this user's persisted rows, never client prices or IDs.
export function sellBatch(user, body, market) {
  if (typeof body?.requestId !== 'string' || !body.requestId) reject('Не указано открытие.');
  const rows = user.inventory.filter(item => item.requestId === body.requestId);
  if (rows.length < 2 || rows.length > 5) reject('Групповое открытие не найдено.');
  if (rows.every(item => item.spent?.action === 'sell-batch')) {
    return {credited:rows.reduce((sum,item) => sum + item.spent.credited,0)};
  }
  if (rows.some(item => item.spent)) reject('Один из подарков уже использован. Остальные не проданы.');
  checkMarket(body,market);
  const amounts = rows.map(item => market.prices[item.giftId]?.stars);
  if (amounts.some(n => !Number.isSafeInteger(n) || n <= 0)) reject('Не для всех подарков есть цена.');
  const credited = amounts.reduce((sum,n) => sum+n,0);
  rows.forEach((item,i) => { item.spent = {action:'sell-batch',credited:amounts[i],version:market.version}; });
  user.balances.stars += credited;
  return {credited};
}
// Retain spent rows as receipts: retries cannot replay a draw, sale or upgrade.
export function trade(user, action, body, market, roll = randomInt) {
  const item = user.inventory.find(i => i.id === body?.itemId);
  if (!item) reject('Подарок не найден в инвентаре.');
  if (item.spent) {
    if (item.spent.action === action && (action === 'sell' || item.spent.targetId === body.targetId)) return item.spent;
    reject('Подарок уже использован.');
  }
  checkMarket(body,market);
  const source = market.prices[item.giftId];
  if (!source) reject('Нет цены для этого подарка.');
  if (action === 'sell') {
    user.balances.stars += source.stars;
    return item.spent = {action, credited:source.stars, version:market.version};
  }
  const target = gifts.find(g => g.id === body.targetId);
  const price = target && market.prices[target.id];
  const threshold = upgradeThreshold(source.ton, price?.ton);
  if (!threshold) reject('Выбери более дорогой подарок с шансом до 75 % включительно.');
  const ticket = roll(1000000);
  const won = ticket < threshold;
  if (won) user.inventory.push({id:randomUUID(),giftId:target.id,giftName:target.name,
    modelName:target.models[0].name,modelImageUrl:target.models[0].imageUrl,
    caseName:'Апгрейд',receivedAt:new Date().toISOString()});
  return item.spent = {action, targetId:target.id, threshold,ticket,won,version:market.version};
}
