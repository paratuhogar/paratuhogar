/* Private aggregated ranking. No orders, customer fields, money or persistent cache. */
(function (root) {
 'use strict';
 let generation = 0, inFlight = null, loaded = null;
 const host = () => root.document.getElementById('gestor-ranking');
 const el = (tag, text, classes = '') => { const node = root.document.createElement(tag); if (text != null) node.textContent = String(text); node.className = classes; return node; };
 function goal(count) { return [1, 3, 5].find(value => value > count) || count + 1; }
 function metric(label, value) {
  const block = el('div', null, 'min-w-0 rounded-2xl bg-blue-50 p-4');
  block.append(el('p', label, 'text-[10px] font-bold text-slate-500'), el('strong', value, 'mt-1 block text-xl font-black text-[#1a4789]')); return block;
 }
 function row(person, me) {
  const item = el('li', null, 'flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 bg-white p-3'); item.dataset.accountId = person.id;
  item.append(el('span', '#' + person.rank, 'w-10 shrink-0 text-sm font-black text-[#1a4789]'));
  const alias = el('span', person.alias + (person.id === me ? ' · Tú' : ''), 'min-w-0 flex-1 break-words text-xs font-bold text-slate-700');
  alias.dataset.rankingAlias = ''; item.append(alias, el('strong', person.count + (person.count === 1 ? ' entrega' : ' entregas'), 'shrink-0 text-xs font-black text-emerald-700')); return item;
 }
 function action(label, run, primary = false) {
  const button = el('button', label, primary ? 'min-h-11 rounded-xl bg-[#1a4789] px-4 py-3 text-xs font-black text-white' : 'min-h-11 rounded-xl border border-blue-100 bg-white px-4 py-3 text-xs font-black text-[#1a4789]');
  button.type = 'button'; button.addEventListener('click', run); return button;
 }
 function render(data) {
  const container = host(); if (!container) return;
  container.replaceChildren(); container.dataset.rankingState = 'ready';
  const header = el('div', null, 'flex flex-wrap items-start justify-between gap-3');
  const titles = el('div'); titles.append(el('p', 'CLASIFICACIÓN MENSUAL', 'text-[10px] font-black tracking-widest text-[#1a4789]'), el('h2', 'Cada entrega cuenta', 'mt-1 text-xl font-black text-slate-900'));
  const month = new Intl.DateTimeFormat('es', { timeZone: 'America/Havana', month: 'long', year: 'numeric' }).format(new Date(data.period.startAt));
  const date = value => value.slice(8, 10) + '/' + value.slice(5, 7);
  const period = el('p', month + ' · ' + date(data.period.startDate) + '–' + date(data.period.endDate) + ' · hora de Cuba', 'mt-2 text-xs font-bold text-slate-500'); period.dataset.rankingPeriod = '';
  titles.append(period); header.append(titles, action('Actualizar', () => load(true))); container.append(header);
  const me = data.self, next = goal(me.count), remaining = next - me.count;
  if (me.participates && me.identityReliable) {
   const metrics = el('div', null, 'mt-4 grid grid-cols-3 gap-2');
   metrics.append(metric('Tu puesto', me.rank ? '#' + me.rank : 'Sin puesto'), metric('Entregas del mes', me.count), metric('Próxima meta', next)); container.append(metrics);
   const progress = el('progress', null, 'mt-4 h-2 w-full accent-blue-700'); progress.max = next; progress.value = me.count; progress.setAttribute('aria-label', 'Entregas hacia tu próxima meta'); container.append(progress);
   container.append(el('p', 'Te ' + (remaining === 1 ? 'falta 1 entrega' : 'faltan ' + remaining + ' entregas') + ' para llegar a ' + next + ' este mes.', 'mt-2 text-xs font-bold text-slate-600'));
   const badges = el('div', null, 'mt-3 flex flex-wrap gap-2');
   for (const amount of [1, 3, 5]) {
    const achieved = me.lifetimeCount >= amount;
    const badge = el('span', (achieved ? '✓ ' : '○ ') + (amount === 1 ? 'Primera entrega' : amount + ' entregas'), 'rounded-full border border-slate-200 px-3 py-1 text-[10px] font-bold text-slate-600'); badge.dataset.achieved = String(achieved); badges.append(badge);
   }
   container.append(el('p', 'Tus logros acumulados', 'mt-4 text-[10px] font-bold text-slate-500'), badges);
  } else container.append(el('p', me.participates ? 'Tu cuenta necesita una identificación inequívoca para asignar las entregas. No inventaremos un puesto.' : 'Vista de administración: consulta la clasificación sin participar en ella.', 'mt-4 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800'));
  container.append(el('p', 'Solo cuentan pedidos entregados con fecha de entrega registrada este mes. Cada pedido cuenta para quien lo vendió; las ventas de una cuenta colaboradora no se suman también a la principal.', 'mt-4 text-[11px] leading-relaxed text-slate-500'));
  container.append(el('p', 'La misma cantidad de entregas comparte puesto: 1, 1, 3. El orden de las cuentas empatadas no da ventaja.', 'mt-2 text-[11px] leading-relaxed text-slate-500'));
  if (!data.historyComplete) {
   const notice = me.undatedCount ? me.undatedCount + ' de tus entregas no tienen una fecha válida y quedan fuera del mes.' : 'El historial tiene fechas incompletas. Las entregas sin fecha no se asignan a ningún mes.';
   container.append(el('p', notice + ' Los logros acumulados cuentan entregas identificadas, sin inventar cuándo ocurrieron.', 'mt-3 rounded-xl bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800'));
  }
  container.append(el('h3', 'Primeras cuentas del mes', 'mt-5 text-xs font-black text-slate-800'));
  const top = el('ol', null, 'mt-2 space-y-2'); top.dataset.rankingTop = '';
  for (const person of data.top) top.append(row(person, me.id));
  if (!data.top.length) top.append(el('li', 'Aún no hay entregas con fecha registrada este mes. Puedes dar el primer paso.', 'rounded-xl bg-blue-50 p-3 text-xs font-bold text-slate-600'));
  container.append(top);
  const topIds = new Set(data.top.map(person => person.id)), nearby = data.nearby.filter(person => !topIds.has(person.id));
  if (nearby.length) {
   const details = el('details', null, 'mt-3'); details.append(el('summary', 'Tu posición y cuentas cercanas', 'cursor-pointer py-2 text-xs font-black text-[#1a4789]'));
   const list = el('ol', null, 'mt-2 space-y-2'); list.dataset.rankingNearby = ''; for (const person of nearby) list.append(row(person, me.id)); details.append(list); container.append(details);
  }
  const actions = el('div', null, 'mt-5 grid grid-cols-2 gap-2');
  actions.append(action('Compartir productos', () => root.openGestorTool?.('mensaje'), true), action('Crear pedido', () => {
   if (typeof cart !== 'undefined' && cart.length) root.toggleCartModal?.(true); else root.openGestorTool?.('catalogo');
  })); container.append(actions);
  container.append(el('p', 'Para crear un pedido, elige un producto, añádelo al carrito y completa los datos de entrega.', 'mt-2 text-[10px] leading-relaxed text-slate-500'));
  container.append(el('p', 'Actualizado: ' + new Intl.DateTimeFormat('es', { timeZone: 'America/Havana', dateStyle: 'short', timeStyle: 'short' }).format(new Date(data.updatedAt)), 'mt-4 text-[10px] text-slate-400'));
 }
 function state(message, retry = false) {
  const container = host(); if (!container) return; container.replaceChildren(); container.dataset.rankingState = retry ? 'error' : 'loading';
  container.append(el('h2', 'Tu clasificación y próxima meta', 'text-lg font-black text-slate-900'), el('p', message, 'mt-2 text-xs leading-relaxed text-slate-500'));
  if (retry) container.append(action('Reintentar clasificación', () => load(true)));
 }
 async function load(force = false) {
  if (!host() || !root.currentUserData?.id) return;
  if (!root.PTHSecureData?.token()) { state('Inicia sesión para comprobar tu clasificación actual.', true); return; }
  if (root.navigator.onLine === false) { state('Estás sin conexión. Tus pedidos guardados siguen disponibles; reintenta la clasificación al recuperar internet.', true); return; }
  const token = root.PTHSecureData.token(), id = root.currentUserData.id;
  if (inFlight?.token === token && inFlight.id === id) return inFlight.promise;
  if (!force && loaded?.token === token && loaded.id === id && Date.now() - loaded.at < 60000) return;
  const version = generation; state('Comprobando entregas y posición…');
  const pending = { token, id }; inFlight = pending;
  pending.promise = (async () => {
   try {
    const result = await root.PTHSecureData.ranking();
    if (version !== generation || token !== root.PTHSecureData.token() || id !== root.currentUserData?.id) return;
    if (result.error || !result.data?.period || result.data.self?.id !== id) throw Error('ranking unavailable');
    render(result.data); loaded = { token, id, at: Date.now() };
   } catch (_) { if (version === generation && token === root.PTHSecureData.token() && id === root.currentUserData?.id) state('No se pudo actualizar la clasificación. Comprueba la conexión y reintenta; no mostraremos una posición sin verificar.', true); }
   finally { if (inFlight === pending) inFlight = null; }
  })(); return pending.promise;
 }
 function clear() { generation++; inFlight = loaded = null; host()?.replaceChildren(); }
 root.addEventListener('pth:session-changed', clear); root.addEventListener('pagehide', clear);
 root.PTHRanking = { load, clear, goal };
})(window);
