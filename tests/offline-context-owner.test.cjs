const test=require('node:test'),assert=require('node:assert/strict'),api=require('../js/pending-checkout.js');
test('draft owner survives expired credential only with bounded device context; logout and account changes hide it',()=>{
 const rows=new Map(),storage={getItem:k=>rows.get(k)||null};
 rows.set('pth_offline_context_v1',JSON.stringify({profile:{id:'a'},savedAt:Date.now()-1000,expiresAt:Date.now()+1000}));
 assert.equal(api.localOwner(storage),'a');
 rows.set('pth_session',JSON.stringify({data:{id:'b'}}));rows.set('pth_secure_token','b'.repeat(64));assert.equal(api.localOwner(storage),'b');
 rows.delete('pth_secure_token');rows.delete('pth_session');rows.delete('pth_offline_context_v1');assert.equal(api.localOwner(storage),null);
});
