import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);

async function formatSubgestorWhatsappSummary({ parentName, subgestorName, totalCommission }) {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const source = html.match(/function buildSubgestorWhatsappSummary\([\s\S]*?\n\}/)?.[0];
  assert.ok(source, 'No se encontró el formato privado para avisos de subgestor');

  const context = {};
  vm.runInNewContext(
    `${source}; result = buildSubgestorWhatsappSummary({ parent: { nombre: ${JSON.stringify(parentName)} }, agent: { nombre: ${JSON.stringify(subgestorName)} } }, ${JSON.stringify(totalCommission)});`,
    context
  );
  return context.result;
}

test('el aviso de WhatsApp de subgestor muestra responsable y total sin revelar el reparto', async () => {
  const message = await formatSubgestorWhatsappSummary({
    parentName: 'Beatriz Barrero',
    subgestorName: 'Raiselys',
    totalCommission: 3
  });

  assert.match(message, /Gestor responsable: Beatriz Barrero/);
  assert.match(message, /Subgestor: Raiselys/);
  assert.match(message, /Comisión total del pedido: \$3/);
  assert.doesNotMatch(message, /Comisión subgestor:/);
  assert.doesNotMatch(message, /Comisión gestor principal:/);
});
