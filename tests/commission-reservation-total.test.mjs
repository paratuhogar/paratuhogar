import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);

async function activeReservationTotal(requests) {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const source = html.match(/function getActiveCommissionReservationTotal\([\s\S]*?\n\}/)?.[0];
  assert.ok(source, 'No se encontró el cálculo de saldo reservado de comisiones');
  const context = { requests };
  vm.runInNewContext(`${source}; result = getActiveCommissionReservationTotal(requests);`, context);
  return context.result;
}

test('solo reserva solicitudes pendientes o procesándose', async () => {
  const total = await activeReservationTotal([
    { estado: 'pendiente', importe_usd: 20 },
    { estado: 'procesando', importe_usd: 13 },
    { estado: 'pagado', importe_usd: 20 },
    { estado: 'archivado', importe_usd: 5 },
    { estado: 'rechazado', importe_usd: 8 }
  ]);

  assert.equal(total, 33);
});
