import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const source=fs.readFileSync(new URL('service-worker.js',root),'utf8');
function fixture(){const events={},entries=new Map(),opened=[],deleted=[];let offline=false;
 const cache={addAll:async urls=>{for(const u of urls){assert.ok(fs.existsSync(new URL(new URL(u,'https://paratuhogar.org').pathname.slice(1),root)),u+' exists');entries.set(u,new Response(u));}},put:async(k,v)=>entries.set(typeof k==='string'?k:new URL(k.url).pathname+new URL(k.url).search,v),match:async k=>entries.get(typeof k==='string'?k:new URL(k.url).pathname+new URL(k.url).search)?.clone()};
 const ctx={importScripts:()=>{},URL,Response,console,self:{location:{origin:'https://paratuhogar.org'},addEventListener:(n,f)=>events[n]=f,clients:{claim:async()=>{}},skipWaiting(){}},caches:{open:async name=>{opened.push(name);return cache;},keys:async()=>['pth-public-static-2026-10-02-lowdata1','pth-public-static-2026-10-02-lowdata2','pth-public-static-2026-10-02-fasttools1','pth-public-static-2026-10-02-fasttools2','pth-public-static-2026-10-02-quickstory1','pth-public-static-2026-10-02-review1','pth-public-images-v1','unrelated-cache'],delete:async name=>{deleted.push(name);return true;},match:cache.match},fetch:async()=>{if(offline)throw Error('offline');return new Response('current public shell');}};
 vm.runInNewContext(source,ctx);return {events,entries,opened,deleted,offline(){offline=true;}};
}
test('normal public template and local SDK reopen without private response or product image precaching',async()=>{const f=fixture();let install;f.events.install({waitUntil:p=>install=p});await install;
 for(const resource of ['/offline-catalog.html','/offline.html','/js/low-connectivity.js?v=20261002-lowdata1','/js/offline-catalog.js?v=20261002-lowdata2','/css/offline-catalog.css?v=20261002-lowdata1','/js/product-images.js?v=20261002-fasttools2'])assert.ok(f.entries.has(resource));
 for(const resource of ['/index.html','/js/vendor/supabase-2.57.4.js','/js/storefront.min.js?v=20261003-seo-affiliate1','/js/offline-storefront-adapter.js?v=20261003-pending2','/js/checkout-form-shared.js?v=20261003-pending2','/js/offline-checkout-copy.js?v=20261003-pending2'])assert.ok(f.entries.has(resource));
 assert.equal([...f.entries.keys()].some(u=>/img_productos|functions\/v1|feedback\.html|notifications\.html|pedidos|secure_sessions/.test(u)),false);
 assert.ok(f.entries.has('/offline-order.html'));
 assert.ok(f.entries.has('/js/secure-data.js?v=20261003-ranking1'),'static gateway adapter only; API responses are never cached');
});
test('cached root remains available offline; private routes get only offline fallback',async()=>{const f=fixture();let p;f.events.install({waitUntil:x=>p=x});await p;f.offline();
 for(const [url,expected] of [['/','/index.html'],['/?ref=cuenta','/index.html'],['/index.html','/index.html'],['/producto/modelo/','/index.html'],['/offline-catalog.html','/offline-catalog.html'],['/offline-catalog.html?catalog_q=panel','/offline-catalog.html'],['/offline-order.html','/offline-order.html'],['/offline-order.html?x=1','/offline-order.html'],['/feedback.html','/offline.html'],['/notifications.html','/offline.html'],['/catalog-maker.html','/offline.html']]){let response;f.events.fetch({request:{method:'GET',mode:'navigate',url:'https://paratuhogar.org'+url},respondWith:x=>response=x});assert.equal(await (await response).text(),expected);}
});
test('service worker never intercepts protected API or POST responses',()=>{const f=fixture();for(const req of [{method:'POST',url:'https://paratuhogar.org/'},{method:'GET',url:'https://ljqwaovevfatkiigirhf.supabase.co/functions/v1/secure-data'}])f.events.fetch({request:req,respondWith:()=>assert.fail('must not cache protected response')});});
test('catalogue upgrade installs the new reader and removes only previous static caches',async()=>{
 const f=fixture();let p;f.events.install({waitUntil:value=>p=value});await p;
 assert.deepEqual(f.opened,['pth-public-static-2026-10-03-seo-affiliate1']);
 assert.ok(f.entries.has('/js/offline-catalog.js?v=20261002-lowdata2'));
 assert.equal(f.entries.has('/js/offline-catalog.js?v=20261002-lowdata1'),false);
 f.events.activate({waitUntil:value=>p=value});await p;
 assert.deepEqual(f.deleted,['pth-public-static-2026-10-02-lowdata1','pth-public-static-2026-10-02-lowdata2','pth-public-static-2026-10-02-fasttools1','pth-public-static-2026-10-02-fasttools2','pth-public-static-2026-10-02-quickstory1','pth-public-static-2026-10-02-review1']);
});
test('reader, storefront and notification registrars agree on the release worker version',()=>{
 const read=file=>fs.readFileSync(new URL(file,root),'utf8');
 assert.match(read('offline-catalog.html'),/offline-catalog\.js\?v=20261002-lowdata2/);
 assert.match(read('index.html'),/pwa\.js\?v=20261003-pending2/);
 assert.match(read('js/pwa.js'),/SW_VERSION = '20261003-pending2'/);
 assert.match(read('js/admin-push-registration.mjs'),/service-worker\.js\?v=20261003-pending2/);
 assert.match(read('js/admin-push-page.mjs'),/admin-push-registration\.mjs\?v=20261003-pending2/);
 assert.match(read('notifications.html'),/admin-push-page\.mjs\?v=20261003-pending2/);
 assert.match(source,/\/js\/pwa\.js\?v=20261003-pending2/);
});
