import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures/new-checkout.mjs';

test('new quote consumes no number and submit ignores the supplied reference',async()=>{
 const f=await fixture();
 for(const row of f.body.inputs)row.orden_dia='FORGED-999';
 const q=await f.quote();assert.equal(q.error,null);assert.equal(f.writes,0);
 const result=await f.submit(q);assert.equal(result.error,null);
 assert.deepEqual(result.data.confirmed,[{proveedor:'A',reference:'A-1'},{proveedor:'B',reference:'B-1'}]);
 const replay=await f.submit(q);assert.deepEqual(replay.data.confirmed,result.data.confirmed);assert.equal(f.writes,1);
 assert.ok(f.trace.some(r=>r.op==='rpc'&&r.name==='pth_insert_checkout'));
 assert.ok(!f.trace.some(r=>r.op==='insert'&&r.table==='pedidos'));
});
