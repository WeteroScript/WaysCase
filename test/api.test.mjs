import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac, randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';

const token = 'local-fixture';
function signedHeader() {
  const p = new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:42,first_name:'Test'})});
  const secret = createHmac('sha256','WebAppData').update(token).digest();
  p.set('hash',createHmac('sha256',secret).update([...p].map(kv=>kv.join('=')).sort().join('\n')).digest('hex'));
  return 'tma '+p;
}
test('authenticated concurrent openings debit once; insufficient balance never awards a gift', {timeout:8000}, async t => {
  const dir = await mkdtemp(join(tmpdir(),'wayscase-'));
  const child = spawn(process.execPath,['--input-type=module','-e',`import {readFileSync} from 'node:fs';
    globalThis.fetch = async url => {
      if (!url.startsWith('https://api.github.com/')) throw new Error('offline test');
      const data = JSON.parse(readFileSync('lib/fragment-snapshot.json')); data.date = new Date().toISOString().slice(0,10);
      return Response.json(data);
    }; await import('./server.mjs');`],{env:{...process.env,PORT:'0',DATA_DIR:dir,BOT_TOKEN:token},stdio:['ignore','pipe','ignore']});
  t.after(async () => { const exit = once(child,'exit'); child.kill(); await exit; await rm(dir,{recursive:true,force:true}); });
  let origin;
  for await (const line of createInterface({input:child.stdout})) {
    if (line.includes('server listening')) { origin='http://127.0.0.1:'+line.match(/port=(\d+)/)[1]; break; }
  }
  const post = (path,body) => fetch(origin+path,{method:'POST',headers:{authorization:signedHeader(),'content-type':'application/json'},body:JSON.stringify(body)});
  const catalogue = await (await fetch(origin+'/api/catalog')).json();
  const cost = catalogue.cases[0].price;
  const args = {version:catalogue.market.version,caseId:'first-light',requestId:randomUUID()};
  assert.equal((await post('/api/open',args)).status,409);
  assert.equal((await post('/api/claim-starter-stars',{})).status,200);
  const responses = await Promise.all([post('/api/open',args),post('/api/open',args)]);
  const [a,b] = await Promise.all(responses.map(r=>r.json()));
  assert.equal(a.balances.stars,10000-cost); assert.equal(b.item.id,a.item.id);
  const me = await (await fetch(origin+'/api/me',{headers:{authorization:signedHeader()}})).json();
  assert.equal(me.user.inventory.length,1); assert.equal(me.user.balances.ton,500);
  assert.equal((await fetch(origin+'/api/rocket')).status,404);
  for(const path of ['/api/rocket/start','/api/rocket/cashout']) assert.equal((await post(path,{})).status,404);
  assert.equal((await fetch(origin+a.item.modelImageUrl)).headers.get('content-type'),'image/webp');
  const sale = {itemId:a.item.id,version:catalogue.market.version};
  assert.equal((await post('/api/sell',{...sale,version:'outdated'})).status,409);
  const [sold,replay] = await Promise.all([post('/api/sell',sale),post('/api/sell',sale)].map(async p=>(await p).json()));
  assert.deepEqual(sold,replay);
  assert.equal(sold.user.inventory.length,0);
  assert.equal(sold.user.balances.stars,10000-cost+catalogue.market.prices[a.item.giftId].stars);
  assert.equal((await post('/api/open',args)).status,409);
  assert.equal((await post('/api/upgrade',{...sale,targetId:'plush-pepe'})).status,409);
  const profile = async () => (await (await fetch(origin+'/api/me',{headers:{authorization:signedHeader()}})).json()).user;
  const before = await profile();
  const batch = {...args,requestId:randomUUID(),quantity:5};
  for (const quantity of [null,0,6,1.5,'5']) assert.equal((await post('/api/open',{...batch,quantity})).status,400);
  const affordableOnce = catalogue.cases.find(c => !c.premium && c.price <= before.balances.stars && c.price*5 > before.balances.stars);
  const denied = await post('/api/open',{...batch,caseId:affordableOnce.id});
  assert.equal(denied.status,409);
  assert.equal((await denied.json()).error,'insufficient_balance');
  assert.deepEqual(await profile(),before);
  const [first, retry] = await Promise.all([post('/api/open',batch),post('/api/open',batch)].map(async p=>(await p).json()));
  assert.deepEqual(first,retry);
  assert.equal(new Set(first.items.map(i=>i.id)).size,5);
  assert.equal(first.balances.stars,before.balances.stars-cost*5);
  assert.equal(first.totalOpens,before.totalOpens+5);
  assert.equal((await profile()).inventory.length,5);
  assert.equal((await post('/api/open',{...batch,quantity:1})).status,409);
  assert.equal((await post('/api/sell',{itemId:first.items[2].id,version:batch.version})).status,200);
  assert.equal((await post('/api/open',batch)).status,409);
  assert.equal((await profile()).inventory.length,4);
  const sellGroup = body => post('/api/sell-batch',body);
  const untouched = await profile();
  for (const requestId of [batch.requestId,undefined,randomUUID(),args.requestId]) {
    assert.equal((await sellGroup({requestId,version:batch.version})).status,409);
  }
  assert.deepEqual(await profile(),untouched);
  const pair = {...batch,quantity:2,requestId:randomUUID()};
  const opening = await (await post('/api/open',pair)).json();
  const expected = opening.items.reduce((n,i)=>n+catalogue.market.prices[i.giftId].stars,0);
  const prior = await profile();
  assert.equal((await sellGroup({...pair,version:'stale'})).status,409);
  assert.deepEqual(await profile(),prior);
  const receipts = await Promise.all([sellGroup(pair),sellGroup(pair)].map(async p=>(await p).json()));
  assert.deepEqual(receipts[0],receipts[1]);
  assert.equal(receipts[0].receipt.credited,expected);
  assert.equal(receipts[0].user.balances.stars,prior.balances.stars+expected);
  assert.deepEqual(receipts[0].user.inventory,untouched.inventory);
  assert.equal((await post('/api/sell',{itemId:opening.item.id,version:pair.version})).status,409);

});
