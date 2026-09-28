import { aggregateByProduct, aggregatePeriod, calculateOrderProfit, statusKind } from './stats-finance.mjs?v=20260928-finance-3';
import { distinctValues, filterOrders } from './stats-data.mjs?v=20260928-finance-3';
import { buildChartModels, explainMetric, filterSourceRows } from './stats-charts.mjs?v=20260928-finance-3';
import {renderGoogleReports,sourceLabel} from './stats-google.mjs?v=20260928-google-1';

const money = value => value == null ? '—' : `$${Number(value).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const number = value => Number(value || 0).toLocaleString('es-ES');
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const tone = value => value == null ? 'warning' : value < 0 ? 'negative' : 'positive';

export function renderSourceStatus(snapshot = {}) {
  const source = document.querySelector('[data-source-status="traffic"]');
  if (source) source.textContent = snapshot.loadedAt ? 'Conectado · clics internos' : 'Pendiente de datos internos';
  for(const name of ['analytics','search']){
    const el=document.querySelector(`[data-google-status="${name}"]`);
    if(el){el.textContent=sourceLabel(snapshot.google?.[name]);el.className=`source-state ${['connected','empty'].includes(snapshot.google?.[name]?.state)?'connected':'pending'}`;}
  }
}
export function renderFilters(snapshot = {}, filters = {}) {
  for (const field of ['gestor', 'proveedor', 'municipio', 'estado']) {
    const select = document.querySelector(`[data-filter="${field}"]`);
    if (!select) continue;
    const values = distinctValues(snapshot.orders || [], field);
    select.innerHTML = `<option value="all">Todos</option>${values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}`;
    select.value = values.includes(filters[field]) ? filters[field] : 'all';
  }
}
function help(key) {
  const { title, body } = explainMetric(key);
  return `<details class="metric-help"><summary>¿Qué significa?</summary><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p></details>`;
}
function kpi(label, value, key, foot = '', color = '') {
  return `<article class="kpi-card"><span class="kpi-label">${label}</span><strong class="kpi-value ${color}">${value}</strong><span class="kpi-foot">${foot}</span>${help(key)}</article>`;
}
function heading(title, subtitle) { return `<div class="section-heading"><div><h2>${title}</h2><p>${subtitle}</p></div></div>`; }
function table(headers, rows) {
  return `<div class="data-table-wrap"><table class="data-table"><thead><tr>${headers.map(text => `<th>${text}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(cells => `<tr>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}">Sin datos para estos filtros.</td></tr>`}</tbody></table></div>`;
}
function chart(key, title, subtitle, metric = 'profit') {
  return `<section class="stats-card chart-card"><div class="stats-card-head"><div><h3>${title}</h3><small>${subtitle}</small></div></div><div class="chart-wrap"><canvas data-chart-canvas="${key}" role="img" aria-label="${title}"></canvas></div>${help(metric)}</section>`;
}
function financeFor({ orders = [], products = [], filters = {}, period, now }) {
  return aggregatePeriod({ orders: filterOrders(orders, filters), products, period, now, from: filters.from, to: filters.to, timeZone: filters.timeZone || 'America/Havana' });
}
function qualityNotice(finance) {
  return `<div class="notice">Costos del catálogo actual: el resultado es provisional, no un beneficio histórico confirmado. ${number(finance.calculableOrders)} de ${number(finance.orders)} pedidos entregados permiten cálculo.${finance.estimatedOrders ? ` <strong>${number(finance.estimatedOrders)} pedidos (${money(finance.excludedRevenue)} en ventas) quedan fuera de la ganancia por datos pendientes.</strong>` : ''} El periodo corresponde a la fecha de creación del pedido; no al momento del cobro o de la entrega.</div>`;
}
function profitCard(finance) {
  return kpi('Ganancia neta de Ángel · calculable', money(finance.profit), 'profit', finance.estimatedOrders ? 'Subtotal parcial · revisar Finanzas' : 'Provisional · catálogo actual', tone(finance.profit));
}

export function renderSummary(args) {
  const filtered = filterOrders(args.orders || [], args.filters);
  const finance = financeFor(args);
  const pending = filtered.filter(order => statusKind(order.estado) === 'pending');
  const cancelled = filtered.filter(order => statusKind(order.estado) === 'cancelled');
  return { finance, html: `${heading('Lectura ejecutiva', 'Ventas, resultado calculable y pedidos que requieren revisión.')}${qualityNotice(finance)}
    <div class="kpi-grid">${profitCard(finance)}${kpi('Ventas entregadas', money(finance.revenue), 'revenue', `${number(finance.orders)} pedidos`, 'cyan')}${kpi('Pendientes de entregar', number(pending.length), 'pending', 'Dentro de los filtros seleccionados', 'amber')}${kpi('Tasa de cancelación', `${filtered.length ? (cancelled.length / filtered.length * 100).toFixed(1) : '0.0'}%`, 'cancelRate', `${number(cancelled.length)} cancelados`, 'amber')}</div>
    <div class="chart-grid" style="margin-top:14px">${chart('daily', 'Ventas y ganancia por día', 'Ventas: todos los entregados. Ganancia: solo pedidos calculables.')}${chart('statuses', 'Estado de los pedidos', 'Pedidos del periodo seleccionado.', 'pending')}</div>` };
}

export function renderFinance(args) {
  const finance = financeFor(args);
  const details = filterOrders(args.orders || [], args.filters).filter(order => statusKind(order.estado) === 'delivered').map(order => ({ order, result: calculateOrderProfit(order, args.products) }));
  const pending = details.filter(({ result }) => result.profit === null);
  const auditRows = details.map(({ order, result }) => [escapeHtml(order.orden_dia || order.id), escapeHtml(order.producto), money(result.revenue), money(result.providerCost), money(result.deliveryCost), `${money(result.commission)}<small class="kpi-foot"> Bolsa completa; incluye sobreprecio y reparto</small>`, `${money(result.systemFee)}<small class="kpi-foot"> ${result.feeSource === 'ledger' ? 'Libro contable' : 'Reconstruida'}</small>`, `<span class="${tone(result.profit)}">${money(result.profit)}</span>`, escapeHtml(result.issues.length ? result.issues.join('; ') : 'Provisional: costo actual del catálogo')]);
  return `${heading('Ganancia de Ángel', 'Venta − proveedor − mensajería − bolsa comercial completa − tarifa del sistema.')}${qualityNotice(finance)}
    <div class="kpi-grid">${profitCard(finance)}${kpi('Margen calculable', finance.margin === null ? '—' : `${finance.margin}%`, 'margin', 'Solo ventas de pedidos calculables', tone(finance.margin))}${kpi('Bolsa comercial descontada', money(finance.commission), 'commission', 'Pedidos incluidos en el subtotal', 'amber')}${kpi('Tarifa del sistema descontada', money(finance.systemFee), 'systemFee', 'Pagada o pendiente · mismo gasto', 'cyan')}</div>
    <div class="chart-grid" style="margin-top:14px">${chart('daily', 'Resultado diario', 'Los huecos indican que no hay ganancia calculable.')}<section class="stats-card"><h3>Conciliación del subtotal calculable</h3>${table(['Concepto', 'USD'], [['Ventas incluidas', money(finance.calculableRevenue)], ['Proveedor', money(-finance.providerCost)], ['Mensajería', money(-finance.deliveryCost)], ['Bolsa comercial (gestor y subgestor)', money(-finance.commission)], ['Tarifa del sistema', money(-finance.systemFee)], ['Ganancia provisional', money(finance.profit)]])}${help('commission')}</section></div>
    <section class="stats-card" style="margin-top:14px"><h3>Pendientes de comprobar · ${pending.length}</h3>${table(['Pedido', 'Producto', 'Motivo'], pending.map(({order,result}) => [escapeHtml(order.orden_dia || order.id), escapeHtml(order.producto), escapeHtml(result.issues.join('; '))]))}</section>
    <details class="stats-card" style="margin-top:14px"><summary>Ver cálculo pedido por pedido · ${details.length}</summary>${table(['Pedido','Producto','Venta','Proveedor','Mensajería','Bolsa comercial','Sistema','Ganancia','Calidad'], auditRows)}</details>`;
}

export function renderOrders({ orders = [], filters = {} }) {
  const visible = filterOrders(orders, filters).sort((a,b) => String(b.fecha).localeCompare(String(a.fecha)));
  const buckets = { 'Pedidos de almacén': [], 'Pedidos de mensajería': [], 'Sin asignar': [] };
  visible.filter(order => statusKind(order.estado) === 'pending').forEach(order => {
    const text = `${order.tipo_entrega} ${order.estado}`;
    const key = /mensaj/i.test(text) ? 'Pedidos de mensajería' : /almac[eé]n/i.test(text) ? 'Pedidos de almacén' : 'Sin asignar';
    buckets[key].push(order);
  });
  return `${heading('Pedidos y entrega', 'Pendientes dentro del periodo y filtros seleccionados.')}<div class="source-grid">${Object.entries(buckets).map(([title,rows]) => `<section class="stats-card"><h3>${title}</h3><strong class="kpi-value amber">${rows.length}</strong>${rows.slice(0,5).map(order => `<p>${escapeHtml(order.orden_dia || order.id)} · ${escapeHtml(order.producto)} · ${money(order.total)}</p>`).join('')}${help('pending')}</section>`).join('')}</div>
    <div class="chart-grid" style="margin:14px 0">${chart('statuses','Estado de los pedidos','Entregados, pendientes y cancelados.','pending')}${chart('hourly','Hora de llegada','Hora de creación del pedido en La Habana.','pending')}</div>
    <details class="stats-card"><summary>Ver todos los pedidos · ${visible.length}</summary>${table(['Fecha','Pedido','Estado','Gestor','Entrega','Total'], visible.map(order => [escapeHtml(new Date(order.fecha).toLocaleString('es-ES',{timeZone:'America/Havana'})), escapeHtml(order.orden_dia || order.id), escapeHtml(order.estado), escapeHtml(order.gestor), escapeHtml(order.tipo_entrega), money(order.total)]))}</details>`;
}

export function renderProducts({ orders = [], products = [], filters = {} }) {
  const rows = aggregateByProduct({ orders: filterOrders(orders, filters), products });
  return `${heading('Productos', 'Ventas y unidades entregadas. En pedidos mixtos el reparto de ventas es orientativo por cantidad.')}<div class="notice">La ganancia usa costos actuales del catálogo. Si falta un costo o no hay desglose histórico de un pedido mixto, se muestra —; no se inventa una ganancia por producto.</div>${chart('products','Productos que más venden','Diez primeros por ventas. Ganancia pendiente: sin barra.')}
    <section class="stats-card" style="margin-top:14px">${table(['Producto','Unidades','Pedidos','Ventas','Ganancia provisional','Calidad'], rows.map(row => [escapeHtml(row.name),number(row.quantity),number(row.orders),money(row.revenue),`<span class="${tone(row.profit)}">${money(row.profit)}</span>`, `<details><summary>${row.estimated ? 'Pendiente de comprobar' : 'Catálogo actual'}</summary><p>${escapeHtml(row.estimated ? row.issues.join('; ') : 'Costo actual del catálogo. No confirma el costo histórico de la venta.')}</p></details>`]))}</section>`;
}

export function renderManagers({ orders = [], filters = {} }) {
  const map = new Map();
  for (const order of filterOrders(orders, filters)) {
    if (statusKind(order.estado) !== 'delivered') continue;
    const key = order.gestor || 'Venta directa';
    const row = map.get(key) || { name: key, sales: 0, orders: 0, commission: 0 };
    row.sales += Number(order.total || 0); row.orders++; row.commission += Number(order.comision_total || 0); map.set(key,row);
  }
  const rows = [...map.values()].sort((a,b) => b.sales-a.sales);
  return `${heading('Quién vende más', 'Las ventas de subgestores se atribuyen al gestor principal registrado en el pedido.')}<div class="notice">La bolsa comercial incluye el sobreprecio del gestor y su reparto con el subgestor. La ganancia de Ángel usa costos actuales y excluye pedidos con incidencias.</div>${chart('managers','Ranking de vendedores','Ventas entregadas y ganancia calculable de Ángel.')}
    <section class="stats-card" style="margin-top:14px">${table(['Gestor','Pedidos entregados','Ventas','Ticket medio','Bolsa comercial'], rows.map(row => [escapeHtml(row.name),number(row.orders),money(row.sales),money(row.sales/row.orders),money(row.commission)]))}${help('commission')}</section>`;
}

export function renderMarketing({ snapshot, filters = {} }) {
  const traffic = filterSourceRows(snapshot.traffic || [], filters);
  const views = filterSourceRows(snapshot.views || [], filters);
  const internal=snapshot.loadedAt?`<div class="kpi-grid">${kpi('Clics internos',number(traffic.reduce((s,r)=>s+Number(r.clics||0),0)),'clicks','','cyan')}${kpi('Vistas de producto',number(views.reduce((s,r)=>s+Number(r.vistas||0),0)),'views','','cyan')}</div>
    <div class="chart-grid" style="margin-top:14px">${chart('traffic','Evolución de clics','Clics internos registrados.','clicks')}${chart('views','Productos más consultados','Vistas registradas por producto.','views')}</div>`:'<div class="notice">Datos internos aún no disponibles. Los informes de Google se cargan de forma independiente.</div>';
  return `${heading('Marketing y demanda', 'Estas fuentes admiten filtros de fecha; no tienen atribución por vendedor, proveedor, zona o estado.')}${internal}
    ${renderGoogleReports(snapshot.google).html}`;
}

export function renderActivePanel({ tab, snapshot, filters = {}, period, now }) {
  const chartModels = buildChartModels({ orders: filterOrders(snapshot.orders || [], filters), products: snapshot.products || [], traffic: snapshot.traffic || [], views: snapshot.views || [], from: filters.from, to: filters.to, timeZone: filters.timeZone || 'America/Havana' });
  const args = { ...snapshot, filters, period, now };
  const renderers = { finance: renderFinance, orders: renderOrders, products: renderProducts, managers: renderManagers };
  const html = tab === 'summary' ? renderSummary(args).html : renderers[tab] ? renderers[tab](args) : renderMarketing({ snapshot, filters });
  return { html, chartModels: tab==='marketing'?{...chartModels,...renderGoogleReports(snapshot.google).chartModels}:chartModels };
}
