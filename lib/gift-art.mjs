import { gifts } from './catalog.mjs';

const key = (id, model) => `${id}:${String(model || '').toLowerCase().replace(/[^a-z0-9]/g,'')}`;
const posters = new Map();
const collections = new Map(gifts.map(g => [g.id,g.models[0].imageUrl]));
for (const gift of gifts) {
  const model = gift.models[0];
  posters.set(key(gift.id,model.name), [model.imageUrl, `/assets/animations/${gift.id}.tgs`]);
}
for (const [id,model,file,animated] of [
  ['heart-locket','Cirque','heart-locket-cirque'], ['durovs-cap','Asterix','durovs-cap-asterix'],
  ['plush-pepe','Cozy Galaxy','plush-pepe-cozy-galaxy',true], ['bunny-muffin','Diamond','bunny-muffin-diamond',true],
  ['heart-locket','Black Hole','heart-locket'], ['precious-peach','999Karat','precious-peach'],
]) posters.set(key(id,model), [`/assets/gifts/${file}.webp`,animated ? `/assets/animations/${file}.tgs` : null]);

// Old saves still contain /api/model.svg URLs. Resolve art at the API boundary,
// never rewrite ownership, model identity or a user's persisted receipt.
export function presentGift(item) {
  const art = posters.get(key(item.giftId,item.modelName));
  return {...item,modelImageUrl:art?.[0] || collections.get(item.giftId) || null,
    animationUrl:art?.[1] || null, collectionPreview:!art};
}
