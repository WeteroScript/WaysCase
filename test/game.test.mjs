import { parseMarket } from '../lib/market.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCases, draw } from '../lib/catalog.mjs';

test('every ticket range agrees with published price-based odds and has a bundled WebP', () => {
  const market = parseMarket(JSON.parse(readFileSync(new URL('../lib/fragment-snapshot.json',import.meta.url))));
  for (const c of buildCases(market)) {
    assert.ok(c.gifts.length >= (c.premium ? 1 : 10) && c.gifts.length <= 30);
    assert.equal(new Set(c.gifts.map(g => g.id)).size, c.gifts.length);
    let ticket = 0;
    for (const g of c.gifts) {
      assert.equal(draw(c, ticket), g);
      ticket += g.weight;
      assert.equal(draw(c, ticket-1), g);
      assert.equal(g.chance, 100*g.weight/c.totalWeight);
      assert.ok(c.gifts.every(other => other.value <= g.value || other.chance <= g.chance));
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
    assert.ok(expected > 0 && c.price % 50 === 0);
    assert.equal(c.breakEvenPercent,100*covered/c.totalWeight);
  }
});

test('20 fixed prices survive quote changes; premium tickets never award out-of-band prizes',()=>{
  const market = parseMarket(JSON.parse(readFileSync(new URL('../lib/fragment-snapshot.json',import.meta.url))));
  const cases=buildCases(market), empty=buildCases({prices:{}});
  assert.equal(cases.length,20);assert.equal(new Set(cases.map(c=>c.id)).size,20);
  assert.deepEqual(empty.map(c=>c.price),cases.map(c=>c.price));assert.ok(empty.every(c=>!c.totalWeight));
  assert.deepEqual(cases.filter(c=>c.premium).map(c=>c.price),[45000,60000,75000,90000,100000]);
  for(const stars of [29999,30000,1000000,1000001]) {
    const editions=buildCases({prices:{'plush-pepe':{stars,ton:1000}}}).filter(c=>c.premium);
    assert.equal(editions.some(c=>c.totalWeight>0),stars>=30000 && stars<=1000000);
  }
  for(const c of cases.filter(c=>c.premium)) assert.ok(c.gifts.every(g=>market.prices[g.id].stars>=30000 && market.prices[g.id].stars<=1000000));
});
