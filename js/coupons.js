/* Direct-customer coupons. Presentation is advisory; the server authorizes. */
(function(root){
 'use strict';
 const doc=root.document,money=v=>'$'+Number(v).toFixed(2);
 let enabled=false,reviewed='',undiscounted=null,applying=false,quoteOnly=false,dialog,generation=0,opener,adminToken;
 const node=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const button=(text,action)=>{const n=node('button',text);n.type='button';n.addEventListener('click',action);return n;};
 const code=()=>String(doc.getElementById('pth-coupon-code')?.value||'').trim().toUpperCase();
 const status=text=>{const n=doc.getElementById('pth-coupon-status');if(n)n.textContent=text;};
 function invalidate(){
  const hadReview=!!reviewed;reviewed='';const s=doc.getElementById('pth-coupon-summary');if(s)s.hidden=true;
  if(hadReview){
   if(typeof root.recalcularTotalFinal==='function')root.recalcularTotalFinal();
   else {const total=doc.getElementById('total-convertido');if(total&&undiscounted!==null)total.textContent=money(undiscounted);}
   status(code()?'Cambiaste los datos. Aplica el cupón otra vez para comprobar el descuento.':'Cupón retirado. El total vuelve a mostrarse sin descuento.');
  }
 }
 function failure(error){invalidate();status(error?.message||'No se pudo comprobar el cupón. Conservamos los datos.');}
 function signature(request,quote){const {attempt,intentCreatedAt,...semantic}=request;return JSON.stringify([semantic,quote.terms]);}
 function review(request,quote){
  if(!request.coupon&&!code())return true;
  if(String(request.coupon||'').trim().toUpperCase()!==code()||request.inputs?.some(row=>row.telefono!==doc.getElementById('check-tel')?.value)){
   failure({message:'Cambiaste los datos mientras se comprobaba el cupón. Aplica el código otra vez.'});return false;
  }
  const terms=quote?.terms;
  if(!Array.isArray(terms)||!terms.length||terms.some(t=>!t.cupon_codigo||!Number.isFinite(t.descuento_productos)))throw Error('No se pudo comprobar el descuento.');
  const key=signature(request,quote),confirmed=reviewed===key&&!applying;applying=false;reviewed=key;
  const gross=terms.reduce((s,t)=>s+Number(t.subtotal_productos),0),discount=terms.reduce((s,t)=>s+Number(t.descuento_productos),0),shipping=terms.reduce((s,t)=>s+Number(t.costo_mensajeria),0),net=terms.reduce((s,t)=>s+Number(t.total),0);
  undiscounted=gross+shipping;
  const summary=doc.getElementById('pth-coupon-summary');
  if(summary){summary.hidden=false;summary.textContent=`Productos ${money(gross)} · Descuento −${money(discount)} · Mensajería ${money(shipping)} · Total ${money(net)} USD`;}
  const total=doc.getElementById('total-convertido');if(total)total.textContent=money(net);
  status(confirmed?'Descuento comprobado.':`Cupón ${terms[0].cupon_codigo} aplicado. Revisa el total y pulsa Confirmar Pedido para enviarlo.`);
  return confirmed;
 }
 function mount(){
  const form=doc.getElementById('checkout-form');if(!form||doc.getElementById('pth-coupon-entry'))return;
  const entry=node('details');entry.id='pth-coupon-entry';entry.className='pth-coupon-entry';entry.hidden=true;
  entry.append(node('summary','Tengo un código de descuento'));
  const label=node('label','Código');label.htmlFor='pth-coupon-code';
  const input=node('input');input.id='pth-coupon-code';input.maxLength=32;input.autocomplete='off';input.spellcheck=false;input.placeholder='Escribe tu código';
  const actions=node('div');actions.className='pth-coupon-actions';
  actions.append(button('Aplicar',()=>{
   if(!/^[A-Z0-9-]{4,32}$/.test(code())){failure({message:'Escribe un código válido de 4 a 32 letras, números o guiones.'});input.focus();return;}
   applying=true;quoteOnly=true;form.requestSubmit();
  }),button('Quitar cupón',()=>{input.value='';applying=false;quoteOnly=false;invalidate();status('Cupón retirado. Revisa el total antes de confirmar.');root.recalcularTotalFinal?.();}));
  const note=node('p','Solo para compras directas. No reduce la mensajería.');note.className='pth-coupon-note';
  const message=node('p');message.id='pth-coupon-status';message.setAttribute('role','status');
  const summary=node('p');summary.id='pth-coupon-summary';summary.hidden=true;summary.setAttribute('aria-live','polite');
  entry.append(label,input,actions,note,message,summary);
  const tel=doc.getElementById('check-tel'),anchor=tel?.closest('.grid')||tel?.parentElement;
  if(anchor&&anchor!==form&&form.contains(anchor))anchor.after(entry);else form.prepend(entry);
  form.addEventListener('input',invalidate);form.addEventListener('change',invalidate);form.addEventListener('reset',()=>{input.value='';invalidate();status('');});
 }
 function profile(){try{return JSON.parse(root.localStorage.getItem('pth_session')||'null')?.data;}catch(_){return null;}}
 const isAdmin=p=>p?.id&&!p.parent_id&&['admin','administrador','superadmin'].includes(String(p.rol).toLowerCase())&&p.estado==='activo'&&p.activo!==false;
 function sync(){
  mount();const entry=doc.getElementById('pth-coupon-entry');
  // Never discard an entered code merely because the local context changed.
  if(entry)entry.hidden=!code()&&(!enabled||!!root.PTHSecureData?.token()||!!root.PTHAffiliate?.checkoutReference?.());
  const p=profile(),nav=doc.getElementById('admin-master-nav');
  if(isAdmin(p)&&nav&&!doc.getElementById('pth-coupons-admin')){const b=button('Cupones',openAdmin);b.id='pth-coupons-admin';nav.append(b);}
  if(!isAdmin(p))doc.getElementById('pth-coupons-admin')?.remove();
  if(dialog?.open&&(!isAdmin(p)||root.PTHSecureData?.token()!==adminToken)){generation++;dialog.close();dialog.replaceChildren();}
 }
 async function adminRequest(body){
  const before=root.PTHSecureData.token(),rev=generation;
  if(!before||before!==adminToken)throw Error('La sesión cambió. Vuelve a abrir Cupones.');
  const result=await root.PTHSecureData.coupons(body);
  if(rev!==generation||before!==root.PTHSecureData.token())throw Error('La sesión cambió.');
  if(result.error)throw Error(result.error.message);return result.data;
 }
 function field(form,label,name,type='text',value=''){
  const wrap=node('label',label),input=node('input');input.name=name;input.type=type;input.value=value;input.required=true;
  if(type==='number'){input.min='1';input.step='1';}wrap.append(input);form.append(wrap);return input;
 }
 async function openAdmin(){
  if(!isAdmin(profile()))return;
  opener=doc.activeElement;generation++;adminToken=root.PTHSecureData.token();
  if(!dialog){dialog=node('dialog');dialog.className='pth-coupon-dialog';dialog.id='pth-coupon-dialog';dialog.addEventListener('close',()=>{generation++;dialog.replaceChildren();opener?.focus();});doc.body.append(dialog);}
  dialog.replaceChildren();const header=node('header'),title=node('h2','Cupones para clientes directos');title.id='pth-coupon-title';dialog.setAttribute('aria-labelledby',title.id);header.append(title,button('Cerrar',()=>dialog.close()));dialog.append(header);
  const message=node('p');message.setAttribute('role','status');message.textContent='La mensajería se cobra íntegra. No cambia las comisiones.';dialog.append(message);
  const form=node('form');form.className='pth-coupon-form';
  field(form,'Código','code');const kindLabel=node('label','Descuento'),kind=node('select');kind.name='kind';for(const [v,t] of [['fixed','Importe en USD'],['percent','Porcentaje']]){const o=node('option',t);o.value=v;kind.append(o);}kindLabel.append(kind);form.append(kindLabel);
  const value=field(form,'Valor','value','number');value.step='0.01';value.min='0.01';
  const minimum=field(form,'Compra mínima de productos (USD)','minimum','number','0');minimum.min='0';minimum.step='0.01';
  field(form,'Inicio','starts_at','datetime-local');field(form,'Fin','ends_at','datetime-local');
  field(form,'Usos totales','total_limit','number','100');field(form,'Usos por teléfono','phone_limit','number','1');
  const activeLabel=node('label','Activo'),active=node('input');active.name='active';active.type='checkbox';activeLabel.append(active);form.append(activeLabel);
  const reason=field(form,'Motivo del cambio','reason');reason.maxLength=1000;
  const save=node('button','Guardar cupón');save.type='submit';form.append(save);dialog.append(form);
  const list=node('div');list.className='pth-coupon-list';dialog.append(list);dialog.showModal();
  let selected=null;
  const load=async()=>{
   const data=await adminRequest({operation:'list'});list.replaceChildren();
   for(const c of data.rows||[]){
    const item=node('article'),heading=node('strong',`${c.code} · ${c.active?'Activo':'Inactivo'}`),text=node('p',`${c.kind==='percent'?c.value+' %':money(c.value/100)} · ${c.used_count??c.uses??0}/${c.total_limit} usos · Revisión ${c.revision}`);
    item.append(heading,text,button('Editar',()=>{
     selected=c;for(const k of ['code','kind','total_limit','phone_limit'])form.elements[k].value=c[k];form.elements.code.readOnly=true;
     value.value=c.kind==='fixed'?c.value/100:c.value;form.elements.minimum.value=c.minimum_cents/100;active.checked=!!c.active;
     for(const k of ['starts_at','ends_at']){const d=new Date(c[k]);form.elements[k].value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
     reason.value='';form.scrollIntoView({block:'nearest'});
    }));list.append(item);
   }
   if(!data.rows?.length)list.append(node('p','No hay cupones. Crea el primero cuando decidas la promoción.'));
  };
  form.addEventListener('submit',async e=>{
   e.preventDefault();if(save.disabled)return;save.disabled=true;message.textContent='Guardando…';
   try{
    const values=new FormData(form),k=values.get('kind'),amount=Number(values.get('value'));
    const campaign={...(selected?{id:selected.id,revision:selected.revision}:{}),code:values.get('code').trim().toUpperCase(),kind:k,value:k==='fixed'?Math.round(amount*100):amount,minimum_cents:Math.round(Number(values.get('minimum'))*100),starts_at:new Date(values.get('starts_at')).toISOString(),ends_at:new Date(values.get('ends_at')).toISOString(),total_limit:Number(values.get('total_limit')),phone_limit:Number(values.get('phone_limit')),active:active.checked,reason:values.get('reason').trim()};
    await adminRequest({operation:'save',campaign});await load();selected=null;form.reset();form.elements.code.readOnly=false;message.textContent='Cupón guardado. La activación general del módulo es independiente.';
   }catch(error){if(dialog.open)message.textContent=error.message;}finally{save.disabled=false;}
  });
  try{await load();}catch(error){if(dialog.open)message.textContent=error.message;}
 }
 root.PTHCoupons={code,review,failure,openAdmin,consumeApply:()=>{const value=quoteOnly;quoteOnly=false;return value;},clear:()=>{const input=doc.getElementById('pth-coupon-code');if(input)input.value='';quoteOnly=false;invalidate();status('');}};
 async function start(){sync();try{const r=await root.PTHSecureData?.coupons({operation:'settings'});enabled=r?.data?.enabled===true;sync();}catch(_){/* fail closed */}}
 root.addEventListener('pth:session-changed',()=>{invalidate();sync();});root.addEventListener('storage',()=>{invalidate();sync();});
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else void start();
 new MutationObserver(()=>{sync();}).observe(doc.body,{subtree:true,childList:true});
})(window);
