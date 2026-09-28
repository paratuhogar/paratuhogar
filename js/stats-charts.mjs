import { aggregateByProduct, calculateOrderProfit, statusKind } from './stats-finance.mjs?v=20260928-finance-3';

const LABELS = {
  revenue: {
    title: 'Ventas entregadas',
    body: 'Suma de los pedidos marcados como entregados. No incluye pendientes ni cancelados.'
  },
  profit: {
    title: 'Ganancia neta de Ángel',
    body: 'Ventas entregadas menos mensajería, costo del proveedor, bolsa comercial completa (comisión base y sobreprecio del gestor) y tarifa del sistema. El reparto con el subgestor no se descuenta de nuevo. Los pedidos con incidencias se excluyen del subtotal de ganancia. Se usa el costo actual del catálogo, no un costo histórico confirmado.'
  },
  margin: {
    title: 'Margen neto',
    body: 'Ganancia calculable dividida entre las ventas de esos mismos pedidos. Excluye del numerador y del denominador los pedidos con incidencias.'
  },
  pending: {
    title: 'Pedidos pendientes',
    body: 'Pedidos que todavía no están entregados ni cancelados y requieren una acción para entregar desde almacén o mensajería.'
  },
  cancelRate: {
    title: 'Tasa de cancelación',
    body: 'Pedidos cancelados divididos entre todos los pedidos del periodo. Ayuda a detectar problemas de disponibilidad o atención.'
  },
  providerCost: {
    title: 'Costo del proveedor',
    body: 'Costo actual del catálogo por cantidad vendida. Si falta o el producto no se identifica de forma única, su ganancia queda pendiente y se excluye del subtotal.'
  },
  delivery: {
    title: 'Mensajería',
    body: 'Costo de entregar el pedido. Se descuenta de la venta antes de calcular la ganancia de Ángel.'
  },
  commission: {
    title: 'Comisiones',
    body: 'Bolsa comercial registrada en el pedido: comisión base más todo el sobreprecio del gestor. Incluye la parte que este paga al subgestor. Se descuenta una sola vez, independientemente de si ya fue pagada.'
  },
  systemFee: {
    title: 'Tarifa del sistema',
    body: 'Importe del libro contable de Master, incluido lo ya liquidado. Para pedidos antiguos sin registro solo se reconstruye si hay un único producto. Los mixtos sin registro quedan pendientes; nunca se aplica un promedio general.'
  },
  clicks: {
    title: 'Clics internos',
    body: 'Interacciones registradas en enlaces o botones de la tienda. Miden interés, no ventas confirmadas.'
  },
  views: {
    title: 'Vistas de producto',
    body: 'Veces que se consultó una ficha de producto. Sirve para comparar atención del catálogo con ventas.'
  }
};

function numeric(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value) {
  return Math.round((numeric(value) + Number.EPSILON) * 100) / 100;
}

function timestamp(order) {
  const value = order?.fecha ?? order?.created_at ?? order?.createdAt;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function zonedParts(value, timeZone = 'America/Havana') {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}

function dayKey(value, timeZone) {
  const parts = zonedParts(value, timeZone);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : '';
}

function dataset(label, data, extra = {}) {
  return { label, data, ...extra };
}

function emptyDaily() {
  return { labels: [], datasets: [dataset('Ventas', []), dataset('Ganancia', [])] };
}

function dailySeries(orders, products, timeZone) {
  const rows = new Map();
  for (const order of orders) {
    if (statusKind(order?.estado) !== 'delivered') continue;
    const date = timestamp(order);
    if (!date) continue;
    const key = dayKey(date, timeZone);
    const result = calculateOrderProfit(order, products);
    const row = rows.get(key) || { revenue: 0, profit: 0, calculable: 0 };
    row.revenue += result.revenue;
    if (result.profit !== null) { row.profit += result.profit; row.calculable += 1; }
    rows.set(key, row);
  }
  const labels = [...rows.keys()].sort();
  return {
    labels,
    datasets: [
      dataset('Ventas', labels.map(key => round(rows.get(key).revenue))),
      dataset('Ganancia calculable · catálogo actual', labels.map(key => rows.get(key).calculable ? round(rows.get(key).profit) : null))
    ]
  };
}

function orderHours(orders, timeZone) {
  const labels = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`);
  const delivered = Array(24).fill(0);
  const pending = Array(24).fill(0);
  for (const order of orders) {
    const date = timestamp(order);
    if (!date) continue;
    const parts = zonedParts(date, timeZone);
    const index = Number(parts?.hour);
    if (!Number.isInteger(index) || index < 0 || index > 23) continue;
    if (statusKind(order?.estado) === 'delivered') delivered[index] += 1;
    else if (statusKind(order?.estado) === 'pending') pending[index] += 1;
  }
  return { labels, datasets: [dataset('Pedidos entregados', delivered), dataset('Pedidos pendientes', pending)] };
}

function statusSeries(orders) {
  const counts = { delivered: 0, pending: 0, cancelled: 0 };
  for (const order of orders) counts[statusKind(order?.estado)] += 1;
  return {
    labels: ['Entregados', 'Pendientes', 'Cancelados'],
    datasets: [dataset('Pedidos', [counts.delivered, counts.pending, counts.cancelled])]
  };
}

function productSeries(orders, products) {
  const rows = aggregateByProduct({ orders, products }).slice(0, 10);
  return {
    labels: rows.map(row => row.name),
    datasets: [
      dataset('Ventas', rows.map(row => round(row.revenue))),
      dataset('Ganancia calculable · catálogo actual', rows.map(row => row.profit === null ? null : round(row.profit)))
    ]
  };
}

function managerSeries(orders, products) {
  const rows = new Map();
  for (const order of orders) {
    if (statusKind(order?.estado) !== 'delivered') continue;
    const name = String(order.gestor || 'Venta directa');
    const result = calculateOrderProfit(order, products);
    const row = rows.get(name) || { sales: 0, profit: 0, calculable: 0 };
    row.sales += result.revenue;
    if (result.profit !== null) { row.profit += result.profit; row.calculable += 1; }
    rows.set(name, row);
  }
  const sorted = [...rows.entries()].sort(([, a], [, b]) => b.sales - a.sales).slice(0, 10);
  return {
    labels: sorted.map(([name]) => name),
    datasets: [
      dataset('Ventas', sorted.map(([, row]) => round(row.sales))),
      dataset('Ganancia calculable · catálogo actual', sorted.map(([, row]) => row.calculable ? round(row.profit) : null))
    ]
  };
}

function sourceDay(row, timeZone) {
  const value = row?.dia ?? row?.fecha ?? row?.date;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return dayKey(value, timeZone);
}

export function filterSourceRows(rows = [], { from = '', to = '', timeZone = 'America/Havana' } = {}) {
  if (!from && !to) return rows;
  return rows.filter(row => {
    const day = sourceDay(row, timeZone);
    if (!day) return false;
    return (!from || day >= from) && (!to || day <= to);
  });
}

function sourceSeries(rows, labelKey, valueKey, limit = 14, { rankByValue = false } = {}) {
  const totals = new Map();
  for (const row of rows || []) {
    const label = String(row?.[labelKey] ?? row?.fecha ?? row?.date ?? row?.nombre ?? '').trim();
    if (!label) continue;
    totals.set(label, (totals.get(label) || 0) + numeric(row?.[valueKey]));
  }
  const sorted = [...totals.entries()]
    .sort(rankByValue ? ([, a], [, b]) => b - a : ([a], [b]) => a.localeCompare(b))
    .slice(0, limit);
  return { labels: sorted.map(([label]) => label), datasets: [dataset(labelKey === 'dia' ? 'Clics' : 'Vistas', sorted.map(([, value]) => round(value)))] };
}

export function buildChartModels({ orders = [], products = [], traffic = [], views = [], from = '', to = '', timeZone = 'America/Havana' } = {}) {
  const filteredTraffic = filterSourceRows(traffic, { from, to, timeZone });
  const filteredViews = filterSourceRows(views, { from, to, timeZone });
  return {
    daily: dailySeries(orders, products, timeZone),
    hourly: orderHours(orders, timeZone),
    statuses: statusSeries(orders),
    products: productSeries(orders, products),
    managers: managerSeries(orders, products),
    traffic: sourceSeries(filteredTraffic, 'dia', 'clics', Infinity),
    views: sourceSeries(filteredViews, 'producto', 'vistas', 14, { rankByValue: true })
  };
}

export function explainMetric(key) {
  return LABELS[key] || { title: 'Cómo leerlo', body: 'Esta métrica resume la actividad del periodo seleccionado.' };
}
