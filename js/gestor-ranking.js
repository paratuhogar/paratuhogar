/* Private aggregated ranking. No orders, customer fields, money or persistent cache. */
(function (root) {
 'use strict';
 let generation = 0, inFlight = null, loaded = null;
 const host = () => root.document.getElementById('gestor-ranking');
 const el = (tag, text, classes = '') => { const node = root.document.createElement(tag); if (text != null) node.textContent = String(text); node.className = classes; return node; };
 function goal(count) { return [1, 3, 5].find(value => value > count) || count + 1; }
 function distance(data) {
  if (!data.self.count || data.self.rank === 1) return null;
  if(data.self.nextHigherCount !== undefined) return data.self.nextHigherCount === null ? null : {tie:data.self.nextHigherCount-data.self.count,overtake:data.self.nextHigherCount-data.self.count+1,rank:null};
  const candidates = data.self.rank <= 4 ? [...data.top, ...data.nearby] : data.nearby;
  const higher = candidates.filter(p => p.count > data.self.count).sort((a,b) => a.count-b.count)[0];
  return higher ? {tie:higher.count-data.self.count, overtake:higher.count-data.self.count+1, rank:higher.rank} : null;
 }
 function daysLeft(period, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Havana',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));
  const get = type => parts.find(p=>p.type===type).value;
  return Math.max(0, Math.round((Date.parse(period.endDate+'T00:00:00Z')-Date.parse(get('year')+'-'+get('month')+'-'+get('day')+'T00:00:00Z'))/86400000));
 }
 const observations = new Map();
 function milestoneEvents(previous, data) {
  const me=data.self;
  if (!previous || !previous.self.participates || !previous.self.identityReliable || !me.participates || !me.identityReliable || previous.period.key!==data.period.key) return [];
  const events=[1,3,5].filter(n=>previous.self.lifetimeCount<n&&me.lifetimeCount>=n).map(n=>({key:'lifetime-'+n,label:n===1?'¡Tu primera entrega!': '¡'+n+' entregas alcanzadas!'}));
  if(me.rank&&me.rank<=3&&(!previous.self.rank||previous.self.rank>3)) events.push({key:data.period.key+'-podium',label:'¡Entraste al podio!'});
  if(me.rank===1&&previous.self.rank!==1) events.push({key:data.period.key+'-leader',label:'¡Llegaste a la cima!'});
  return events;
 }
 function celebrate(data, container) {
  const previous=observations.get(data.self.id); observations.set(data.self.id,data);
  const events=milestoneEvents(previous,data).filter(event=>{
   const key='pth-ranking-hito:'+data.self.id+':'+event.key;
   try { if(root.localStorage.getItem(key)) return false; root.localStorage.setItem(key,'1'); } catch (_) { return false; }
   return true;
  });
  if(!events.length) return;
  const notice=el('p',events.map(e=>e.label).join(' '),'ranking-celebration'); notice.setAttribute('role','status'); container.append(notice);
  root.setTimeout(()=>notice.remove(),4500);
 }
 function shareCard(data) {
  const canvas=root.document.createElement('canvas');canvas.width=1080;canvas.height=1080;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#102d55';ctx.fillRect(0,0,1080,1080);
  ctx.textAlign='center';ctx.fillStyle='#e8c66c';ctx.font='bold 40px sans-serif';ctx.fillText('PARA TU HOGAR · ENTREGAS',540,180);
  ctx.fillStyle='#fff';ctx.font='bold 64px sans-serif';ctx.fillText(data.self.rank===1?'La cima del mes':'Cada entrega cuenta',540,330);
  ctx.font='bold 48px sans-serif';ctx.fillText(data.self.alias,540,480,920);
  ctx.font='bold 130px sans-serif';ctx.fillText(String(data.self.count),540,690);
  ctx.font='36px sans-serif';ctx.fillText('entregas · '+data.period.key+' · hora de Cuba',540,780);
  ctx.font='30px sans-serif';ctx.fillText('Mes en curso · clasificación provisional',540,930);
  const link=root.document.createElement('a');link.download='mis-entregas-'+data.period.key+'.png';link.href=canvas.toDataURL('image/png');link.click();
 }
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
  const titles = el('div'); titles.append(el('p', 'CLASIFICACIÓN MENSUAL', 'text-[10px] font-black tracking-widest text-[#1a4789]'), el('h2', 'La cima del mes', 'mt-1 text-xl font-black text-slate-900'));
  const month = new Intl.DateTimeFormat('es', { timeZone: 'America/Havana', month: 'long', year: 'numeric' }).format(new Date(data.period.startAt));
  const date = value => value.slice(8, 10) + '/' + value.slice(5, 7);
  const period = el('p', month + ' · ' + date(data.period.startDate) + '–' + date(data.period.endDate) + ' · hora de Cuba', 'mt-2 text-xs font-bold text-slate-500'); period.dataset.rankingPeriod = '';
  titles.append(period); header.append(titles, action('Actualizar', () => load(true))); container.append(header);
  const left=daysLeft(data.period), closed=Date.now()>=Date.parse(data.period.endAt);
  container.append(el('p',closed?'El mes terminó. Actualiza para ver la nueva oportunidad.':'Cierre: '+date(data.period.endDate)+' · '+(left===0?'Último día':left+' días restantes')+' · Cada mes, una nueva oportunidad.','ranking-deadline'));
  const leaders=data.top.filter(p=>p.rank===1), leaderCount=data.leaderCount;
  const monthLabel=key=>new Intl.DateTimeFormat('es',{timeZone:'America/Havana',month:'long',year:'numeric'}).format(new Date(key+'-15T12:00:00Z'));
  const summit=el('div',null,'ranking-summit'); summit.append(el('span','♛','ranking-crown'));
  summit.append(el('p',(leaderCount??leaders.length)>1?'Liderazgo compartido · mes en curso':'Liderazgo · mes en curso','ranking-eyebrow'));
  if(leaders.length) for(const leader of leaders){const line=el('div',null,'ranking-leader');line.append(el('strong',leader.alias),el('span',leader.count+(leader.count===1?' entrega':' entregas')));summit.append(line);}
  else summit.append(el('strong','La primera entrega abre el camino'));
  if(leaders.length) summit.append(el('p',leaderCount===undefined?'Selección parcial: se muestran hasta tres cuentas. Puede haber más líderes empatados, con el mismo reconocimiento.':leaderCount>1?leaderCount+' cuentas comparten la cima. '+(leaderCount>leaders.length?'Se muestran '+leaders.length+' aliases; todas tienen el mismo reconocimiento.':'Todas tienen el mismo reconocimiento.'):'Una cuenta lidera este mes.','ranking-summit-note'));
  summit.append(el('p',leaders.length?'Cada nueva entrega abre una posibilidad de llegar a la cima.':'Todavía no hay entregas con fecha este mes.','ranking-summit-note')); container.append(summit);
  const me = data.self, next = goal(me.count), remaining = next - me.count;
  if (me.participates && me.identityReliable) {
   const personal=el('div',null,'ranking-personal'); container.append(personal); const metrics = el('div', null, 'grid grid-cols-3 gap-2');
   metrics.append(metric('Tu puesto', me.rank ? '#' + me.rank : 'Sin puesto'), metric('Entregas del mes', me.count), metric('Próxima meta', next)); personal.append(metrics);
   const gap=distance(data);personal.append(el('p',me.count===0?'Tu primera entrega te pone en marcha.':me.rank===1?'Estás en la cima. Cada nueva entrega cuenta.':gap?'Te faltan '+gap.tie+' para empatar '+(gap.rank?'el puesto #'+gap.rank:'el siguiente puesto')+' y '+gap.overtake+' para superarlo.':'Sigue hacia tu próxima meta. La distancia al siguiente puesto no está disponible en este resumen.','ranking-distance'));
   personal.append(action('Descargar tarjeta para compartir',()=>shareCard(data)));
   const progress = el('progress', null, 'mt-4 h-2 w-full accent-blue-700'); progress.max = next; progress.value = me.count; progress.setAttribute('aria-label', 'Entregas hacia tu próxima meta'); container.append(progress);
   container.append(el('p', 'Te ' + (remaining === 1 ? 'falta 1 entrega' : 'faltan ' + remaining + ' entregas') + ' para llegar a ' + next + ' este mes.', 'mt-2 text-xs font-bold text-slate-600'));
   const badges = el('div', null, 'mt-3 flex flex-wrap gap-2');
   for (const amount of [1, 3, 5]) {
    const achieved = me.lifetimeCount >= amount;
    const badge = el('span', (achieved ? '✓ ' : '○ ') + (amount === 1 ? 'Primera entrega' : amount + ' entregas'), 'rounded-full border border-slate-200 px-3 py-1 text-[10px] font-bold text-slate-600'); badge.dataset.achieved = String(achieved); badges.append(badge);
   }
   container.append(el('p', 'Tus logros acumulados', 'mt-4 text-[10px] font-bold text-slate-500'), badges);
   for(const badge of me.monthlyBadges||[])container.append(el('p','♛ Liderazgo de '+monthLabel(badge.month)+' · '+badge.count+' entregas','ranking-monthly-badge'));
  } else container.append(el('p', me.participates ? 'Tu cuenta necesita una identificación inequívoca para asignar las entregas. No inventaremos un puesto.' : 'Administración · consulta del mes; esta cuenta no participa.', 'mt-4 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800'));
  const rules=el('details',null,'ranking-rules');rules.append(el('summary','Cómo cuenta cada entrega'));
  rules.append(el('p', 'Solo cuentan pedidos entregados con fecha de entrega registrada este mes. Cada pedido cuenta para quien lo vendió; las ventas de una cuenta colaboradora no se suman también a la principal.', 'mt-4 text-[11px] leading-relaxed text-slate-500'));
  rules.append(el('p', 'La misma cantidad de entregas comparte puesto: 1, 1, 3. El orden de las cuentas empatadas no da ventaja.', 'mt-2 text-[11px] leading-relaxed text-slate-500'));
  container.append(rules);
  if (!data.historyComplete) {
   const notice = me.undatedCount ? me.undatedCount + (me.participates ? ' de tus entregas' : ' entregas de esta cuenta') + ' no tienen una fecha válida y quedan fuera del mes.' : 'El historial tiene fechas incompletas. Las entregas sin fecha no se asignan a ningún mes.';
   container.append(el('p', notice + ' Los logros acumulados cuentan entregas identificadas, sin inventar cuándo ocurrieron.', 'mt-3 rounded-xl bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800'));
  }
  container.append(el('h3', 'Podio del mes', 'mt-5 text-xs font-black text-slate-800'));
  const top = el('ol', null, 'mt-2 space-y-2'); top.dataset.rankingTop = '';
  for (const person of data.top) top.append(row(person, me.id));
  if (!data.top.length) top.append(el('li', 'Aún no hay entregas con fecha registrada este mes. Puedes dar el primer paso.', 'rounded-xl bg-blue-50 p-3 text-xs font-bold text-slate-600'));
  container.append(top);
  const topIds = new Set(data.top.map(person => person.id)), nearby = data.nearby.filter(person => !topIds.has(person.id));
  if (nearby.length) {
   const details = el('details', null, 'mt-3'); details.append(el('summary', 'Tu siguiente paso · cuentas cercanas', 'cursor-pointer py-2 text-xs font-black text-[#1a4789]'));
   const list = el('ol', null, 'mt-2 space-y-2'); list.dataset.rankingNearby = ''; for (const person of nearby) list.append(row(person, me.id)); details.append(list); container.append(details);
  }
  const history=data.history||[];
  if(history.length){
   container.append(el('h3','Meses reconocidos','mt-5 text-xs font-black text-slate-800'));
   const list=el('ol',null,'ranking-history');
   for(const month of history){const item=el('li');item.append(el('strong',monthLabel(month.month)),el('p',month.aliases.join(' · ')+' · '+month.count+' entregas'),el('p',month.leaderCount>month.aliases.length?month.leaderCount+' líderes reconocidos. Selección de '+month.aliases.length+' aliases.':'Liderazgo '+(month.leaderCount>1?'compartido':'del mes')+' confirmado tras el cierre.'));list.append(item);}container.append(list);
  }else container.append(el('p','El reconocimiento mensual se confirmará solo después del cierre. Todavía no hay meses cerrados y verificados para mostrar.','ranking-history-note'));
  celebrate(data,container);
  const actions = el('div', null, 'mt-5 grid grid-cols-2 gap-2');
  actions.append(action('Preparar próxima venta', () => root.openGestorTool?.('mensaje'), true), action('Crear pedido', () => {
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
  if (!force && loaded?.token === token && loaded.id === id && Date.now() - loaded.at < 60000 && Date.now() < loaded.endAt) return;
  const version = generation; state('Comprobando entregas y posición…');
  const pending = { token, id }; inFlight = pending;
  pending.promise = (async () => {
   try {
    const result = await root.PTHSecureData.ranking();
    if (version !== generation || token !== root.PTHSecureData.token() || id !== root.currentUserData?.id) return;
    if (result.error || !result.data?.period || result.data.self?.id !== id) throw Error('ranking unavailable');
    render(result.data); loaded = { token, id, at: Date.now(), endAt: Date.parse(result.data.period.endAt) };
   } catch (_) { if (version === generation && token === root.PTHSecureData.token() && id === root.currentUserData?.id) state('No se pudo actualizar la clasificación. Comprueba la conexión y reintenta; no mostraremos una posición sin verificar.', true); }
   finally { if (inFlight === pending) inFlight = null; }
  })(); return pending.promise;
 }
 function clear() { generation++; inFlight = loaded = null; host()?.replaceChildren(); }
 root.addEventListener('pth:session-changed', clear); root.addEventListener('pagehide', clear);
 root.PTHRanking = { load, clear, goal, distance, daysLeft, milestoneEvents };
})(window);
