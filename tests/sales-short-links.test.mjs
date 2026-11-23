import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function fixture() {
 const nodes=new Map(),buttons=Array.from({length:3},()=>({disabled:false})),copied=[],opened=[];
 const node=()=>({value:'',textContent:'',hidden:false,style:{},classList:{add(){},remove(){}},set innerHTML(v){this.textContent=String(v).replace(/<[^>]*>/g,'');},get innerHTML(){return this.textContent;}});
 const document={body:{style:{}},getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node,querySelectorAll:()=>buttons};
 const root={gestorName:'Child',currentUserData:{id:'22222222-2222-4222-a222-222222222222'},location:{origin:'https://paratuhogar.org',pathname:'/'},PTHAffiliate:{reference:p=>p.id,publicName:()=> 'Child',current:()=>({})},open:url=>opened.push(url)};
 const ctx=vm.createContext({window:root,document,navigator:{clipboard:{writeText:async text=>copied.push(text)}},getProductsVisibleOnScreen:()=>[{nombre:'Equipo',precio:10,disponible:'SI'}],getAgentPhone:()=> '5350000002',fixDriveUrl:value=>value||'',activeCategory:'TODOS',trackSpy(){},URLSearchParams,Set,console,setTimeout});
 vm.runInContext(fs.readFileSync(new URL('../js/sales-tools.js',import.meta.url),'utf8'),ctx);
 return{root,ctx,nodes,buttons,copied,opened};
}
test('broadcast never exposes a long URL while shortening is pending or failed; explicit retry unlocks only a short URL',async()=>{
 const f=fixture();let reject;f.ctx.getOrGenerateShortLink=()=>new Promise((_,no)=>{reject=no;});
 const opening=f.root.PTHSalesTools.openSalesComposer('broadcast');
 assert.equal(f.nodes.get('sales-composer-preview').value,'');assert.ok(f.buttons.every(b=>b.disabled));
 await f.root.copySalesComposerMessage({});f.root.openSalesComposerWhatsApp();assert.equal(f.copied.length,0);assert.equal(f.opened.length,0);
 reject(Error('offline'));await opening;assert.equal(f.nodes.get('sales-composer-link-retry').hidden,false);assert.equal(f.nodes.get('sales-composer-preview').value,'');
 f.ctx.getOrGenerateShortLink=async()=> 'https://paratuhogar.org/?s=child01';await f.root.retrySalesComposerLink();
 assert.match(f.nodes.get('sales-composer-preview').value,/\?s=child01/);assert.doesNotMatch(f.nodes.get('sales-composer-preview').value,/ref=|contact=/);assert.ok(f.buttons.every(b=>!b.disabled));
 f.root.openSalesComposerWhatsApp();assert.equal(f.opened.length,1);
});
test('closing the composer or replacing its account discards late link results',async()=>{
 const f=fixture();let resolve;f.ctx.getOrGenerateShortLink=()=>new Promise(ok=>{resolve=ok;});
 const opening=f.root.PTHSalesTools.openSalesComposer();f.root.closeSalesComposer();resolve('https://paratuhogar.org/?s=oldcode');await opening;
 assert.equal(f.nodes.get('sales-composer-preview').value,'');
 const again=f.root.PTHSalesTools.openSalesComposer();f.root.currentUserData={id:'other'};resolve('https://paratuhogar.org/?s=oldcode');await again;
 await f.root.copySalesComposerMessage({});assert.equal(f.copied.length,0);assert.equal(f.opened.length,0);
});
