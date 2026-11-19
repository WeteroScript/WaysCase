import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {presentGift} from '../lib/gift-art.mjs';
import {buildCases,gifts} from '../lib/catalog.mjs';

const asset = path => readFileSync(new URL('../public'+path,import.meta.url));
test('each case has its own illustrated plate, separate from gift artwork',()=>{
  const cases=buildCases({prices:{}});
  assert.equal(new Set(cases.map(c=>c.coverImageUrl)).size,10);
  for(const c of cases) assert.ok(asset(c.coverImageUrl).toString().includes(`<title>${c.title}</title>`));
});
test('legacy and current models resolve to local art without changing saved items',()=>{
  const rows=[...gifts.map(g=>[g.id,g.models[0].name]),['heart-locket','Cirque'],['durovs-cap','Asterix'],['plush-pepe','Cozy Galaxy'],['bunny-muffin','Diamond'],['heart-locket','Black Hole'],['precious-peach','999Karat']];
  for (const [giftId,modelName] of rows){
    const item=Object.freeze({id:'saved',giftId,modelName,modelImageUrl:'/api/model.svg?gift='+giftId});
    const view=presentGift(item);
    assert.equal(view.collectionPreview,false); assert.equal(view.id,item.id); assert.equal(view.modelName,modelName);
    assert.equal(asset(view.modelImageUrl).toString('ascii',8,12),'WEBP');
    if(view.animationUrl) assert.ok(JSON.parse(gunzipSync(asset(view.animationUrl))).layers.length);
  }
  const other=presentGift({giftId:'plush-pepe',modelName:'Unbundled',modelImageUrl:'/removed.webp'});
  assert.ok(other.collectionPreview); assert.equal(other.modelImageUrl,'/assets/gifts/plush-pepe.webp'); assert.equal(other.animationUrl,null);
  assert.ok(asset(presentGift({giftId:'retired'}).modelImageUrl).length);
});
