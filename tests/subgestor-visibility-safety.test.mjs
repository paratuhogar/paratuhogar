import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('bulk assignment sends only product IDs; existing visibility is never rewritten by the browser',()=>{
 const source=readFileSync(new URL('../js/storefront.js',import.meta.url),'utf8');
 const start=source.indexOf('async function autoAssignHalfCommissions(event)');
 assert.ok(start>0);
 const fn=source.slice(start,source.indexOf('// =====================================================',start));
 assert.match(fn,/assignHalfCommissions\(batch, token\)/);
 assert.doesNotMatch(fn,/\.insert\(|\.update\(|\.upsert\(|visible_subgestor\s*:/);
 assert.match(fn,/No se cambiarán precios, visibilidad ni comisiones existentes, incluso si están en cero/);
});
