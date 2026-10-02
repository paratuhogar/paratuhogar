import test from 'node:test';
import assert from 'node:assert/strict';
import {adminPushRegistration} from '../js/admin-push-registration.mjs';
class Worker extends EventTarget{
 constructor(version,state){super();this.scriptURL='https://paratuhogar.org/service-worker.js?v='+version;this.state=state;this.messages=[];}
 postMessage(data){this.messages.push(data);}
 change(state){this.state=state;this.dispatchEvent(new Event('statechange'));}
}
test('opt-in waits for the push-capable worker instead of subscribing through an old active worker',async()=>{
 const registration=new EventTarget(),old=new Worker('old','activated'),next=new Worker('20261002-lowdata2','installing');
 registration.active=old;registration.installing=next;let resolved=false;
 const pending=adminPushRegistration({register:async()=>registration}).then(r=>{resolved=true;return r;});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(resolved,false);
 registration.waiting=next;registration.installing=null;next.change('installed');assert.deepEqual(next.messages,[{type:'SKIP_WAITING'}]);assert.equal(resolved,false);
 registration.active=next;registration.waiting=null;next.change('activated');assert.equal(await pending,registration);
});
test('already activated current worker returns immediately; failed installation rejects',async()=>{
 const current=new EventTarget();current.active=new Worker('20261002-lowdata2','activated');assert.equal(await adminPushRegistration({register:async()=>current}),current);
 const broken=new EventTarget();broken.installing=new Worker('20261002-lowdata2','installing');
 const pending=adminPushRegistration({register:async()=>broken});await new Promise(resolve=>setImmediate(resolve));broken.installing.change('redundant');await assert.rejects(pending,/installation failed/);
});
test('browser register and worker activation have bounded waits; late resolution does not activate after timeout',async()=>{
 let settle;
 const pending=adminPushRegistration({register:()=>new Promise(resolve=>settle=resolve)},{timeoutMs:20});
 await assert.rejects(pending,/unavailable/);
 const late=new EventTarget();late.waiting=new Worker('20261002-lowdata2','installed');settle(late);
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(late.waiting.messages,[]);
 const waiting=new EventTarget();waiting.installing=new Worker('20261002-lowdata2','installing');
 await assert.rejects(adminPushRegistration({register:async()=>waiting},{timeoutMs:20}),/unavailable/);
});
