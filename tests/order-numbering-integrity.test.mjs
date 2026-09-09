import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('los consecutivos se reservan de forma atómica y se reutilizan en el pedido', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const sql = await readFile(
    new URL('supabase/migrations/20260909_consecutivos_pedidos_atomicos.sql', root),
    'utf8'
  );

  assert.match(sql, /create table if not exists pth_private\.pedido_consecutivos/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /create or replace function public\.reservar_consecutivo_pedido/i);
  assert.match(sql, /update pth_private\.pedido_consecutivos/i);
  assert.match(sql, /regexp_match/i);
  assert.match(sql, /grant execute on function public\.reservar_consecutivo_pedido/i);

  assert.match(html, /rpc\(['"]reservar_consecutivo_pedido['"]/);
  const numberingBlock = html.slice(html.indexOf('let codPedido = "";'), html.indexOf('protectionOrderIds.push(codPedido)'));
  assert.doesNotMatch(numberingBlock, /\.limit\(20\)\s*;/);
  assert.doesNotMatch(numberingBlock, /TEMP-\$\{random\}/);
  assert.match(numberingBlock, /No se pudo reservar el consecutivo/i);
});
