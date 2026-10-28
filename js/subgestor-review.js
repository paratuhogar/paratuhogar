/* Private review data stays in memory and is loaded only when the tab opens. */
(function(root){
 'use strict';
 const editable=['cliente','telefono','ci','direccion','municipio'];
 function splitDelivery(value){const text=String(value||''),match=text.match(/\[VUELTO:\s*([^\]]*)\]/i);return{direccion:text.replace(/\s*\[VUELTO:[^\]]*\]/gi,'').trim(),vuelto:match?.[1]?.trim()||''};}
 function deliveryWithChange(address,change){const clean=splitDelivery(address).direccion,v=String(change||'').trim();if(v&&(!/^\d+(?:\.\d{1,2})?$/.test(v)||Number(v)<=0))throw Error('Indica un vuelto positivo o deja el campo vacío.');return clean+(v?' [VUELTO: '+v+']':'');}
 function createController({api,account,onChange=()=>{}}){
  const state={rows:[],search:'',offset:0,hasMore:false,history:false,loading:false,busy:false,error:'',notice:''};let generation=0;
  const emit=()=>onChange(state);
  function clear(){generation++;Object.assign(state,{rows:[],search:'',offset:0,history:false,hasMore:false,loading:false,busy:false,error:'',notice:''});emit();}
  async function load(search='',offset=0,history=state.history){
   if(state.busy)return false;
   const key=account(),version=++generation;
   if(!key){clear();return false;}
   if(history!==state.history){state.rows=[];state.hasMore=false;}
   Object.assign(state,{search,offset,history,loading:true,error:''});emit();
   try{
    const result=await api({operation:history?'history':'list',search,offset});
    if(version!==generation||key!==account())return false;
    if(result.error||!Array.isArray(result.data?.rows))throw Error(result.error?.message||'No se pudo leer la lista.');
    state.rows=offset?[...new Map([...state.rows,...result.data.rows].map(r=>[r.id,r])).values()]:result.data.rows;
    state.hasMore=!!result.data.hasMore;return true;
   }catch(error){if(version===generation&&key===account())state.error=error.message;return false;}
   finally{if(version===generation&&key===account()){state.loading=false;emit();}}
  }
  async function mutate(row,operation,changes={},reason=''){
   if(state.busy||state.loading)return false;
   if(Object.keys(changes).some(k=>!editable.includes(k)))throw Error('Solo puedes editar datos de entrega.');
   if(!state.rows.some(r=>r.id===row.id&&r.review_version===row.review_version))throw Error('Actualiza el pedido antes de continuar.');
   const key=account(),version=generation;if(!key)return false;
   state.busy=true;state.error='';emit();
   try{
    const result=await api({operation,id:row.id,expected:row.review_version,changes,reason});
    if(key!==account()||version!==generation)return false;
    if(result.error||result.data?.id!==row.id)throw Error(result.error?.message||'No se confirmó la revisión. Actualiza antes de reintentar.');
    state.notice=result.data.replayed?'El pedido ya había sido revisado. Se conserva la decisión original; consulta el historial.':operation==='edit'?'Cambios guardados':operation==='approve'?'Pedido aprobado. Ya está disponible en logística.':'Pedido rechazado; el motivo quedó registrado.';
    state.busy=false;await load(state.search,0,state.history);return true;
   }catch(error){if(key===account()&&version===generation)state.error=error.message;return false;}
   finally{if(key===account()&&version===generation){state.busy=false;emit();}}
  }
  return{state,clear,load,more:()=>load(state.search,state.offset+50,state.history),save:(row,changes)=>mutate(row,'edit',changes),decide:(row,operation,reason='')=>{if(!['approve','reject'].includes(operation))throw Error('Decisión no válida.');return mutate(row,operation,{},reason);}};
 }
 const exported={createController,splitDelivery,deliveryWithChange};
 if(typeof module!=='undefined'&&module.exports){module.exports=exported;return;}
 let controller,host,editor;
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text??'');if(cls)el.className=cls;return el;};
 const account=()=>{const p=root.currentUserData,token=root.PTHSecureData?.token();return token&&p?.id&&!p.parent_id&&['admin','administrador','superadmin','logistica'].includes(String(p.rol).toLowerCase())?p.id+':'+token:null;};
 function button(label,work){const b=node('button',label);b.type='button';b.addEventListener('click',()=>Promise.resolve().then(work).catch(e=>{controller.state.error=e.message;render();}));return b;}
 function edit(row){
  if(controller.state.busy||controller.state.loading)return;
  editor?.remove();editor=node('dialog',undefined,'sr-editor');const form=node('form');form.method='dialog';
  form.append(node('h3','Editar '+row.orden_dia));const inputs={},delivery=splitDelivery(row.direccion);
  for(const [key,label,value] of [['cliente','Cliente',row.cliente],['telefono','Teléfono',row.telefono],['ci','Carnet de identidad',row.ci],['municipio','Municipio',row.municipio],['direccion','Dirección y notas',delivery.direccion],['vuelto','Vuelto de ($)',delivery.vuelto]]){
   const wrap=node('label',label),input=node(key==='direccion'?'textarea':'input');input.name=key;input.value=value||'';if(key==='vuelto'){input.inputMode='decimal';input.placeholder='Sin vuelto';}wrap.append(input);form.append(wrap);inputs[key]=input;
  }
  const feedback=node('p');feedback.setAttribute('role','alert');form.append(feedback);
  const cancel=button('Cancelar',()=>editor.close()),save=button('Guardar cambios',async()=>{
   const changes={};for(const k of editable)changes[k]=inputs[k].value.trim();
   try{changes.direccion=deliveryWithChange(changes.direccion,inputs.vuelto.value);save.disabled=true;cancel.disabled=true;
    if(await controller.save(row,changes))editor.close();else feedback.textContent=controller.state.error||'No se guardó el cambio. Revisa y vuelve a intentar.';
   }catch(e){feedback.textContent=e.message;}finally{save.disabled=false;cancel.disabled=false;}
  });form.append(cancel,save);editor.append(form);document.body.append(editor);editor.showModal();
 }
 function render(){
  if(!host)return;const state=controller.state,list=host.querySelector('[data-review-list]'),status=host.querySelector('[data-review-status]');
  status.textContent=state.loading?'Cargando pedidos…':state.error||state.notice||(state.rows.length+' registros mostrados');
  for(const b of host.querySelectorAll('button'))b.disabled=state.busy||state.loading;
  const search=host.querySelector('input');search.disabled=state.busy;if(!account())search.value='';
  list.replaceChildren();
  if(!state.rows.length&&!state.loading)list.append(node('p',state.error?'No se pudo actualizar. Pulsa Actualizar para reintentar.':'No hay registros que coincidan con esta búsqueda.'));
  for(const row of state.rows){const card=node('article',undefined,'sr-card');
   card.append(node('strong','#'+(row.orden_dia||row.reference||'Sin referencia')),node('h3',row.cliente),node('p','Subgestor: '+(row.subgestor_nombre||'—')),node('p','Gestor principal: '+(row.parent_gestor_nombre||'—')));
   if(state.history){card.append(node('p',({approve:'Aprobado',reject:'Rechazado',edit:'Editado'})[row.decision]+' por '+row.actor_name),node('p',new Date(row.created_at).toLocaleString('es-CU',{timeZone:'America/Havana'})),node('p',row.reason||''));}
   else{
    card.append(node('p',row.producto),node('p',row.direccion),node('p','Teléfono: '+row.telefono),node('p','Total: $'+Number(row.total).toFixed(2)+' USD'));
    const actions=node('div',undefined,'sr-actions');actions.append(button('Editar entrega',()=>edit(row)),button('Aprobar',async()=>{if(root.confirm('¿Aprobar #'+row.orden_dia+' y enviarlo a logística sin cambiar sus importes?'))await controller.decide(row,'approve');}),button('Rechazar',async()=>{const reason=root.prompt('Motivo del rechazo de #'+row.orden_dia+':');if(reason===null)return;if(!reason.trim())throw Error('Indica un motivo antes de rechazar.');if(root.confirm('¿Rechazar este pedido? Se conservará un registro del motivo.'))await controller.decide(row,'reject',reason);}));
    for(const b of actions.querySelectorAll('button'))b.disabled=state.busy||state.loading;card.append(actions);
   }list.append(card);
  }
  const more=host.querySelector('[data-review-more]');more.hidden=!state.hasMore;
  const counter=document.getElementById('admin-subgestor-count');if(counter&&!state.history)counter.textContent=state.loading?'…':state.error?'':String(state.rows.length)+(state.hasMore?'+':'');
  host.querySelector('[data-review-mode]').textContent=state.history?'Ver pendientes':'Historial de decisiones';
 }
 async function open(){
  if(!account())return;host=document.getElementById('admin-subgestor-review');if(!host)return;
  if(!controller){controller=createController({account,api:body=>root.PTHSecureData.reviewSubgestor(body),onChange:render});
   const heading=node('h2','Pedidos de subgestores'),intro=node('p','Revisa la entrega antes de enviarla a logística. Se conservan la referencia y las comisiones.'),bar=node('form',undefined,'sr-search'),search=node('input');search.placeholder='Referencia, cliente o comercial';search.setAttribute('aria-label','Buscar pedidos de subgestores');search.maxLength=120;
   const submit=node('button','Buscar');submit.type='submit';bar.append(search,submit);bar.addEventListener('submit',e=>{e.preventDefault();void controller.load(search.value.trim());});
   const mode=button('Historial de decisiones',()=>controller.load(search.value.trim(),0,!controller.state.history));mode.dataset.reviewMode='';
   const refresh=button('Actualizar',()=>controller.load(search.value.trim(),0)),status=node('p');status.dataset.reviewStatus='';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
   const list=node('div',undefined,'sr-list');list.dataset.reviewList='';const more=button('Cargar más',()=>controller.more());more.dataset.reviewMore='';more.hidden=true;
   host.replaceChildren(heading,intro,bar,refresh,mode,status,list,more);
   root.addEventListener('pth:session-changed',()=>{controller.clear();editor?.remove();});root.addEventListener('pagehide',()=>{controller.clear();editor?.remove();});
   root.addEventListener('storage',event=>{if(['pth_secure_token','pth_session'].includes(event.key)){controller.clear();editor?.remove();}});
  }
  await controller.load(controller.state.search,0,controller.state.history);
 }
 root.PTHSubgestorReview={...exported,open};
})(window);
