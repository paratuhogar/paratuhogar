import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('el comprobante PDF usa “Factura” en el título, nombre y compartir', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const start = html.indexOf('async function generarComprobanteVenta(');
  const end = html.indexOf('\n// Función para verificar si un teléfono', start);
  assert.notEqual(start, -1, 'debe existir el generador del comprobante');
  assert.notEqual(end, -1, 'debe encontrarse el final del generador');

  const generator = html.slice(start, end);
  assert.match(generator, /doc\.text\("FACTURA"/);
  assert.match(generator, /Esta factura reserva el producto/);
  assert.match(generator, /`Factura_.*\.pdf`/);
  assert.match(generator, /title:\s*'Su Factura - paratuhogar'/);
  assert.doesNotMatch(generator, /prefactura/i);
});
