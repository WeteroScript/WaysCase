import { readFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';

// Reference values in game units, not a live price feed.
const rows = JSON.parse(readFileSync(new URL('./gifts.json', import.meta.url)));
const gifts = rows.map(([id, name, model, value]) => ({
  id, name, value, weight: Math.round(90_000_000 / value),
  models: [{ name: model, telegramName: model, imageUrl: `/assets/gifts/${id}.webp` }],
}));
const definitions = [
  ['first-light','Бомж','candy-cane'], ['emerald-room','На чиле','plush-pepe'],
  ['royal-objects','Мажор','durovs-cap'], ['love-letter','Симп','heart-locket'],
  ['night-sky','Ночной флекс','hanging-star'], ['toy-world','Имба','toy-bear'],
  ['ice-crown','Лакшери','diamond-ring'], ['neon-wave','Гигачад','input-key'],
  ['peach-club','На стиле','precious-peach'], ['grand-archive','Топ-1','astral-shard'],
];
export const cases = definitions.map(([id,title,coverId], i) => {
  const cover = gifts.find(g => g.id === coverId);
  const rotated = gifts.slice(i * 2).concat(gifts.slice(0, i * 2));
  const pool = [cover, ...rotated.filter(g => g !== cover)].slice(0, 12+i);
  const totalWeight = pool.reduce((sum,g) => sum + g.weight, 0);
  return { id, title, cover, number: i+1, price: 100 + i*50, totalWeight,
    gifts: pool.map(g => ({ ...g, chance: 100 * g.weight / totalWeight })) };
});
export function draw(c, roll = randomInt(c.totalWeight)) {
  for (const gift of c.gifts) {
    if (roll < gift.weight) return gift;
    roll -= gift.weight;
  }
  throw new RangeError('Invalid catalogue roll');
}
