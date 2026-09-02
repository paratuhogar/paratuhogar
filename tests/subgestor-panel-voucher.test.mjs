import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);

test('el tour usa el ID real de Nómina y limpia el velo si falta un objetivo', async () => {
  const html = await readFile(new URL('subgestores.html', root), 'utf8');

  assert.match(html, /target:\s*["']#tab-nominas["']/);
  assert.match(
    html,
    /if\s*\(!target\)\s*\{[\s\S]*?(?:finishTour|removeTourOverlay|tour-backdrop)/,
    'Un objetivo ausente no debe dejar un velo bloqueando la página'
  );
});

test('el vale de un pedido aprobado contiene el pedido, total y comercial sin reparto interno', async () => {
  const html = await readFile(new URL('subgestores.html', root), 'utf8');
  const source = html.match(/function buildSubgestorApprovalVoucher\([\s\S]*?\n\s*\}/)?.[0];
  assert.ok(source, 'No se encontró el generador de vales para pedidos aprobados');

  const context = {};
  vm.runInNewContext(
    `${source}; result = buildSubgestorApprovalVoucher({ orden_dia: 'CA-1370', cliente: 'Raiselys', telefono: '52502088', direccion: 'Calle 105/24', municipio: 'Cotorro', producto: '1x Switch LS1005G 5 puertos', total: 37, costo_mensajeria: 10, comision_total: 3, subgestor_nombre: 'Raiselys' }, 'Beatriz Barrero');`,
    context
  );

  assert.match(context.result, /NUEVO PEDIDO #CA-1370/);
  assert.match(context.result, /TOTAL A PAGAR: \$37 USD/);
  assert.match(context.result, /Comercial: Beatriz Barrero/);
  assert.match(context.result, /Subgestor: Raiselys/);
  assert.doesNotMatch(context.result, /Comisión subgestor:/);
  assert.doesNotMatch(context.result, /Comisión gestor principal:/);
});

test('la nómina de subgestores ofrece reenviar el vale por WhatsApp', async () => {
  const html = await readFile(new URL('subgestores.html', root), 'utf8');
  assert.match(html, /sendSubgestorVoucher\(/);
  assert.match(html, /ENVIAR VALE/);
});
