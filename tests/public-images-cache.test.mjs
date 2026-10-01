import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
function setup({failStorage=false,badResponse=false}={}){
 const events={},entries=new Map();let fetches=0;
 const key=r=>typeof r==='string'?r:r.url;
 const cache={match:async r=>entries.get(key(r)),put:async(r,v)=>entries.set(key(r),v),keys:async()=>[...entries.keys()],delete:async r=>entries.delete(key(r))};
 vm.runInNewContext(source,{URL,self:{location:{origin:'https://paratuhogar.org'},addEventListener:(e,f)=>events[e]=f},caches:{open:async()=>{if(failStorage)throw Error('quota');return cache;},delete:async()=>true},fetch:async()=>{fetches++;return {ok:!badResponse,type:'basic',clone(){return this;}};}});
 function request(path,extra={}){let response;events.fetch({request:{url:'https://paratuhogar.org'+path,method:'GET',destination:'image',headers:new Headers(),...extra},respondWith:p=>response=p});return response;}
 return {request,entries,fetches:()=>fetches};
}
const image='/img_productos/optimized/0123456789abcdef-360.avif';
test('public immutable thumbnails are reused and capped at 100 entries',async()=>{
 const f=setup();await f.request(image);await f.request(image);assert.equal(f.fetches(),1);
 for(let i=0;i<110;i++)await f.request(`/img_productos/optimized/${i.toString(16).padStart(16,'0')}-720.webp`);
 assert.equal(f.entries.size,100);assert.equal(f.entries.has('https://paratuhogar.org'+image),false);
});
test('private, authenticated, mutable, nonimage and query requests are not intercepted',()=>{
 const f=setup();
 for(const [path,extra] of [[image+'?token=secret',{}],[image,{headers:new Headers({authorization:'Bearer test'})}],[image,{destination:'fetch'}],['/img_productos/original.jpg',{}],['/feedback.html',{}],['/functions/v1/secure-data',{}]])assert.equal(f.request(path,extra),undefined);
});
test('storage failure never discards network image and errors are not cached',async()=>{
 assert.equal((await setup({failStorage:true}).request(image)).ok,true);
 const f=setup({badResponse:true});await f.request(image);await f.request(image);assert.equal(f.entries.size,0);assert.equal(f.fetches(),2);
});
