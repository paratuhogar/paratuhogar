import { dedupeIncomingOrders, loadOwnerSnapshot } from './stats-data.mjs?v=20260928-finance-3';
import { renderActivePanel, renderFilters, renderSourceStatus } from './stats-render.mjs?v=20260928-google-1';
import { periodBounds } from './stats-finance.mjs?v=20260928-finance-3';
import { loadGoogleSources, STATS_CONFIG } from './stats-sources.mjs?v=20260928-google-1';
import {panelAvailability,googleLoadingSources} from './stats-google.mjs?v=20260928-google-1';

const tabs = ['summary', 'finance', 'orders', 'products', 'managers', 'marketing'];
const OWNER_IDS = new Set(['38f20b63-a845-4a03-8d10-9a57da2ac2c4', '6193f310-1e3f-4404-b874-977d0e23a6a0']);
const state = { tab: 'summary', period: 'month', filters: { from: '', to: '', gestor: 'all', proveedor: 'all', municipio: 'all', estado: 'all' }, snapshot: { orders: [], products: [], traffic: [], views: [] }, loading: true };
let charts = [];
let monitorInitialized = false;
let ordersInFlight=false;
let googleRequest=0;
let googleKey='';
let googleAt=0;
const seenOrderIds = new Set();

const CHART_COLORS = ['#43d6e8', '#39df9a', '#f6bd56', '#ff7272'];

function chartOptions(type) {
  const isCircular = type === 'doughnut';
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, labels: { color: '#cbd7dd', usePointStyle: true, boxWidth: 8 } },
      tooltip: {
        callbacks: {
          label(context) {
            const value = Number(context.parsed?.y ?? context.parsed ?? 0);
            return `${context.dataset.label}: ${Number.isFinite(value) ? value.toLocaleString('es-ES', { maximumFractionDigits: 2 }) : '0'}`;
          }
        }
      }
    },
    scales: isCircular ? {} : {
      x: { ticks: { color: '#8da0ad', maxRotation: 0, autoSkip: true }, grid: { color: 'rgba(141,160,173,.12)' } },
      y: { beginAtZero: true, ticks: { color: '#8da0ad' }, grid: { color: 'rgba(141,160,173,.12)' } }
    }
  };
}

function drawCharts(models = {}, panel) {
  if (typeof window.Chart !== 'function') return [];
  const definitions = {
    daily: { type: 'line' },
    statuses: { type: 'doughnut' },
    hourly: { type: 'bar' },
    products: { type: 'bar' },
    managers: { type: 'bar' },
    traffic: { type: 'line' },
    views: { type: 'bar' }
  };
  for(const [key,model] of Object.entries(models))if(key.startsWith('google'))definitions[key]={type:model.type||'bar'};
  return Object.entries(definitions).flatMap(([key, definition]) => {
    const canvas = panel?.querySelector(`[data-chart-canvas="${key}"]`);
    const model = models[key];
    if (!canvas || !model) return [];
    const datasets = (model.datasets || []).map((item, index) => ({
      ...item,
      borderColor: CHART_COLORS[index % CHART_COLORS.length],
      backgroundColor: definition.type === 'doughnut' ? CHART_COLORS : `${CHART_COLORS[index % CHART_COLORS.length]}99`,
      borderWidth: 2,
      borderRadius: definition.type === 'bar' ? 5 : undefined,
      tension: definition.type === 'line' ? 0.35 : undefined,
      fill: false,
      pointRadius: definition.type === 'line' ? 3 : undefined
    }));
    return [new window.Chart(canvas, { type: definition.type, data: { labels: model.labels || [], datasets }, options: chartOptions(definition.type) })];
  });
}

function readSession() {
  try { return JSON.parse(window.localStorage.getItem('pth_session') || 'null'); } catch { return null; }
}

function isOwner(session) {
  const role = String(session?.data?.rol || '').toLowerCase();
  const id = String(session?.data?.id || session?.id || '');
  return role === 'superadmin' && OWNER_IDS.has(id);
}

function setMessage(kind, message) {
  const box = document.querySelector('[data-app-message]');
  if (!box) return;
  box.className = kind === 'error' ? 'error-state' : kind === 'loading' ? 'loading-state' : 'notice';
  box.textContent = message;
  box.hidden = !message;
}

function updateOrderMonitor(newOrders = []) {
  const status = document.getElementById('order-monitor-status');
  const count = document.getElementById('new-orders-count');
  const list = document.getElementById('new-orders-list');
  if (status) { status.textContent = 'Activo · API segura'; status.className = 'source-state connected'; }
  if (count) count.textContent = String(newOrders.length);
  if (list && newOrders.length) {
    list.className = 'metric-list';
    list.innerHTML = newOrders.slice(0, 6).map(order => `<div class="metric-row"><div class="metric-row-head"><span>${String(order.producto || 'Pedido nuevo').replace(/[&<>"']/g, '')}</span><span class="money">$${Number(order.total || 0).toFixed(2)}</span></div><small>${String(order.estado || 'Pendiente').replace(/[&<>"']/g, '')}</small></div>`).join('');
  } else if (list) {
    list.className = 'empty-state';
    list.textContent = 'Sin pedidos nuevos detectados.';
  }
  if (newOrders.length && 'Notification' in window && Notification.permission === 'granted') {
    new Notification('Nuevo pedido en ParaTuHogar', { body: `${newOrders.length} pedido(s) nuevo(s) detectado(s).` });
  }
}

function render() {
  renderFilters(state.snapshot, state.filters);
  renderSourceStatus(state.snapshot);
  for (const tab of tabs) {
    const button = document.querySelector(`[data-tab="${tab}"]`);
    const panel = document.querySelector(`[data-panel="${tab}"]`);
    const active = state.tab === tab;
    button?.classList.toggle('active', active);
    button?.setAttribute('aria-selected', String(active));
    if (panel) panel.hidden = !active;
  }
  const unavailable=panelAvailability(state,state.tab);
  const output = unavailable?{html:unavailable,chartModels:{}}:renderActivePanel({ tab: state.tab, snapshot: state.snapshot, filters: effectiveFilters(), period: state.period, now: new Date().toISOString() });
  const panel = document.querySelector(`[data-panel="${state.tab}"]`);
  const openDetails = panel ? [...panel.querySelectorAll('details')].map((detail,index) => detail.open ? index : -1) : [];
  charts.forEach(chart => chart?.destroy?.());
  charts = [];
  if (panel) panel.innerHTML = output.html;
  panel?.querySelectorAll('details').forEach((detail,index) => { detail.open = openDetails.includes(index); });
  charts = drawCharts(output.chartModels, panel);
  const refreshed = document.querySelector('[data-refreshed-at]');
  if (refreshed) refreshed.textContent = state.snapshot.loadedAt ? `${state.error?'Datos anteriores · ':''}Actualizado ${new Date(state.snapshot.loadedAt).toLocaleTimeString('es-ES')}` : state.loading?'Cargando pedidos…':'Pedidos no disponibles';
}

function effectiveFilters() {
  if (state.filters.from || state.filters.to) return { ...state.filters, timeZone: 'America/Havana' };
  const [start, end] = periodBounds(state.period, new Date(), 'America/Havana');
  const endDate = new Date(end.getTime() - 1);
  const localDate = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Havana', year:'numeric', month:'2-digit', day:'2-digit' }).format(date);
  return { ...state.filters, from: localDate(start), to: localDate(endDate), timeZone: 'America/Havana' };
}

async function loadData({ initial = false } = {}) {
  if(ordersInFlight)return;
  const session = readSession();
  if (!isOwner(session)) {
    setMessage('error', 'Acceso reservado a Ángel y Marcel.');
    document.querySelector('[data-private-content]')?.setAttribute('hidden', '');
    return;
  }
  ordersInFlight=true;
  state.loading=true;
  setMessage('loading', initial ? 'Validando acceso y cargando fuentes seguras…' : 'Actualizando datos…');
  try {
    const client = window.supabase.createClient(STATS_CONFIG.supabaseUrl, STATS_CONFIG.supabaseKey,{global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(20000)})}});
    const snapshot = await loadOwnerSnapshot({ client, session });
    state.snapshot = {...snapshot,google:state.snapshot.google};
    state.error='';
    const newOrders = monitorInitialized ? dedupeIncomingOrders(state.snapshot.orders, seenOrderIds) : [];
    state.snapshot.orders.forEach(order => seenOrderIds.add(String(order.id)));
    monitorInitialized = true;
    updateOrderMonitor(newOrders);
    state.loading = false;
    setMessage('', '');
    render();
  } catch (error) {
    state.loading = false;
    state.error=error.message;
    setMessage('error', `No se pudo actualizar el panel: ${error.message}. Los datos anteriores pueden estar desactualizados.`);
    const monitor=document.getElementById('order-monitor-status');
    if(monitor){monitor.textContent='Sin actualización · revisar conexión';monitor.className='source-state pending';}
    render();
  } finally {
    ordersInFlight=false;
  }
}

async function loadGoogle({force=false}={}){
  const session=readSession();if(!isOwner(session))return;
  const range=effectiveFilters();range.from ||= range.to;range.to ||= range.from;
  const key=`${range.from}/${range.to}`;
  if(!force&&key===googleKey&&Date.now()-googleAt<300000)return;
  const previous=key===googleKey?state.snapshot.google:null;
  googleKey=key;googleAt=Date.now();const request=++googleRequest;
  state.snapshot.google=googleLoadingSources(previous);render();
  try{
    const sources=await loadGoogleSources(session,range);
    if(request!==googleRequest)return;
    for(const name of ['analytics','search'])if(sources[name].state==='error'&&previous?.[name]?.reports)sources[name]={...previous[name],state:'stale',message:sources[name].message};
    state.snapshot.google=sources;
  }catch(e){
    if(request!==googleRequest)return;
    googleAt=0;
    state.snapshot.google=Object.fromEntries(['analytics','search'].map(name=>[name,previous?.[name]?.reports?{...previous[name],state:'stale',message:e.message}:{state:'error',message:e.message}]));
  }
  render();
}

function bind() {
  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => { state.tab = button.dataset.tab; render(); }));
  document.querySelector('[data-refresh]')?.addEventListener('click', () => {loadData();loadGoogle({force:true});});
  document.querySelector('[data-period]')?.addEventListener('change', event => { state.period = event.target.value; for (const key of ['from','to']) { state.filters[key] = ''; document.querySelector(`[data-filter="${key}"]`).value = ''; } render();loadGoogle(); });
  for (const field of ['from', 'to', 'gestor', 'proveedor', 'municipio', 'estado']) document.querySelector(`[data-filter="${field}"]`)?.addEventListener('change', event => { state.filters[field] = event.target.value; render();if(field==='from'||field==='to')loadGoogle(); });
}

bind();
loadData({ initial: true });
loadGoogle();
window.setInterval(() => loadData(), STATS_CONFIG.refreshMs);
