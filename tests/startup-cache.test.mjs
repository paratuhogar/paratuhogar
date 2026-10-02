import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const source=fs.readFileSync(new URL('service-worker.js',root),'utf8');
function fixture(){const events={},entries=new Map();let offline=false;
 const cache={addAll:async urls=>{for(const u of urls){assert.ok(fs.existsSync(new URL(new URL(u,'https://paratuhogar.org').pathname.slice(1),root)),u+' exists');entries.set(u,new Response(u));}},put:async(k,v)=>entries.set(typeof k==='string'?k:new URL(k.url).pathname+new URL(k.url).search,v),match:async k=>entries.get(typeof k==='string'?k:new URL(k.url).pathname+new URL(k.url).search)};
 const ctx={importScripts:()=>{},URL,Response,console,self:{location:{origin:'https://paratuhogar.org'},addEventListener:(n,f)=>events[n]=f,clients:{claim:async()=>{}},skipWaiting(){}},caches:{open:async()=>cache,keys:async()=>[],delete:async()=>true,match:cache.match},fetch:async()=>{if(offline)throw Error('offline');return new Response('current public shell');}};
 vm.runInNewContext(source,ctx);return {events,entries,offline(){offline=true;}};
}
test('minimal public shell works without SDK, account tools or image precaching',async()=>{const f=fixture();let install;f.events.install({waitUntil:p=>install=p});await install;
 for(const resource of ['/offline-catalog.html','/offline.html','/js/low-connectivity.js?v=20261002-lowdata1','/js/offline-catalog.js?v=20261002-lowdata1','/css/offline-catalog.css?v=20261002-lowdata1','/js/product-images.js?v=20261002-lowdata1'])assert.ok(f.entries.has(resource));
 assert.equal([...f.entries.keys()].some(u=>/secure-data|storefront|admin-panel|img_productos|supabase/.test(u)),false);
});
test('cached root remains available offline; private routes get only offline fallback',async()=>{const f=fixture();let p;f.events.install({waitUntil:x=>p=x});await p;f.offline();
 for(const [url,expected] of [['/','/offline-catalog.html'],['/feedback.html','/offline.html']]){let response;f.events.fetch({request:{method:'GET',mode:'navigate',url:'https://paratuhogar.org'+url},respondWith:x=>response=x});assert.equal(await (await response).text(),expected);}
});
test('service worker never intercepts protected API or POST responses',()=>{const f=fixture();for(const req of [{method:'POST',url:'https://paratuhogar.org/'},{method:'GET',url:'https://ljqwaovevfatkiigirhf.supabase.co/functions/v1/secure-data'}])f.events.fetch({request:req,respondWith:()=>assert.fail('must not cache protected response')});});
