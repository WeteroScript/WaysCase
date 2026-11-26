import { readFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';

const rows = JSON.parse(readFileSync(new URL('./gifts.json', import.meta.url)));
const artSuffix = {'precious-peach':'-honey-gold', 'heart-locket':'-compass'};
export const gifts = rows.map(([id, name, model, telegramId]) => ({
  id, name, telegramId,
  models: [{ name: model, telegramName: model, imageUrl: `/assets/gifts/${id}${artSuffix[id] || ''}.webp` }],
}));
const casePools = JSON.parse(readFileSync(new URL('./case-pools.json', import.meta.url)));
const byId = new Map(gifts.map(g => [g.id,g]));
const definitions = [
  ['first-light','Бомж','candy-cane'], ['emerald-room','На чиле','plush-pepe'],
  ['royal-objects','Мажор','durovs-cap'], ['love-letter','Симп','heart-locket'],
  ['night-sky','Ночной флекс','hanging-star'], ['toy-world','Имба','toy-bear'],
  ['ice-crown','Лакшери','diamond-ring'], ['neon-wave','Гигачад','input-key'],
  ['peach-club','На стиле','precious-peach'], ['grand-archive','Топ-1','astral-shard'],
];
export function buildCases(market) {
  return definitions.map(([id,title,coverId], i) => {
    const cover = gifts.find(g => g.id === coverId);
    const pool = casePools[id].map(giftId => {
      const g = byId.get(giftId);
      const floor = market.prices[g.id];
      return {...g, value:floor?.ton ?? null, weight:floor ? Math.max(1,Math.round(1_000_000/floor.ton)) : 0};
    });
    const totalWeight = pool.reduce((sum,g) => sum + g.weight, 0);
    const expected = pool.reduce((sum,g) => sum + g.weight * (market.prices[g.id]?.stars || 0), 0) / (totalWeight || 1);
    // Direct resale returns at most 90% of spend on average at this quote.
    const price = Math.max(1, Math.ceil(expected / 0.90));
    const covered = pool.reduce((sum,g) => sum + (market.prices[g.id]?.stars >= price ? g.weight : 0), 0);
    const breakEvenPercent = totalWeight ? 100 * covered / totalWeight : 0;
    return { id,title,cover,coverImageUrl:`/assets/cases/series/${id}.svg`,number:i+1,price,breakEvenPercent,totalWeight,
      gifts:pool.map(g => ({...g,chance:totalWeight ? 100*g.weight/totalWeight : 0})) };
  });
}
export function draw(c, roll = randomInt(c.totalWeight)) {
  for (const gift of c.gifts) {
    if (roll < gift.weight) return gift;
    roll -= gift.weight;
  }
  throw new RangeError('Invalid catalogue roll');
}
