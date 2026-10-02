import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import buildJS from '../scripts/build-js.cjs';
const source=fs.readFileSync(new URL('../js/storefront.js',import.meta.url),'utf8');
const start=source.indexOf('const salesToolOpening = new Map();');
const wrappers=source.slice(start,source.indexOf('async function verificarDuenioAlEscribir',start));
function fixture(){
 let token='a',loads=0,actions=0,fail=false,release;
 const loaded=new Promise(resolve=>{release=resolve;}),alerts=[];
 const button={tagName:'BUTTON',innerHTML:'Mensaje',textContent:'',disabled:false};
 const context={Map,Promise,Error,document:{getElementById:()=>button},alert:m=>alerts.push(m),
  PTHSecureData:{token:()=>token},PTHAssets:{load:async()=>{loads++;await loaded;if(fail)throw Error('offline');context.PTHSalesTools={openSalesComposer:async mode=>{actions++;return mode;}};}}
 };context.window=context;vm.runInNewContext(wrappers,context);
 return {context,button,alerts,release,fail:v=>{fail=v;},token:v=>{token=v;},counts:()=>({loads,actions})};
}
test('compiled browser entrypoints match the pinned reproducible build',async()=>{await buildJS.build(true);});
test('double tap shares one tool load and action, with restored button',async()=>{
 const f=fixture(),first=f.context.copyCategoryOffers(),second=f.context.copyCategoryOffers();
 assert.equal(first,second);assert.equal(f.button.disabled,true);await Promise.resolve();assert.equal(f.counts().loads,1);
 f.release();assert.equal(await first,'broadcast');assert.deepEqual(f.counts(),{loads:1,actions:1});assert.equal(f.button.disabled,false);assert.equal(f.button.innerHTML,'Mensaje');
});
test('offline and missing loader failures permit manual retry without executing a tool',async()=>{
 const f=fixture();f.fail(true);const failed=f.context.copyCategoryOffers();f.release();await failed;
 assert.deepEqual(f.counts(),{loads:1,actions:0});assert.match(f.alerts[0],/offline/);assert.equal(f.button.disabled,false);
 f.fail(false);await f.context.copyCategoryOffers();assert.deepEqual(f.counts(),{loads:2,actions:1});
 const missing=fixture();const loader=missing.context.PTHAssets;missing.context.PTHAssets=undefined;await missing.context.copyCategoryOffers();
 missing.context.PTHAssets=loader;missing.release();await missing.context.copyCategoryOffers();assert.equal(missing.counts().actions,1);
});
test('session change while loading cancels the pending action; the new session can retry',async()=>{
 const f=fixture(),pending=f.context.copyCategoryOffers();f.token('b');f.release();await pending;
 assert.equal(f.counts().actions,0);assert.match(f.alerts[0],/sesión cambió/);assert.equal(f.button.disabled,false);
 await f.context.copyCategoryOffers();assert.equal(f.counts().actions,1);
});
test('the loader preserves feedback set by the successfully loaded action',async()=>{
 const f=fixture();f.context.PTHSalesTools={openSalesComposer:async()=>{f.button.innerHTML='Copiado';}};
 await f.context.copyCategoryOffers();assert.equal(f.button.innerHTML,'Copiado');assert.equal(f.button.disabled,false);
});
