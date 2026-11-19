// The client interpolates the display only. Debits, crash time and settlement are server-owned.
function mountFlight({api, onBalance}) {
  const el = id => document.getElementById(id);
  const stage = el('rocketStage'), button = el('rocketStart'), stake = el('rocketStake');
  let round = null, synced = 0, serverTime = 0, timer, frame, generation = 0, pending = false, visible = false;
  function paint(cents) {
    const t = 1 - Math.pow(cents / 100, -1.15);
    const x = 58 + 234*t, y = 186 - 45*t - 88*t*t;
    el('trail').setAttribute('d', `M12 201 Q34 197 58 186 Q${58+117*t} ${186-22.5*t} ${x} ${y}`);
    el('ship').setAttribute('transform', `translate(${x} ${y}) rotate(${-Math.atan2(45+176*t,234)*180/Math.PI})`);
    el('flightTag').setAttribute('transform', `translate(${x-33} ${y+12+12*t})`);
    el('rocketMultiplier').textContent = '×' + (cents/100).toFixed(2);
  }
  function tick() {
    if (!visible || round?.status !== 'flying') return;
    const elapsed = serverTime - round.start + Math.min(800, performance.now()-synced);
    paint(Math.min(10000, Math.floor(100*Math.exp(elapsed/round.growthMs))));
    frame = requestAnimationFrame(tick);
  }
  function apply(data) {
    clearTimeout(timer); cancelAnimationFrame(frame);
    round = data.round; synced = performance.now(); serverTime = data.now;
    if (data.balances) onBalance(data.balances);
    const flying = round?.status === 'flying';
    stage.dataset.state = round?.status || 'idle';
    stake.disabled = flying; if (flying) stake.value = round.stake;
    button.textContent = flying ? 'Забрать выигрыш' : 'Сделать ставку';
    el('rocketStatus').textContent = !round ? '' : flying ? `В полёте · ${round.stake} ★` : round.status === 'won' ? `Забрано ${round.payout} ★` : `Сбой · потеряно ${round.stake} ★`;
    paint(round?.cents || 100);
    if (visible && flying) { tick(); timer = setTimeout(refresh, 450); }
  }
  async function refresh() {
    const seq = ++generation;
    try {
      const data = await api('/api/rocket');
      if (seq === generation) { apply(data); button.disabled = false; return true; }
    } catch {
      if (seq !== generation) return;
      button.disabled = true; el('rocketStatus').textContent = 'Восстанавливаем связь…';
      if (visible) timer = setTimeout(refresh, 1200);
    }
  }
  button.onclick = async () => {
    if (pending) return;
    const flying = round?.status === 'flying';
    if (!flying && !stake.reportValidity()) return;
    pending = true; button.disabled = true; ++generation; clearTimeout(timer);
    try {
      const payload = flying ? {id:round.id} : {id:crypto.randomUUID(), previous:round?.id ?? null, stake:stake.valueAsNumber};
      apply(await api('/api/rocket/' + (flying?'cashout':'start'), {method:'POST',body:JSON.stringify(payload)}));
      button.disabled = false;
    } catch (e) {
      if (await refresh()) el('rocketStatus').textContent = e.message;
    } finally { pending = false; }
  };
  paint(100);
  return active => {
    visible = active; clearTimeout(timer); cancelAnimationFrame(frame); ++generation;
    if (visible && !pending) { button.disabled = true; refresh(); }
  };
}
