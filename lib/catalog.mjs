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
// Prices are edition denominations in internal Stars. Quotes affect prizes and
// odds only; neither the client nor the feed sets an opening price.
const definitions = [
  ['first-light','Бомж',500], ['emerald-room','На чиле',750],
  ['night-sky','Ночной флекс',1000], ['love-letter','Симп',1250],
  ['royal-objects','Мажор',1500], ['toy-world','Имба',2000],
  ['peach-club','На стиле',2500], ['ice-crown','Лакшери',3000],
  ['neon-wave','Гигачад',4000], ['grand-archive','Топ-1',5000],
  ['film-room','Кинозал',6000], ['road-trip','Гараж',7500],
  ['atelier','Ателье',10000], ['observatory','Обсерватория',15000],
  ['vault','Сейф',25000],
  // Premium pools admit only quotes inside the edition’s bracket (inclusive).
  ['silver-room','Серебряная палата',45000,30000,160000],
  ['auction','Закрытый аукцион',60000,30000,250000],
  ['royal-mint','Монетный двор',75000,35000,350000],
  ['black-diamond','Чёрный бриллиант',90000,30000,700000],
  ['crown','Корона',100000,40000,1000000],
];

// Find a decreasing price-weight curve whose expected resale is near 90% of
// the fixed admission, when the current pool supports it. Never alter quotes.
function tickets(values, price) {
  if (!values.length) return [];
  const min = Math.min(...values);
  let lo = 0, hi = 12;
  const weights = power => values.map(v => Math.max(1, Math.round(1e8 * (min / v) ** power)));
  for (let i=0; i<28; i++) {
    const mid=(lo+hi)/2, w=weights(mid);
    const ev=w.reduce((s,n,j)=>s+n*values[j],0)/w.reduce((s,n)=>s+n,0);
    if (ev > price*0.90) lo=mid; else hi=mid;
  }
  return weights((lo+hi)/2);
}
export function buildCases(market) {
  return definitions.map(([id,title,price,min,max],i) => {
    const premium = min !== undefined;
    const pool = (premium ? gifts : casePools[id].map(id => byId.get(id))).filter(g => {
      const stars = market.prices[g.id]?.stars;
      return stars > 0 && (!premium || stars >= min && stars <= max);
    });
    const values = pool.map(g => market.prices[g.id].stars);
    const w = tickets(values,price), totalWeight=w.reduce((s,n)=>s+n,0);
    const covered = w.reduce((s,n,j)=>s+(values[j]>=price?n:0),0);
    return { id,title,number:i+1,price,premium,totalWeight,
      breakEvenPercent: totalWeight ? 100*covered/totalWeight : 0,
      gifts:pool.map((g,j)=>({...g,value:market.prices[g.id].ton,weight:w[j],chance:100*w[j]/totalWeight})) };
  });
}
export function draw(c, roll = randomInt(c.totalWeight)) {
  for (const gift of c.gifts) {
    if (roll < gift.weight) return gift;
    roll -= gift.weight;
  }
  throw new RangeError('Invalid catalogue roll');
}
