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
  const child = spawn(process.execPath,['--input-type=module','-e',"globalThis.fetch = async () => {throw new Error('offline test')}; await import('./server.mjs');"],{env:{...process.env,PORT:'0',DATA_DIR:dir,BOT_TOKEN:token},stdio:['ignore','pipe','ignore']});
  t.after(async () => { const exit = once(child,'exit'); child.kill(); await exit; await rm(dir,{recursive:true,force:true}); });
  let origin;
  for await (const line of createInterface({input:child.stdout})) {
    if (line.includes('server listening')) { origin='http://127.0.0.1:'+line.match(/port=(\d+)/)[1]; break; }
  }
  const post = (path,body) => fetch(origin+path,{method:'POST',headers:{authorization:signedHeader(),'content-type':'application/json'},body:JSON.stringify(body)});
  const args = {caseId:'first-light',requestId:randomUUID()};
  assert.equal((await post('/api/open',args)).status,409);
  assert.equal((await post('/api/claim-starter-stars',{})).status,200);
  const responses = await Promise.all([post('/api/open',args),post('/api/open',args)]);
  const [a,b] = await Promise.all(responses.map(r=>r.json()));
  assert.equal(a.balances.stars,9900); assert.equal(b.item.id,a.item.id);
  const me = await (await fetch(origin+'/api/me',{headers:{authorization:signedHeader()}})).json();
  assert.equal(me.user.inventory.length,1); assert.equal(me.user.balances.ton,500);
  const bet = await (await post('/api/rocket/start',{id:randomUUID(),previous:null,stake:900})).json();
  assert.equal(bet.balances.stars,9000); assert.equal(bet.round.stake,900);
  assert.equal((await fetch(origin+a.item.modelImageUrl)).headers.get('content-type'),'image/webp');
});
