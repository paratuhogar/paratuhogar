const EPSILON = 1e-9;

export function number(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((number(value) + EPSILON) * factor) / factor;
}

export function normalizedName(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function devFee(price) {
  const amount = number(price);
  if (amount <= 60) return 0.5;
  if (amount <= 150) return 1;
  if (amount <= 399) return 2;
  if (amount <= 999) return 3;
  return 5;
}

export function parseProductLines(productText) {
  const text = String(productText ?? '');
  return text
    .split(/\[(?:USD|CUP)\]/i.test(text) ? /(?<=\[(?:USD|CUP)\])\s*\+\s*/i : /\s+\+\s+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const match = line.match(/^(\d+)\s*x\s+(.+)$/i);
      const qty = match ? Math.max(1, Number.parseInt(match[1], 10) || 1) : 1;
      const name = (match ? match[2] : line)
        .replace(/\s*\[[^\]]*\]/g, '')
        .trim() || 'Producto sin nombre';
      return { name, qty };
    });
}

function productsList(products) {
  if (products instanceof Map) return [...products.values()];
  return Array.isArray(products) ? products : [];
}

function findProduct(products, name, provider = '') {
  const target = normalizedName(name);
  const providerTarget = normalizedName(provider);
  const exact = products.filter(product => normalizedName(product?.nombre) === target);
  const sameProvider = exact.filter(product => providerTarget && normalizedName(product?.proveedor) === providerTarget);
  if (sameProvider.length === 1) return sameProvider[0];
  if (sameProvider.length > 1) return null;
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  return null;
}

export function statusKind(value) {
  const status = normalizedName(value);
  if (status === 'entregado' || status === 'entregada') return 'delivered';
  if (status === 'cancelado' || status === 'cancelada') return 'cancelled';
  return 'pending';
}

export function calculateOrderProfit(order = {}, products = []) {
  const availableProducts = productsList(products);
  const items = parseProductLines(order.producto);
  let providerCost = 0;
  let quantity = 0;
  let estimated = items.length === 0;
  const issues = items.length ? [] : ['Pedido sin productos identificables'];

  for (const item of items) {
    quantity += item.qty;
    const product = findProduct(availableProducts, item.name, order.proveedor);
    const cost = product?.costo_proveedor;
    if (cost === null || cost === undefined || cost === '' || number(cost) <= 0) {
      estimated = true;
      issues.push(`${item.name}: ${product ? 'falta costo del proveedor' : 'sin coincidencia única en catálogo'}`);
      continue;
    }
    providerCost += number(cost) * item.qty;
  }

  const revenue = number(order.total);
  const deliveryCost = number(order.costo_mensajeria);
  const commission = number(order.comision_total);
  const hasValue = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  if (!hasValue(order.comision_total)) issues.push('Falta la bolsa comercial registrada');
  if (!hasValue(order.costo_mensajeria)) issues.push('Falta el costo de mensajería registrado');
  if (!hasValue(order.total) || revenue < deliveryCost || commission < 0 || deliveryCost < 0) issues.push('Importes de venta o costos inválidos');
  const split = number(order.comision_parent) + number(order.comision_subgestor);
  if (number(order.comision_parent) < 0 || number(order.comision_subgestor) < 0) issues.push('Reparto comercial negativo');
  if (split > 0 && Math.abs(split - commission) > 0.01) issues.push('El reparto gestor/subgestor no coincide con la bolsa comercial');
  const averageUnitPrice = (revenue - deliveryCost) / (quantity || 1);
  const ledgerPresent = number(order.tarifa_lineas) > 0;
  const systemFee = ledgerPresent
    ? (number(order.tarifa_incidencias) === 0 && hasValue(order.tarifa_sistema) ? number(order.tarifa_sistema) : null)
    : (items.length === 1 ? devFee(round(averageUnitPrice)) * quantity : null);
  if (systemFee === null) issues.push('Tarifa del sistema pendiente de conciliación');
  const profit = issues.length ? null : revenue - providerCost - deliveryCost - commission - systemFee;

  return {
    revenue: round(revenue),
    providerCost: estimated ? null : round(providerCost),
    deliveryCost: round(deliveryCost),
    commission: round(commission),
    systemFee: systemFee === null ? null : round(systemFee),
    feeSource: ledgerPresent ? 'ledger' : 'reconstructed',
    profit: profit === null ? null : round(profit),
    quantity: quantity || 1,
    estimated: issues.length > 0,
    issues,
    costSource: 'current_catalog'
  };
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function dateParts(value, timeZone = 'UTC') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(parseDate(value) || new Date());
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
}

function zonedMidnight(year, month, day, timeZone) {
  const target = Date.UTC(year, month - 1, day);
  let guess = target;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess));
    const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
    guess += target - Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
  }
  return new Date(guess);
}

function utcStart(value, timeZone = 'UTC') {
  const parts = dateParts(value, timeZone);
  return timeZone === 'UTC' ? new Date(Date.UTC(parts.year, parts.month - 1, parts.day)) : zonedMidnight(parts.year, parts.month, parts.day, timeZone);
}

export function periodBounds(period, now = new Date(), timeZone = 'UTC') {
  const {year, month, day} = dateParts(now, timeZone);
  const start = new Date(Date.UTC(year, month - 1, day));
  if (period === 'week') start.setUTCDate(day - (start.getUTCDay() + 6) % 7);
  else if (period === 'month') start.setUTCDate(1);
  else if (period !== 'today') throw new Error(`Período no soportado: ${period}`);
  const end = new Date(start);
  if (period === 'month') end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCDate(end.getUTCDate() + (period === 'week' ? 7 : 1));
  return [start, end].map(date => zonedMidnight(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), timeZone));
}

function boundaryForDate(dateString, timeZone = 'UTC') {
  const [year, month, day] = String(dateString).split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;
  return timeZone === 'UTC' ? new Date(Date.UTC(year, month - 1, day)) : zonedMidnight(year, month, day, timeZone);
}

function nextDateString(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function dateKey(value, timeZone = 'UTC') {
  const date = parseDate(value);
  if (!date) return '';
  const parts = dateParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function inDateRange(order, from, to, timeZone = 'UTC') {
  const timestamp = parseDate(order?.fecha)?.getTime();
  if (!Number.isFinite(timestamp)) return false;
  if (from && timestamp < boundaryForDate(from, timeZone).getTime()) return false;
  if (to && timestamp >= boundaryForDate(nextDateString(to), timeZone).getTime()) return false;
  return true;
}

export function aggregatePeriod({ orders = [], products = [], period = 'month', from, to, now, timeZone = 'UTC' } = {}) {
  let start;
  let end;
  if (from || to) {
    start = from ? boundaryForDate(from, timeZone) : new Date('1970-01-01T00:00:00Z');
    end = to ? boundaryForDate(nextDateString(to), timeZone) : new Date('2999-12-31T23:59:59.999Z');
  } else {
    [start, end] = periodBounds(period, now || new Date(), timeZone);
  }
  const startMs = start.getTime();
  const endMs = end.getTime();
  const delivered = orders.filter(order => {
    if (statusKind(order?.estado) !== 'delivered') return false;
    const timestamp = parseDate(order?.fecha)?.getTime();
    return Number.isFinite(timestamp) && timestamp >= startMs && timestamp < endMs;
  });
  const totals = delivered.reduce((sum, order) => {
    const result = calculateOrderProfit(order, products);
    sum.revenue += result.revenue;
    if (result.profit !== null) {
      sum.calculableRevenue += result.revenue;
      sum.providerCost += result.providerCost;
      sum.deliveryCost += result.deliveryCost;
      sum.commission += result.commission;
      sum.systemFee += result.systemFee;
      sum.profit += result.profit;
    } else sum.excludedRevenue += result.revenue;
    sum.estimatedOrders += result.estimated ? 1 : 0;
    const key = dateKey(order.fecha, timeZone);
    if (key) {
      sum.dailyMap[key] ||= { date: key, revenue: 0, profit: 0, orders: 0, calculableOrders: 0, excludedOrders: 0 };
      sum.dailyMap[key].revenue += result.revenue;
      if (result.profit !== null) { sum.dailyMap[key].profit += result.profit; sum.dailyMap[key].calculableOrders += 1; }
      else sum.dailyMap[key].excludedOrders += 1;
      sum.dailyMap[key].orders += 1;
    }
    return sum;
  }, { revenue: 0, calculableRevenue: 0, excludedRevenue: 0, providerCost: 0, deliveryCost: 0, commission: 0, systemFee: 0, profit: 0, estimatedOrders: 0, dailyMap: {} });

  return {
    period,
    revenue: round(totals.revenue),
    providerCost: round(totals.providerCost),
    deliveryCost: round(totals.deliveryCost),
    commission: round(totals.commission),
    systemFee: round(totals.systemFee),
    calculableRevenue: round(totals.calculableRevenue),
    excludedRevenue: round(totals.excludedRevenue),
    calculableOrders: delivered.length - totals.estimatedOrders,
    profit: delivered.length && delivered.length === totals.estimatedOrders ? null : round(totals.profit),
    margin: totals.calculableRevenue ? round((totals.profit / totals.calculableRevenue) * 100, 1) : null,
    orders: delivered.length,
    estimatedOrders: totals.estimatedOrders,
    estimated: totals.estimatedOrders > 0,
    dailySeries: Object.values(totals.dailyMap).sort((a, b) => a.date.localeCompare(b.date)).map(row => ({
      ...row,
      revenue: round(row.revenue),
      profit: row.calculableOrders ? round(row.profit) : null
    }))
  };
}

export function aggregateByProduct({ orders = [], products = [], from, to, timeZone = 'UTC' } = {}) {
  const rows = new Map();
  for (const order of orders) {
    if (statusKind(order?.estado) !== 'delivered' || !inDateRange(order, from, to, timeZone)) continue;
    const items = parseProductLines(order.producto);
    if (!items.length) continue;
    const result = calculateOrderProfit(order, products);
    const mixed = items.length > 1;
    const denominator = items.reduce((sum, item) => sum + item.qty, 0) || 1;
    for (const item of items) {
      const key = normalizedName(item.name);
      const share = item.qty / denominator;
      const existing = rows.get(key) || { name: item.name, quantity: 0, revenue: 0, providerCost: 0, commission: 0, systemFee: 0, profit: 0, orders: 0, estimated: false };
      existing.quantity += item.qty;
      existing.revenue += result.revenue * share;
      existing.providerCost += result.providerCost * share;
      existing.commission += result.commission * share;
      existing.systemFee += result.systemFee * share;
      existing.profit += result.profit * share;
      existing.orders += 1;
      existing.estimated ||= result.estimated || mixed;
      existing.issues = [...new Set([...(existing.issues || []), ...result.issues, ...(mixed ? ['Pedido mixto sin precio histórico por línea: reparto de ventas orientativo; ganancia no atribuible'] : [])])];
      rows.set(key, existing);
    }
  }
  return [...rows.values()]
    .map(row => ({ ...row, revenue: round(row.revenue), providerCost: row.estimated ? null : round(row.providerCost), commission: round(row.commission), systemFee: round(row.systemFee), profit: row.estimated ? null : round(row.profit), margin: row.estimated || !row.revenue ? null : round(row.profit / row.revenue * 100, 1) }))
    .sort((a, b) => b.revenue - a.revenue);
}
