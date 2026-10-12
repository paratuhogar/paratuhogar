const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
// Catch disappearing confirmations, wrong receipt numbers and stale-account actions.
function setup(data=new Map()){
 const nodes=new Map();class Node{constructor(tag){this.tagName=tag;this.children=[];this.hidden=false;this.style={};}append(...n){this.children.push(...n);}replaceChildren(...n){this.children=n;}remove(){this.removed=true;}setAttribute(k,v){this[k]=v;}before(n){nodes.set(n.id,n);}querySelector(){return null;}}
 const catalog=new Node('section');nodes.set('sec-catalogo',catalog);const document={createElement:t=>new Node(t),getElementById:id=>nodes.get(id)||null};
 const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 let owner='a',token='session-a',opened=[];const events={};
 const root={document,localStorage:storage,PTHSecureData:{accountId:()=>owner,token:()=>token},addEventListener:(n,fn)=>events[n]=fn,open:(...args)=>{opened.push(args);return null;}};
 const context={window:root,module:{exports:{}},Date,URL,console};
 try{vm.runInNewContext(fs.readFileSync(new URL('../js/checkout-confirmation.js',`file://${__filename}`),'utf8'),context);}catch(e){if(e.code!=='ENOENT')throw e;}
 return {api:root.PTHCheckoutConfirmation,root,data,nodes,opened,emit(name){events[name]?.();},switchAccount(){owner='b';token='session-b';events['pth:session-changed']?.();}};
}
const confirmed=(f,reference='CA-1539',extra={})=>f.api.show({owner:'a',table:'pedidos',phone:'5356071095',receipts:[{reference}],message:'Synthetic confirmed order',...extra});
const sections=f=>{const card=f.nodes.get('pth-checkout-confirmations');return card&&!card.removed?card.children:[];};
const action=(f,text,index=0)=>sections(f)[index]?.children.find(n=>n.tagName==='button'&&n.textContent===text);
const close=f=>{const button=action(f,'Cerrar');assert.ok(button,'confirmed receipt must have a Close action');button.onclick();};

test('close hides only the selected confirmation and keeps receipts and pending state',()=>{
 const f=setup();f.data.set('synthetic-pending-orders','queued and failed orders');confirmed(f);confirmed(f,'CA-1540');
 const wa=action(f,'Enviar pedido por WhatsApp');close(f);close(f); // closes each independent receipt
 assert.equal(sections(f).length,0);assert.equal(f.data.get('synthetic-pending-orders'),'queued and failed orders');
 const saved=JSON.parse(f.data.get('pth_checkout_confirmations_v1'));assert.equal(saved.length,2);assert.equal(saved[0].receipts[0].reference,'CA-1539');
 wa.onclick();assert.equal(f.opened.length,0,'a stale action cannot reopen a closed notice');
 assert.doesNotMatch(JSON.stringify(saved),/Synthetic|session-a|sent|enviado/);
});
test('closed receipt stays hidden through duplicate acknowledgment, storage, restore and reload',()=>{
 const f=setup();confirmed(f);close(f);confirmed(f);f.api.restore();f.emit('storage');assert.equal(sections(f).length,0);
 const reload=setup(f.data);reload.api.configure({});assert.equal(sections(reload).length,0);
 confirmed(reload);assert.equal(sections(reload).length,0);assert.equal(JSON.parse(f.data.get('pth_checkout_confirmations_v1')).length,1);
});
test('new order remains visible after an older confirmation was closed',()=>{
 const f=setup();confirmed(f);close(f);confirmed(f,'CA-1540');assert.equal(sections(f).length,1);assert.match(sections(f)[0].children[0].textContent,/CA-1540/);assert.ok(action(f,'Cerrar'));
});
test('opening WhatsApp never closes the notice or marks the order as sent',()=>{
 const f=setup();confirmed(f);const before=f.data.get('pth_checkout_confirmations_v1');action(f,'Enviar pedido por WhatsApp').onclick();action(f,'Enviar pedido por WhatsApp').onclick();
 assert.equal(f.opened.length,2);assert.equal(sections(f).length,1);assert.equal(f.data.get('pth_checkout_confirmations_v1'),before);assert.ok(action(f,'Cerrar'));
});
test('receipt recovery and its failure cannot be dismissed until a successful retry',async()=>{
 const f=setup();confirmed(f,'CA-1539',{message:null});let release;f.api.configure({load:()=>new Promise(resolve=>release=resolve)});
 const promise=action(f,'Enviar pedido por WhatsApp').onclick();assert.equal(action(f,'Cerrar')?.disabled,true);action(f,'Cerrar').onclick();assert.equal(sections(f).length,1);
 release(null);await promise;assert.match(sections(f)[0].children[1].textContent,/No se pudo recuperar/);assert.equal(action(f,'Cerrar').disabled,true);action(f,'Cerrar').onclick();assert.equal(sections(f).length,1);
 confirmed(f,'CA-1540');assert.match(sections(f)[0].children[1].textContent,/No se pudo recuperar/);assert.equal(action(f,'Cerrar').disabled,true);
 f.api.configure({load:async()=> 'Synthetic recovered receipt'});await action(f,'Enviar pedido por WhatsApp').onclick();assert.equal(action(f,'Cerrar').disabled,false);close(f);assert.equal(sections(f).length,1);assert.equal(f.opened.length,0);
});
test('storage write refusal cannot resurrect a closed confirmation during navigation',()=>{
 const f=setup();confirmed(f);f.root.localStorage.setItem=()=>{throw Error('QuotaExceeded');};close(f);f.api.restore();f.emit('storage');assert.equal(sections(f).length,0);
});
test('a synchronous recovery failure stays visible and allows retry',async()=>{
 const f=setup();confirmed(f,'CA-1539',{message:null});f.api.configure({load:()=>{throw Error('Synthetic offline failure');}});
 await action(f,'Enviar pedido por WhatsApp').onclick();assert.match(sections(f)[0].children[1].textContent,/No se pudo recuperar/);assert.equal(action(f,'Cerrar').disabled,true);assert.equal(action(f,'Enviar pedido por WhatsApp').disabled,false);
});
test('dismissal from another tab survives restore and later acknowledgments',()=>{
 const a=setup();confirmed(a);const b=setup(a.data);b.api.configure({});close(a);b.emit('storage');b.api.restore();assert.equal(sections(b).length,0);
 confirmed(b,'CA-1540');const reload=setup(a.data);reload.api.configure({});assert.equal(sections(reload).length,1);assert.match(sections(reload)[0].children[0].textContent,/CA-1540/);
});
test('a new acknowledgment synchronizes another tab dismissal even before its storage event',()=>{
 const a=setup();confirmed(a);const b=setup(a.data);b.api.configure({});close(a);confirmed(b,'CA-1540');assert.equal(sections(b).length,1);assert.match(sections(b)[0].children[0].textContent,/CA-1540/);
 const reload=setup(a.data);reload.api.configure({});assert.equal(sections(reload).length,1);
});
test('closed receipt remains dismissed after more than 25 newer confirmations',()=>{
 const f=setup();confirmed(f);close(f);for(let i=0;i<26;i++)confirmed(f,'CA-'+(1540+i));confirmed(f);assert.equal(sections(f).length,25);assert.ok(sections(f).every(s=>!s.children[0].textContent.includes('CA-1539')));
 const reload=setup(f.data);reload.api.configure({});confirmed(reload);assert.ok(sections(reload).every(s=>!s.children[0].textContent.includes('CA-1539')));
 assert.ok(JSON.parse(f.data.get('pth_checkout_confirmations_v1')).some(e=>e.receipts[0].reference==='CA-1539'),'closed receipt remains stored within its seven-day retention');
});
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
