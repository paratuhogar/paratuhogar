import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const child='22222222-2222-4222-a222-222222222222',parent='11111111-1111-4111-a111-111111111111';
function fixture(search='?s=child01') {
 const appended=[],removed=[],replaced=[],memory=new Map();
 const document={getElementById:()=>null,body:{append:node=>appended.push(node)},createElement:tag=>({tag,children:[],style:{},setAttribute(){},append(...nodes){this.children.push(...nodes);}})};
 const root={location:{search,replace:value=>replaced.push(value)},PTHShortLinks:{resolve:async()=>({url:'https://paratuhogar.org/?ref='+child,row:{gestor:'Parent label'}})}};
 const sessionStorage={setItem:(k,v)=>memory.set(k,v),removeItem:k=>{removed.push(k);memory.delete(k);}};
 const ctx=vm.createContext({window:root,URL,URLSearchParams,document,sessionStorage,console});
 vm.runInContext(read('js/affiliate-links.js'),ctx);
 const source=read('js/storefront.js'),start=source.indexOf('async function checkShortLinks()');
 vm.runInContext(source.slice(start,source.indexOf('// The startup handler',start)),ctx);
 return{ctx,root,appended,replaced,memory};
}
test('storefront resolves a child short link without substituting parent label, contact or memory',async()=>{
 const f=fixture();assert.equal(await f.ctx.checkShortLinks(),true);
 assert.equal(new URL(f.replaced[0]).searchParams.get('ref'),child);assert.equal(f.appended.length,0);
 assert.equal(f.memory.get('pth_redirecting'),'true');
});
test('failed or missing short link blocks anonymous fallthrough and offers retry without rewriting URL',async()=>{
 const f=fixture();f.root.PTHShortLinks.resolve=async()=>{throw Error('offline');};
 assert.equal(await f.ctx.checkShortLinks(),true);assert.equal(f.replaced.length,0);assert.equal(f.memory.size,0);
 assert.equal(f.appended[0].id,'pth-short-link-error');assert.match(f.appended[0].children[2].textContent,/Reintentar/);
});
test('organic entry makes no shortener request and cannot create referral provenance',async()=>{
 const f=fixture('');f.root.PTHShortLinks.resolve=()=>{throw Error('should not call');};
 assert.equal(await f.ctx.checkShortLinks(),false);assert.equal(f.root.PTHAffiliate.checkoutReference(),null);
});
test('new commercial links resolve legacy name to exact UUID and do not swallow ambiguity or use parent contact',async()=>{
 const f=fixture('');let captured;
 f.root.PTHShortLinks={target:url=>new URL(url),shorten:async(url,options)=>{captured={url,options};return 'https://paratuhogar.org/?s=child01';}};
 f.ctx.resolveSalesHierarchy=async()=>({agent:{id:child,nombre:'Child',telefono:'5350000002'},parent:{id:parent,telefono:'5350000001'}});
 const source=read('js/storefront.js'),start=source.indexOf('async function getOrGenerateShortLink(');
 vm.runInContext(source.slice(start,source.indexOf('    // Función para copiar texto de venta profesional',start)),f.ctx);
 assert.equal(await f.ctx.getOrGenerateShortLink('Child','https://paratuhogar.org/?ref=Child&contact=5350000001'),'https://paratuhogar.org/?s=child01');
 const url=new URL(captured.url);assert.equal(url.searchParams.get('ref'),child);assert.equal(url.searchParams.get('contact'),'5350000002');assert.equal(captured.options.expectedRef,child);
 f.ctx.resolveSalesHierarchy=async()=>{throw Error('ambiguous');};await assert.rejects(f.ctx.getOrGenerateShortLink('Duplicate','https://paratuhogar.org/?ref=Duplicate'),/ambiguous/);
});

for (const [file,name,next] of [['js/storefront.js','approveAndWelcomeGestor','// --- FUNCIÓN PARA ELIMINAR'],['js/storefront-extras.js','sendWelcomeBackMsg','function sendCredentialsWA']]) test(name+' uses the selected child UUID even when the administrator has the same name',async()=>{
 const f=fixture('');let destination;
 f.root.currentUserData={id:parent,nombre:'Same Name'};f.root.location={origin:'https://paratuhogar.org',pathname:'/'};f.root.open=()=>{};
 f.ctx.confirm=()=>true;f.ctx.alert=()=>{};f.ctx.navigator={userAgent:''};f.ctx.loadPendingGestores=()=>{};
 f.ctx.supabaseClient={from:()=>({update(){return this;},eq:async()=>({error:null})})};
 f.ctx.getOrGenerateShortLink=async(_,url)=>{destination=new URL(url);return 'https://paratuhogar.org/?s=child01';};
 const source=read(file),start=source.indexOf('async function '+name+'(');vm.runInContext(source.slice(start,source.indexOf(next,start)),f.ctx);
 await f.ctx[name](child,'Same Name','5350000002','synthetic');
 assert.equal(destination.searchParams.get('ref'),child);assert.equal(destination.searchParams.get('contact'),'5350000002');
});
