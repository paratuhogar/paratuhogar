const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
// Catch disappearing confirmations, wrong receipt numbers and stale-account actions.
function setup(){
 const nodes=new Map();class Node{constructor(tag){this.tagName=tag;this.children=[];this.hidden=false;this.style={};}append(...n){this.children.push(...n);}replaceChildren(...n){this.children=n;}remove(){this.removed=true;}setAttribute(k,v){this[k]=v;}before(n){nodes.set(n.id,n);}querySelector(){return null;}}
 const catalog=new Node('section');nodes.set('sec-catalogo',catalog);const document={createElement:t=>new Node(t),getElementById:id=>nodes.get(id)||null};
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 let owner='a',token='session-a',opened=[];const events={};
 const root={document,localStorage:storage,PTHSecureData:{accountId:()=>owner,token:()=>token},addEventListener:(n,fn)=>events[n]=fn,open:(...args)=>{opened.push(args);return null;}};
 const context={window:root,module:{exports:{}},Date,URL,console};
 try{vm.runInNewContext(fs.readFileSync(new URL('../js/checkout-confirmation.js',`file://${__filename}`),'utf8'),context);}catch(e){if(e.code!=='ENOENT')throw e;}
 return {api:root.PTHCheckoutConfirmation,root,data,nodes,opened,switchAccount(){owner='b';token='session-b';events['pth:session-changed']?.();}};
}
test('confirmed order keeps a WhatsApp action even when automatic opening is blocked',async()=>{
 const f=setup();assert.ok(f.api,'confirmation component must exist');
 f.api.show({owner:'a',table:'pedidos',phone:'5356071095',receipts:[{reference:'CA-1539',proveedor:'CA'}],message:'Pedido confirmado #CA-1539'});
 const card=f.nodes.get('pth-checkout-confirmations');assert.ok(card);const button=card.children[0].children.find(x=>x.tagName==='button');assert.ok(button);
 assert.equal(f.opened.length,0);await button.onclick();assert.equal(f.opened.length,1);assert.match(f.opened[0][0],/phone=5356071095/);assert.match(decodeURIComponent(f.opened[0][0]),/CA-1539/);assert.ok(!card.removed);
});
test('stored confirmation contains only routing and references, not the message or credentials',()=>{
 const f=setup();assert.ok(f.api);f.api.show({owner:'a',table:'pedidos',phone:'5356071095',receipts:[{reference:'CA-1539'}],message:'Private customer and address'});
 const saved=[...f.data.values()].join('');assert.match(saved,/CA-1539/);assert.doesNotMatch(saved,/Private customer|session-a/);
});
test('account switch clears the card and prevents a captured button from opening private text',async()=>{
 const f=setup();assert.ok(f.api);f.api.show({owner:'a',table:'pedidos',phone:'5356071095',receipts:[{reference:'CA-1539'}],message:'Private customer'});
 const card=f.nodes.get('pth-checkout-confirmations'),button=card.children[0].children.find(x=>x.tagName==='button');f.switchAccount();await button.onclick();assert.equal(f.opened.length,0);assert.ok(card.removed);
});
test('subgestor recovered voucher uses assigned commission, never the complete pool',()=>{
 const f=setup();const message=f.api.format([{orden_dia:'CA-1539',fecha:'2026-10-08T19:10:00Z',cliente:'Cliente',telefono:'51112233',producto:'1x Televisor',total:535,costo_mensajeria:15,comision_total:90,comision_subgestor:5,gestor:'Principal',direccion:'Dirección [NOTA: [PAGO: USD (Efectivo)]]'}],{isSubgestor:true,name:'Subgestor',phone:'5351122333'});
 assert.match(message,/CA-1539/);assert.match(message,/asignada al subgestor: \$5/);assert.doesNotMatch(message,/\$90/);assert.match(message,/USD \(Efectivo\)/);
});
test('restore retrieves the actual scoped voucher, then opens it on a direct click',async()=>{
 const f=setup();f.api.show({owner:'a',table:'pedidos',phone:'5356071095',receipts:[{reference:'CA-1539'}]});
 f.api.configure({load:async()=> 'Pedido #CA-1539 recuperado'});
 const button=f.nodes.get('pth-checkout-confirmations').children[0].children.find(x=>x.tagName==='button');
 await button.onclick();assert.equal(f.opened.length,0);assert.equal(button.disabled,false);assert.match(button.textContent,/WhatsApp/);
 await button.onclick();assert.equal(f.opened.length,1);assert.match(decodeURIComponent(f.opened[0][0]),/CA-1539 recuperado/);
});
test('storage refusal cannot remove an acknowledged receipt from the current page',()=>{
 const f=setup();f.root.localStorage.setItem=()=>{throw Error('QuotaExceeded');};
 f.api.show({owner:'a',table:'pedidos',phone:'5356071095',receipts:[{reference:'CA-1539'}],message:'Confirmed order'});f.api.restore();
 assert.ok(!f.nodes.get('pth-checkout-confirmations').removed);
});
