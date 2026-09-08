import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('la asignación masiva conserva un ocultamiento explícito y vuelve visible un registro sin decisión previa', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const source = html.match(/async function autoAssignHalfCommissions\(\)[\s\S]*?\n    \}\n\n\n\/\/ =====================================================/);

  assert.ok(source, 'No se encontró la asignación masiva de comisiones');
  assert.match(
    source[0],
    /visible_subgestor:\s*saved\.visible_subgestor\s*!==\s*false/,
    'Una fila existente debe preservar el ocultamiento explícito y normalizar el estado indefinido a visible'
  );
  assert.match(
    source[0],
    /toInsert\.push\(\{[\s\S]*?visible_subgestor:\s*true/,
    'Un producto nuevo asignado masivamente debe quedar visible para los subgestores'
  );
});
