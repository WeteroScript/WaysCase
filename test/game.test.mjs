import { parseMarket } from '../lib/market.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCases, draw } from '../lib/catalog.mjs';

test('every ticket range agrees with published price-based odds and has a bundled WebP', () => {
  const market = parseMarket(JSON.parse(readFileSync(new URL('../lib/fragment-snapshot.json',import.meta.url))));
  for (const c of buildCases(market)) {
    assert.ok(c.gifts.length >= 10 && c.gifts.length <= 30);
    assert.equal(new Set(c.gifts.map(g => g.id)).size, c.gifts.length);
    let ticket = 0;
    for (const g of c.gifts) {
      assert.equal(draw(c, ticket), g);
      ticket += g.weight;
      assert.equal(draw(c, ticket-1), g);
      assert.equal(g.chance, 100*g.weight/c.totalWeight);
      assert.ok(c.gifts.every(other => other.value <= g.value || other.chance < g.chance));
      assert.equal(readFileSync(new URL('../public'+g.models[0].imageUrl,import.meta.url)).toString('ascii',8,12), 'WEBP');
    }
    assert.equal(ticket,c.totalWeight);
  }
});

test('case pools cover the catalogue and show the actual break-even chance, not expected return',()=>{
  const market = parseMarket(JSON.parse(readFileSync(new URL('../lib/fragment-snapshot.json',import.meta.url))));
  const cases = buildCases(market);
  const all = new Set(cases.flatMap(c=>c.gifts.map(g=>g.telegramId)));
  assert.equal(all.size,124);
  for(const c of cases){
    const expected=c.gifts.reduce((s,g)=>s+market.prices[g.id].stars*g.weight/c.totalWeight,0);
    const covered=c.gifts.filter(g=>market.prices[g.id].stars>=c.price).reduce((s,g)=>s+g.weight,0);
    assert.equal(c.price,Math.ceil(expected/.90));
    assert.equal(c.breakEvenPercent,100*covered/c.totalWeight);
    assert.ok(c.breakEvenPercent>=20 && c.breakEvenPercent<=35,'bundled case: '+c.id);
  }
});
