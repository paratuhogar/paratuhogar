import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No se encontró ${name}`);
  let depth = 0;
  let opened = false;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') { depth += 1; opened = true; }
    if (source[i] === '}') {
      depth -= 1;
      if (opened && depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`No se pudo extraer ${name}`);
}

test('un pedido ya incluido en una solicitud activa no vuelve a estar disponible', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const source = [
    extractFunction(html, 'isCommissionPaid'),
    extractFunction(html, 'getOrderCommission'),
    extractFunction(html, 'getActiveCommissionReservationTotal'),
    extractFunction(html, 'getCommissionCenterData')
  ].join('\n');
  const context = {
    Math,
    window: { currentUserData: {} },
    myOrdersData: [
      { id: 'reservado', estado: 'Entregado', comision_total: 74, pago_gestor: 'Pendiente' },
      { id: 'libre', estado: 'Entregado', comision_total: 8, pago_gestor: 'Pendiente' }
    ],
    commissionPayoutRequests: [{ estado: 'pendiente', importe_usd: 74 }],
    commissionReservedOrderIds: new Set(['reservado']),
    commissionPayoutDetailsLoaded: true
  };
  vm.runInNewContext(`${source}; result = getCommissionCenterData();`, context);

  assert.deepEqual([...context.result.pending.map(order => order.id)], ['libre']);
  assert.equal(context.result.pendingTotal, 8);
});
