import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
async function payoutWindowIsOpen({ weekday, date }) {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const source = html.match(/function getHavanaWeekday\(\) \{[\s\S]*?\n\}/)?.[0]
    + '\n' + html.match(/function isPayoutRequestWindowOpen\(\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(source, 'No se encontró la regla de ventana de cobro');
  const context = { Date: class { constructor() {} }, Intl: { DateTimeFormat: function (_locale, options) { return { format: () => options.weekday ? weekday : date }; } } };
  vm.runInNewContext(`${source}; result = isPayoutRequestWindowOpen();`, context);
  return context.result;
}
test('acepta solicitudes todo el lunes hasta las 23:59 hora de La Habana', async () => {
  assert.equal(await payoutWindowIsOpen({ weekday: 'Mon', date: '2026-08-17' }), true);
});
test('rechaza solicitudes desde el inicio del martes', async () => {
  assert.equal(await payoutWindowIsOpen({ weekday: 'Tue', date: '2026-08-18' }), false);
});
