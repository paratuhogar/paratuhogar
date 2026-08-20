import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function commissionRequestModalMarkup() {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const match = html.match(/<div id="commission-request-modal" class="([^"]+)">\s*<div class="([^"]+)"/);
  assert.ok(match, 'No se encontró el modal de solicitud de cobro');
  return { overlayClasses: match[1], dialogClasses: match[2] };
}

test('el modal de cobro puede desplazarse y no corta el botón en pantallas bajas', async () => {
  const { overlayClasses, dialogClasses } = await commissionRequestModalMarkup();

  assert.match(overlayClasses, /overflow-y-auto/);
  assert.match(overlayClasses, /items-start/);
  assert.match(dialogClasses, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(dialogClasses, /overflow-y-auto/);
});
