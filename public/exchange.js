function mountExchange({state, api, $, esc, giftForId, renderAll, upgradePercent}) {
  const number = new Intl.NumberFormat('ru-RU',{maximumFractionDigits:4});
  const market = () => state.catalogue?.market;
  const quote = id => market()?.prices[id];
  const tradable = () => market()?.tradable && Date.now() < market().expiresAt;
  const ownItems = () => state.user?.inventory || [];
  const artwork = gift => gift.models[0].imageUrl;
  const icon = (unit, value) => `<span class="coin ${unit}"><img src="/assets/currency/${unit}.svg" alt="${unit === 'star' ? 'Игровые Stars':'TON'}">${number.format(value)}</span>`;
  function price(id) {
    const q = quote(id);
    return q ? `<span class="price-pair">${icon('ton',q.ton)}${icon('star',q.stars)}</span>` : '<span class="price-none">Нет цены</span>';
  }
  function tile(g, options = {}) {
    const tag = options.key ? 'button' : 'article';
    const attrs = options.key ? ` type="button" data-key="${esc(options.key)}"` : '';
    return `<${tag} class="market-card"${attrs}>${!options.key ? price(g.id) : ''}<img class="art" ${options.key ? '' : 'loading="lazy"'} src="${esc(options.art || artwork(g))}" alt=""><strong>${esc(g.name)}</strong><small>${esc(options.model || g.models[0].name)}</small>${options.key ? price(g.id) : ''}${options.odds == null ? '' : `<small class="chance">Шанс ${percent(options.odds)}</small>`}</${tag}>`;
  }
  const percent = n => Math.round(n) + ' %';
  const chance = (src,dest) => upgradePercent(quote(src)?.ton, quote(dest)?.ton);
  const diagram = $('chanceWheel'), pointer = $('wheelPointer');
  let ownId, targetId, mode, upgrading = false, landed = false, prize, animation, selling = false;
  let lastRefresh = Date.now(), refreshing;
  const own = () => ownItems().find(i => i.id === ownId);
  function slot(button,item,art) {
    button.innerHTML = item ? `<img src="${esc(art)}" alt=""><small>${esc(item)}</small>` : '+';
  }
  function drawSlots() {
    if (upgrading) return;
    const src = own(), dest = targetId && giftForId(targetId);
    if (!src && !landed) { ownId=null; targetId=null; }
    if (src && dest && !(quote(dest.id)?.ton > quote(src.giftId)?.ton)) targetId = null;
    const both = src && targetId && quote(src.giftId) && quote(targetId);
    $('pickOwn').disabled = !state.user || !tradable();
    $('pickTarget').disabled = !src || !tradable();
    $('startUpgrade').disabled = !both || !tradable();
    if (landed) return;
    slot($('pickOwn'), src?.giftName, src?.modelImageUrl || (src && artwork(giftForId(src.giftId))));
    slot($('pickTarget'), targetId && dest?.name, targetId && artwork(dest));
    const n = both ? chance(src.giftId,targetId) : 0;
    diagram.style.setProperty('--arc',`${n*3.6}deg`);
    $('chanceLabel').textContent = both ? percent(n) : '—';
  }
  function renderGallery() {
    if (!state.catalogue) return;
    const normalize = text => text.toLowerCase().replace(/[^a-z0-9а-яё]/g,'');
    const query = normalize($('giftSearch').value);
    const visible = state.catalogue.gifts.filter(g => normalize(g.name).includes(query));
    $('marketGrid').innerHTML = visible.sort((a,b)=>(quote(a.id)?.ton ?? Infinity)-(quote(b.id)?.ton ?? Infinity))
      .map(g=>tile(g)).join('') || '<p class="status">Ничего не найдено.</p>';
  }
  $('giftSearch').addEventListener('input',renderGallery);
  function render() {
    if (!state.catalogue) return;
    $('marketDate').textContent = 'Fragment · '+market().date;
    $('marketCaption').textContent = 'Минимум по коллекции, включая аукционы. Stars — игровой эквивалент.' + (tradable() ? '' : ' Архивные цены: продажа и апгрейд недоступны.');
    renderGallery();
    drawSlots();
  }
  async function refreshIfDue(force = false) {
    if (!force && Date.now()-lastRefresh < 300000) return;
    if (!refreshing) refreshing = (async () => {
      const fresh = await api('/api/catalog');
      state.catalogue = fresh; lastRefresh = Date.now(); render();
    })().finally(()=>{refreshing=null;});
    try { await refreshing; } catch { /* Existing snapshot remains dated; server checks its expiry. */ }
  }
  function resetWheel() {
    landed = false; pointer.style.transform = 'rotate(0deg)';
    $('upgradeStatus').textContent = 'При неудаче свой подарок сгорает.';
  }
  function picker(which) {
    if (upgrading || !tradable()) return;
    mode = which;
    $('pickHeading').textContent = which === 'own' ? 'Выберите свой NFT' : 'Выберите желаемый NFT';
    const src = own();
    const cards = which === 'own' ? ownItems().filter(i=>quote(i.giftId)).map(i=>tile(giftForId(i.giftId),{key:i.id,art:i.modelImageUrl,model:i.modelName})) :
      state.catalogue.gifts.filter(g=>src && quote(g.id)?.ton > quote(src.giftId)?.ton).sort((a,b)=>quote(a.id).ton-quote(b.id).ton).map(g=>tile(g,{key:g.id,odds:chance(src.giftId,g.id)}));
    $('pickGrid').innerHTML = cards.join('') || `<p class="status">${which==='own'?'Нет подарков с рыночной ценой.':'Нет подарков дороже выбранного.'}</p>`;
    $('pickSheet').showModal();
  }
  $('pickOwn').onclick = ()=>picker('own'); $('pickTarget').onclick = ()=>picker('target');
  $('closePicker').onclick = ()=>$('pickSheet').close();
  $('pickGrid').onclick = e => {
    const key = e.target.closest('[data-key]')?.dataset.key;
    if (!key) return;
    resetWheel();
    if (mode==='own') { ownId=key; targetId=null; } else targetId=key;
    $('pickSheet').close(); drawSlots();
  };
  const post = (path,body) => api(path,{method:'POST',body:JSON.stringify(body)});
  $('startUpgrade').onclick = async () => {
    const src = own();
    if (!src || !targetId || upgrading) return;
    upgrading=true;
    for (const id of ['startUpgrade','pickOwn','pickTarget']) $(id).disabled=true;
    $('upgradeStatus').textContent = 'Апгрейд…';
    try {
      const data = await post('/api/upgrade',{itemId:src.id,targetId,version:market().version});
      state.user=data.user; renderAll();
      const {won,ticket,threshold} = data.receipt;
      // The marker lands in the exact millionth-sector that the server sampled.
      diagram.style.setProperty('--arc',`${threshold*360/1000000}deg`);
      $('chanceLabel').textContent=percent(threshold/10000);
      const end = `rotate(${1080+(ticket+.5)*360/1000000}deg)`;
      const spin = pointer.animate([{transform:'rotate(0deg)'},{transform:end}],{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:1600,easing:'cubic-bezier(.17,.72,.17,1)'});
      pointer.style.transform=end; await spin.finished;
      landed=true;
      $('upgradeStatus').textContent=won ? `Успех! ${giftForId(targetId).name} в инвентаре.` : 'Неудача. Исходный подарок списан.';
      ownId=null; targetId=null; renderAll();
    } catch(e) {
      $('upgradeStatus').textContent=e.message; await refreshIfDue(true);
    } finally { upgrading=false; drawSlots(); }
  };
  const sheet = $('rewardSheet');
  function sellButton() {
    const q=prize && quote(prize.giftId);
    $('sellGift').disabled=selling || !q || !tradable();
    $('sellValue').innerHTML=q ? icon('star',q.stars) : 'Нет цены';
  }
  function reward(item,newlyWon) {
    prize=item; const g=giftForId(item.giftId);
    $('rewardHeading').textContent=newlyWon?'Вы выиграли':'Ваш подарок';
    $('rewardName').textContent=item.giftName; $('rewardModel').textContent=[item.modelName, item.collectionPreview && 'Превью коллекции'].filter(Boolean).join(' · ');
    $('rewardStatus').textContent=tradable()?'Продажа за внутренние Stars.':'Нет свежих цен для продажи.';
    $('keepGift').textContent=newlyWon?'Забрать':'Закрыть'; $('sellGift').hidden=false;
    const poster=$('rewardPoster');
    const image = item.modelImageUrl || (g && artwork(g));
    poster.hidden=!image;
    if (image) poster.src=image; else poster.removeAttribute('src'); poster.alt=item.giftName;
    sellButton(); sheet.showModal();
    $('rewardMotion').classList.toggle('upright-snake',item.animationUrl === '/assets/animations/lunar-snake.tgs');
    if (item.animationUrl && window.lottie && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      animation=lottie.loadAnimation({container:$('rewardMotion'),renderer:'svg',loop:true,autoplay:true,path:item.animationUrl});
      animation.addEventListener('DOMLoaded',()=>{if(prize===item) poster.hidden=true;});
    }
  }
  $('inventoryRoot').onclick=e=>{
    const key=e.target.closest('[data-view-item]')?.dataset.viewItem;
    const item=ownItems().find(i=>i.id===key); if(item) reward(item,false);
  };
  sheet.oncancel=e=>{if(selling)e.preventDefault();};
  sheet.onclose=()=>{animation?.destroy();animation=null;prize=null;};
  $('keepGift').onclick=()=>sheet.close();
  $('sellGift').onclick=async()=>{
    if (!prize || selling) return;
    selling=true; sellButton(); $('keepGift').disabled=true;
    try {
      const data=await post('/api/sell',{itemId:prize.id,version:market().version});
      state.user=data.user; renderAll(); $('rewardHeading').textContent='Подарок продан';
      $('sellGift').hidden=true; $('keepGift').textContent='Закрыть';
      $('rewardStatus').textContent=`Начислено ${number.format(data.receipt.credited)} игровых Stars.`;
    } catch(e) { $('rewardStatus').textContent=e.message; await refreshIfDue(true); }
    finally { selling=false; $('keepGift').disabled=false; sellButton(); }
  };
  return {render,price,reward,refreshIfDue};
}
