const SAFE_DEFAULTS = {
  comision_total: 0,
  costo_mensajeria: 0,
  gestor: 'Venta directa',
  proveedor: 'General',
  municipio: 'Sin municipio',
  tipo_entrega: 'Domicilio',
  orden_dia: ''
};

function number(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeOwnerOrder(row = {}) {
  return {
    id: String(row.id ?? ''),
    fecha: String(row.fecha ?? ''),
    estado: String(row.estado ?? 'Pendiente'),
    producto: String(row.producto ?? ''),
    total: number(row.total),
    comision_total: row.comision_total == null ? null : number(row.comision_total),
    costo_mensajeria: row.costo_mensajeria == null ? null : number(row.costo_mensajeria),
    comision_parent: row.comision_parent == null ? null : number(row.comision_parent),
    comision_subgestor: row.comision_subgestor == null ? null : number(row.comision_subgestor),
    tarifa_sistema: row.tarifa_sistema == null ? null : number(row.tarifa_sistema),
    tarifa_lineas: number(row.tarifa_lineas),
    tarifa_incidencias: number(row.tarifa_incidencias),
    gestor: String(row.gestor ?? SAFE_DEFAULTS.gestor),
    proveedor: String(row.proveedor ?? SAFE_DEFAULTS.proveedor),
    municipio: String(row.municipio ?? SAFE_DEFAULTS.municipio),
    tipo_entrega: String(row.tipo_entrega ?? SAFE_DEFAULTS.tipo_entrega),
    orden_dia: String(row.orden_dia ?? SAFE_DEFAULTS.orden_dia)
  };
}

function normalized(value) {
  return String(value ?? '').trim().toLocaleLowerCase();
}

function boundaryForDate(dateString, timeZone = 'UTC') {
  const [year, month, day] = String(dateString).split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;
  if (timeZone === 'UTC') return new Date(Date.UTC(year, month - 1, day));
  const target = Date.UTC(year, month - 1, day);
  let guess = target;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess));
    const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
    guess += target - Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
  }
  return new Date(guess);
}

function nextDate(dateString) {
  const value = new Date(`${dateString}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export function filterOrders(orders = [], filters = {}) {
  const timeZone = filters.timeZone || 'UTC';
  const fromMs = filters.from ? boundaryForDate(filters.from, timeZone).getTime() : -Infinity;
  const toMs = filters.to ? boundaryForDate(nextDate(filters.to), timeZone).getTime() : Infinity;
  const matches = (value, expected) => !expected || expected === 'all' || normalized(value) === normalized(expected);
  return orders.filter(order => {
    const timestamp = new Date(order.fecha).getTime();
    return timestamp >= fromMs && timestamp < toMs
      && matches(order.gestor, filters.gestor)
      && matches(order.proveedor, filters.proveedor)
      && matches(order.municipio, filters.municipio)
      && matches(order.estado, filters.estado);
  });
}

export function dedupeIncomingOrders(orders = [], seenIds = new Set()) {
  const seen = seenIds instanceof Set ? seenIds : new Set(seenIds);
  return orders.filter(order => {
    const id = String(order?.id ?? '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function distinctValues(rows = [], field) {
  return [...new Set(rows.map(row => String(row?.[field] ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export async function readAllRpc(client, name, credentials, sortKeys) {
  const rows = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    let query = client.rpc(name, credentials);
    for (const key of sortKeys) query = query.order(key, { ascending: true });
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message || 'No se pudieron cargar las estadísticas');
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

export async function loadOwnerSnapshot({ client, session }) {
  if (!client?.rpc) throw new Error('Cliente de datos no disponible');
  const credentials = {
    p_admin_id: session?.data?.id ?? session?.id ?? null,
    p_password: session?.data?.password ?? session?.password ?? ''
  };
  const calls = await Promise.all([
    readAllRpc(client, 'owner_statistics_orders_v2', credentials, ['fecha', 'id']),
    readAllRpc(client, 'owner_statistics_products', credentials, ['id']),
    readAllRpc(client, 'owner_statistics_traffic', credentials, ['dia']),
    readAllRpc(client, 'owner_statistics_views', credentials, ['dia', 'producto'])
  ]);
  return {
    orders: calls[0].map(normalizeOwnerOrder),
    products: calls[1],
    traffic: calls[2],
    views: calls[3],
    loadedAt: new Date().toISOString()
  };
}
