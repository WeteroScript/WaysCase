import { parseMarket } from '../lib/market.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { buildCases, draw } from '../lib/catalog.mjs';
import { startRound, cashOut, roundView } from '../lib/rocket.mjs';

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
test('rocket rejects invalid stakes, charges once and never publishes its deadline', () => {
  const u = {balances:{stars:100}}, args = {id:randomUUID(), stake:100, previous:null};
  for (const stake of [0,-1,'100',1.5,101,100001]) assert.throws(() => startRound(u,{...args,stake},100));
  startRound(u,args,100); startRound(u,args,100);
  assert.equal(u.balances.stars,0);
  assert.throws(() => startRound(u,{...args,id:randomUUID()},100));
  assert.equal(roundView(u,100).crashAt, undefined);
});
test('settlement uses server time, including at the crash boundary and after reload', () => {
  const r = {id:randomUUID(),stake:40,start:0,crashAt:9000};
  const u = {balances:{stars:60},rocket:{...r}};
  cashOut(u,r,4500);
  const payout = Math.floor(40*roundView(u,4500).cents/100);
  assert.equal(u.balances.stars,60+payout);
  cashOut(u,r,10000); assert.equal(u.balances.stars,60+payout);
  u.rocket = {...r}; cashOut(u,r,9000);
  assert.equal(roundView(structuredClone(u),9001).status,'crashed');
  assert.equal(u.balances.stars,60+payout);
});
