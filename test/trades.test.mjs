import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { gifts } from '../lib/catalog.mjs';
import { parseMarket } from '../lib/market.mjs';
import { trade } from '../lib/trades.mjs';

const floor = JSON.parse(readFileSync(new URL('../lib/fragment-snapshot.json',import.meta.url)));
const fresh = {...parseMarket(floor),tradable:true,expiresAt:Date.now()+86400000};
const request = {itemId:'mine',targetId:'plush-pepe',version:fresh.version};
function user() { return {balances:{stars:10,ton:2},inventory:[{id:'mine',giftId:'toy-bear'}]}; }

test('published quotes are collection floors, not mint prices; absent listings stay unpriced',()=>{
  const sample = structuredClone(floor); delete sample.floors.toybear;
  sample.floors.candycane.floor_gram = -1;
  const market = parseMarket(sample);
  assert.equal(market.prices['toy-bear'],undefined); assert.equal(market.prices['candy-cane'],undefined);
  assert.equal(market.prices['plush-pepe'].ton,floor.floors.plushpepe.floor_gram);
  assert.notEqual(market.version,fresh.version);
  assert.throws(()=>parseMarket({...sample,source:'unknown'}));
});
test('sale credits the quoted game Stars once, even on retry, and never touches TON',()=>{
  const u=user(), credit=fresh.prices['toy-bear'].stars;
  assert.equal(trade(u,'sell',{...request,stars:99999999},fresh).credited,credit);
  trade(u,'sell',request,fresh);
  assert.deepEqual(u.balances,{stars:10+credit,ton:2});
  assert.throws(()=>trade(u,'upgrade',request,fresh));
});
test('upgrade consumes the input once and lands on the correct side of the displayed sector',()=>{
  const edge=Math.floor(1e6*(fresh.prices['toy-bear'].ton/fresh.prices['plush-pepe'].ton));
  for(const ticket of [edge-1,edge]) {
    const u=user(); const result=trade(u,'upgrade',request,fresh,()=>ticket);
    assert.equal(result.threshold,edge); assert.equal(result.won,ticket<edge);
    assert.equal(trade(u,'upgrade',request,fresh,()=>assert.fail('rolled twice')),result);
    const inventory=u.inventory.filter(i=>!i.spent);
    assert.deepEqual(inventory.map(i=>i.giftId),ticket<edge?['plush-pepe']:[]);
    assert.throws(()=>trade(u,'sell',request,fresh));
    assert.equal(u.balances.stars,10);
  }
});
test('stale or changed market, cheaper target, missing quote and foreign item never consume inventory',()=>{
  for (const [body,market] of [[{...request,itemId:'foreign'},fresh],[{...request,targetId:'toy-bear'},fresh],
    [{...request,targetId:'candy-cane'},fresh],[{...request,version:'old'},fresh],
    [request,{...fresh,expiresAt:Date.now()-1}],[request,{...fresh,prices:{}}]]) {
    const u=user(); assert.throws(()=>trade(u,'upgrade',body,market));assert.deepEqual(u,user());
  }
});
test('all catalogue models have a local animated Telegram sticker',()=>{
  for(const g of gifts){
    const sticker=JSON.parse(gunzipSync(readFileSync(new URL(`../public/assets/animations/${g.id}.tgs`,import.meta.url))));
    assert.ok(sticker.layers.length && sticker.op>sticker.ip && sticker.fr>0,g.name);
  }
});
