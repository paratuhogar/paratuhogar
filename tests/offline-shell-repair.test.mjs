import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
function publicResponse(request,status=200){const path=new URL(request.url).pathname;const content=fs.readFileSync(new URL(path.slice(1),root));const mime=path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':'application/javascript';const response=new Response(content,{status,headers:{'content-type':mime}});Object.defineProperty(response,'type',{value:'basic'});return response;}
const source=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
function fixture(){
  const events={},entries=new Map(),requests=[],puts=[],deleted=[];
  let writeFailure=false,fetching=async request=>publicResponse(request);
  const key=value=>typeof value==='string'?value:new URL(value.url).pathname+new URL(value.url).search;
  const cache={addAll:async urls=>urls.forEach(url=>entries.set(url,publicResponse(new Request('https://fixture.test'+url)))),match:async value=>entries.get(key(value))?.clone(),put:async(value,response)=>{if(writeFailure)throw new DOMException('quota','QuotaExceededError');puts.push(key(value));entries.set(key(value),response);}};
  const context={URL,Request,Response,AbortController,setTimeout,clearTimeout,importScripts(){},self:{location:{origin:'https://fixture.test'},addEventListener:(name,fn)=>events[name]=fn},caches:{open:async()=>cache,delete:async name=>{deleted.push(name);},keys:async()=>[]},fetch:async request=>{requests.push(request);return fetching(request);}};
  vm.runInNewContext(source,context);
  const install=async()=>{let work;events.install({waitUntil:value=>work=value});await work;};
  const message=async(type='PTH_REPAIR_OFFLINE_SHELL',extra={})=>{let work,result;events.message({data:{type,...extra},ports:[{postMessage:value=>result=value}],waitUntil:value=>work=value});await work;return result;};
  return {entries,requests,puts,deleted,install,message,fetchWith(fn){fetching=fn;},failWrites(){writeFailure=true;}};
}
test('repair fetches only missing allowlisted public resources without credentials or redirects',async()=>{
  const f=fixture();await f.install();const before=await f.entries.get('/index.html').clone().text();f.entries.delete('/offline.html');
  const result=await f.message(undefined,{urls:['https://other.test/private','/functions/v1/secure-data'],cacheName:'private'});
  assert.equal(result.ready,true);assert.equal(result.restoredCount,1);assert.equal(f.requests.length,1);
  const request=f.requests[0];assert.equal(request.url,'https://fixture.test/offline.html');assert.equal(request.method,'GET');assert.equal(request.credentials,'omit');assert.equal(request.redirect,'error');assert.equal(request.mode,'same-origin');assert.equal(request.headers.has('authorization'),false);
  assert.deepEqual(f.puts,['/offline.html']);assert.deepEqual(f.deleted,[]);assert.equal(await f.entries.get('/index.html').clone().text(),before);
  await f.message();assert.equal(f.requests.length,1,'already present resources must not be fetched on another retry');
});
test('partial failure preserves every existing resource and a later retry fills only the remaining gap',async()=>{
  const f=fixture();await f.install();f.entries.delete('/offline.html');f.entries.delete('/offline-order.html');
  f.fetchWith(async request=>publicResponse(request,request.url.endsWith('/offline.html')?503:200));
  const failed=await f.message();assert.equal(failed.ready,false);assert.equal(failed.missingCount,1);assert.equal(failed.restoredCount,1);assert.ok(f.entries.has('/index.html'));assert.deepEqual(f.deleted,[]);
  f.fetchWith(async request=>publicResponse(request));
  const retried=await f.message();assert.equal(retried.ready,true);assert.equal(f.requests.length,3);assert.equal(f.requests[2].url,'https://fixture.test/offline.html');
});
test('simultaneous repairs share one fetch and return the same honest readiness to both callers',async()=>{
  const f=fixture();await f.install();f.entries.delete('/offline.html');let finish;
  f.fetchWith(request=>new Promise(resolve=>finish=()=>resolve(publicResponse(request))));
  const a=f.message(),b=f.message();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.requests.length,1);finish();
  const [first,second]=await Promise.all([a,b]);assert.equal(first.ready,true);assert.equal(second.ready,true);assert.equal(f.puts.length,1);
});
test('offline and redirected responses do not enter the public cache or declare readiness',async()=>{
  for(const mode of ['network','opaque','redirect']){
    const f=fixture();await f.install();f.entries.delete('/offline.html');f.fetchWith(async()=>{if(mode==='network')throw Error('offline');const r=new Response('not public');Object.defineProperty(r,'type',{value:mode==='opaque'?'opaque':'opaqueredirect'});return r;});
    const result=await f.message();assert.equal(result.ready,false);assert.equal(result.missingCount,1);assert.equal(f.puts.length,0);assert.ok(f.entries.has('/index.html'));assert.deepEqual(f.deleted,[]);
  }
});
test('storage write failure is reported as incomplete and never removes the former shell',async()=>{
  const f=fixture();await f.install();f.entries.delete('/offline.html');f.failWrites();
  const result=await f.message();assert.equal(result.ready,false);assert.ok(f.entries.has('/index.html'));assert.deepEqual(f.deleted,[]);
});
test('the current checked-in main template can be recovered with all its offline dependencies',async()=>{
  const f=fixture();await f.install();f.entries.delete('/index.html');const result=await f.message();assert.equal(result.ready,true);assert.deepEqual(f.puts,['/index.html']);
});
test('a template from a newer app release remains missing and reports an app update instead of false readiness',async()=>{
  const f=fixture();await f.install();f.entries.delete('/index.html');
  f.fetchWith(async()=>{const r=new Response('<html><body><script src="/js/storefront.min.js?v=next-release"></script></body></html>',{headers:{'content-type':'text/html'}});Object.defineProperty(r,'type',{value:'basic'});return r;});
  const result=await f.message();assert.equal(result.ready,false);assert.equal(result.reason,'update');assert.equal(result.missingCount,1);assert.equal(f.puts.length,0);assert.ok(f.entries.has('/offline.html'));
});
test('an HTML fallback with HTTP 200 cannot satisfy a missing JavaScript or stylesheet',async()=>{
  for(const url of ['/js/pending-checkout-storefront.js?v=20261008-save1','/css/offline-order.css?v=20261003-pending2']){
    const f=fixture();await f.install();f.entries.delete(url);f.fetchWith(async()=>{const r=new Response('<html>fallback</html>',{headers:{'content-type':'text/html'}});Object.defineProperty(r,'type',{value:'basic'});return r;});
    const result=await f.message();assert.equal(result.ready,false);assert.equal(result.missingCount,1);assert.equal(f.puts.length,0);
  }
});
test('unquoted future scripts, maintenance pages and external essential scripts cannot declare readiness',async()=>{
  const html=fs.readFileSync(new URL('index.html',root),'utf8');
  for(const content of [html.replace('src="js/pending-checkout-storefront.js?v=20261008-save1"','src=/js/pending-checkout-storefront.js?v=next-release'),'<html><body>Maintenance</body></html>',html.replace('src="js/pending-checkout-storefront.js?v=20261008-save1"','src="https://external.test/next-release.js"')]){
    const f=fixture();await f.install();f.entries.delete('/index.html');f.fetchWith(async()=>{const r=new Response(content,{headers:{'content-type':'text/html'}});Object.defineProperty(r,'type',{value:'basic'});return r;});
    const result=await f.message();assert.equal(result.ready,false);assert.equal(result.reason,'update');assert.equal(f.puts.length,0);
  }
});
test('incompatible already-present HTML is reported without replacing it or clearing any cache',async()=>{
  const f=fixture();await f.install();f.entries.set('/index.html',new Response('<html>Maintenance</html>'));const result=await f.message();assert.equal(result.ready,false);assert.equal(result.reason,'update');assert.equal(result.missingCount,0);assert.equal(f.requests.length,0);assert.deepEqual(f.deleted,[]);assert.equal(await f.entries.get('/index.html').clone().text(),'<html>Maintenance</html>');
});
