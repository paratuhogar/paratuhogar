import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures/new-checkout.mjs';

test('old cached pages cannot dictate a number; accepted historical orders stay unchanged',async()=>{
 const f=await fixture();
 f.body.inputs[0].orden_dia='A-999';f.body.inputs[1].orden_dia='B-888';
 const q=await f.quote();assert.equal(q.error,null);assert.equal(f.writes,0);
 const r=await f.submit(q);assert.equal(r.error,null);
 assert.deepEqual(r.data.confirmed,[{proveedor:'A',reference:'A-1'},{proveedor:'B',reference:'B-1'}]);
 assert.deepEqual(f.rows.pedidos[0],f.historical);
 const lost=await f.request({action:'checkout',operation:'receipt',attempt:q.data.attempt},null);
 assert.deepEqual(lost.data.confirmed,r.data.confirmed);assert.equal(f.writes,1);
});
