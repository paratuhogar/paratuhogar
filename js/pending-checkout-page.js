/* Static offline form. Only a verified online session can resume the existing checkout. */
(() => {
  'use strict';
  let storage,idb;try{storage=localStorage;idb=indexedDB;}catch(_){}
  const api=PTHPendingCheckout,queue=api.create(api.indexedStore(idb)),store=PTHLowConnectivity.create(storage);
  const owner=api.localOwner(storage),form=document.getElementById('pending-form'),status=document.getElementById('pending-status'),actions=document.getElementById('pending-actions');
  const saved=store.readPublic(),products=saved?.products||[],selection=new Map();
  let record=null,busy=false,departing=false,renderGeneration=0;
  const inScope=token=>api.localOwner(storage)===owner&&(token===undefined||PTHSecureData.token()===token);
  let zones=[];try{const copy=JSON.parse(storage.getItem('pth_pending_delivery_zones_v1')||'null');if(copy?.savedAt&&Date.now()-copy.savedAt<api.AGE&&Array.isArray(copy.zones))zones=copy.zones.slice(0,5000);}catch(_){}
  function populate(id,values){const list=document.getElementById(id);list.replaceChildren();for(const value of new Set(values)){const option=document.createElement('option');option.value=String(value);list.append(option);}}
  populate('pending-municipios',zones.map(p=>p.municipio));
  document.getElementById('pending-municipio').oninput=()=>populate('pending-localidades',zones.filter(p=>p.municipio===document.getElementById('pending-municipio').value).map(p=>p.localidad));
  const normal=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
  const states={queued:'Guardado. Esperando conexión con el servidor.',sending:'Se está comprobando el envío. Espera su confirmación.',uncertain:'Se perdió la respuesta. Comprobaremos el recibo antes de reintentar.',blocked:'Revisa el pendiente antes de reintentar.',paused:'Reintentos detenidos. Comprueba el recibo del intento anterior.',expired:'Este pendiente venció. Revisa tus pedidos antes de iniciar otro.',confirmed:'El servidor confirmó la recepción.'};
  function addButton(label,callback,kind=''){const button=document.createElement('button');button.type='button';button.textContent=label;button.className=kind;button.onclick=async()=>{button.disabled=true;try{await callback();}catch(_){status.textContent='No se pudo completar la operación. El estado anterior se conserva.';}finally{button.disabled=false;}};actions.append(button);}
  function renderProducts(){
    const container=document.getElementById('pending-products');container.replaceChildren();
    const terms=normal(document.getElementById('pending-search').value).split(' ').filter(Boolean);
    const rows=products.filter(p=>p.disponible==='SI'&&terms.every(term=>normal(p.nombre).includes(term)));
    for(const product of rows.slice(0,30)){
      const row=document.createElement('div');row.className='product';const name=document.createElement('span');name.textContent=product.nombre+' · $'+Number(product.precio).toFixed(2)+' USD';
      const quantity=document.createElement('input');quantity.type='number';quantity.min='0';quantity.max='10000';quantity.value=selection.get(product.id)?.qty||0;quantity.setAttribute('aria-label','Cantidad de '+product.nombre);
      quantity.oninput=()=>{const qty=Number(quantity.value);if(qty>0)selection.set(product.id,{id:product.id,qty,price:Number(product.precio)});else selection.delete(product.id);renderSelection();};row.append(name,quantity);container.append(row);
    }
    if(rows.length>30){const note=document.createElement('p');note.textContent='Busca un modelo para ver más resultados.';container.append(note);}
    renderSelection();
  }
  function renderSelection(){const total=[...selection.values()].reduce((sum,p)=>sum+p.qty,0);document.getElementById('pending-selection').textContent=total+' equipos seleccionados. La selección se mantiene al buscar.';}
  function renderSummary(row){
    const section=document.getElementById('pending-summary'),container=document.getElementById('pending-summary-text');container.replaceChildren();section.hidden=!row?.form;if(!row?.form)return;
    const customer=document.createElement('p');customer.textContent=row.form.nombre+' · '+row.form.tel;container.append(customer);
    const address=document.createElement('p');address.textContent=row.form.pickup?'Recogida en el almacén':row.form.dir+' · '+row.form.localidad+', '+row.form.municipio;container.append(address);
    for(const p of row.lines){const line=document.createElement('p');line.textContent=p.qty+' × '+(products.find(product=>product.id===p.id)?.nombre||'Producto guardado')+' · $'+p.price.toFixed(2);container.append(line);}
  }
  function clearPrivateView(){record=null;form.hidden=true;document.getElementById('pending-summary').hidden=true;document.getElementById('pending-summary-text').replaceChildren();document.getElementById('pending-detail').textContent='';}
  async function refresh(){
    const generation=++renderGeneration;
    actions.replaceChildren();
    if(!owner||api.localOwner(storage)!==owner){clearPrivateView();status.textContent='Entra en tu cuenta con conexión antes de preparar un pendiente en este dispositivo.';return;}
    let row;try{row=await queue.read(owner);}catch(_){if(generation===renderGeneration&&inScope()){clearPrivateView();status.textContent='No se pudo abrir el almacenamiento. No hay un pendiente guardado; mantén los datos en la pantalla de la tienda.';}return;}
    if(generation!==renderGeneration||!inScope())return;
    record=row;
    renderSummary(record);status.textContent=record?states[record.state]||states.blocked:'Completa el pedido y pulsa Dejar pendiente de envío.';
    document.getElementById('pending-detail').textContent=record?.message|| (record?.state==='confirmed'?record.receipts.map(p=>p.reference).join(', '):'');
    form.hidden=Boolean(record?.form||record?.attempt);
    if(!record?.form&&!record?.attempt){
      form.hidden=!products.length;if(!products.length)status.textContent='Todavía no hay una copia de productos guardada. Abre la tienda con conexión y guarda primero el catálogo.';
      const draft=store.readDraft(owner);if(!selection.size&&draft)for(const p of draft.lines){const product=products.find(product=>product.id===p.id);if(product)selection.set(p.id,{...p,price:Number(product.precio)});}renderProducts();
    }
    if(record?.form){
      addButton(record.outcome?.attempt?'Detener reintentos':'Cancelar pendiente',async()=>{if(!inScope())return;const revision=record.id,token=PTHSecureData.token();await queue.cancel(owner,revision);if(!inScope(token))return;form.reset();selection.clear();await refresh();},'danger');
      if(['blocked','paused'].includes(record.state))addButton('Reintentar con mi cuenta',async()=>{if(!inScope())return;const revision=record.id;await queue.retry(owner,revision);if(!inScope())return;await refresh();await reconnect();});
    }
    if(record?.attempt||record?.outcome?.attempt)addButton('Comprobar recepción',async()=>{
      if(!inScope())return;
      const current=record,token=PTHSecureData.token();
      const receipt=await PTHSecureData.checkout({operation:'receipt',attempt:current.outcome?.attempt||current.attempt});
      if(!inScope(token))return;
      if(receipt.error){status.textContent='No se pudo comprobar la recepción. Conservamos la clave del intento; revisa tus pedidos antes de iniciar otro.';return;}
      if(receipt.data.complete){await queue.confirmed(owner,current.id,receipt.data.confirmed);if(!inScope(token))return;store.clearDraft(owner);form.reset();selection.clear();await refresh();}
      else if(current.form){status.textContent='El servidor aún no confirma el envío completo. Puedes reintentar con tu misma cuenta.';}
      else if(!receipt.data.confirmed.length){await queue.patch(owner,current.id,{attempt:null,state:'paused',priorAttempts:[...new Set([...(current.priorAttempts||[]),current.attempt].filter(Boolean))]});if(!inScope(token))return;status.textContent='El servidor no confirma este intento. Conservamos su clave al preparar otro para evitar un duplicado si llega una respuesta tardía.';await refresh();}
      else status.textContent='El servidor confirma parte del envío. Revisa tus pedidos; no se reenviará automáticamente.';
    });
  }
  async function reconnect(){
    if(busy||departing||navigator.onLine===false||!owner||api.localOwner(storage)!==owner)return;
    busy=true;const token=PTHSecureData.token();
    try{
      const current=await queue.read(owner);
      if(api.localOwner(storage)!==owner||PTHSecureData.token()!==token)return;
      if(!current?.form||!['queued','uncertain','sending'].includes(current.state))return;
      // The gateway is never cached. navigator.onLine alone is not evidence.
      const profile=await PTHSecureData.restore();
      if(profile?.id!==owner||api.localOwner(storage)!==owner||PTHSecureData.token()!==token){status.textContent='Vuelve a la misma cuenta que preparó el pendiente para enviarlo.';return;}
      departing=true;location.replace('/?pending_order=1');
    }catch(_){status.textContent='Pedido guardado. Aún no hay conexión confirmada con el servidor, o necesitas volver a tu cuenta.';}
    finally{busy=false;}
  }
  form.onsubmit=async event=>{
    event.preventDefault();if(!form.reportValidity())return;
    const button=document.getElementById('pending-save');button.disabled=true;
    try{
      if(api.localOwner(storage)!==owner)throw Object.assign(Error('ACCOUNT'),{code:'ACCOUNT'});
      const values={};for(const field of ['nombre','ci','tel','municipio','localidad','dir','notas','moneda','vuelto'])values[field]=document.getElementById('pending-'+field).value;
      values.pickup=document.getElementById('pending-pickup').checked;
      const token=PTHSecureData.token();
      const current=await queue.save(owner,{lines:[...selection.values()],form:values},store.readDraft(owner));
      if(!inScope(token))return;
      record=current;
      form.reset();selection.clear();await refresh();await reconnect();
    }catch(error){status.textContent=error.code==='INVALID'?'Selecciona productos con cantidades válidas y completa nombre, teléfono y entrega.':'No se pudo guardar el pendiente. No cierres la página; conserva los datos para reintentar.';}
    finally{button.disabled=false;}
  };
  document.getElementById('pending-search').oninput=renderProducts;
  document.getElementById('pending-pickup').onchange=()=>{const pickup=document.getElementById('pending-pickup').checked;document.getElementById('pending-delivery').hidden=pickup;for(const field of ['municipio','localidad','dir'])document.getElementById('pending-'+field).required=!pickup;};
  window.addEventListener('storage',()=>{if(api.localOwner(storage)!==owner){form.reset();selection.clear();void refresh();}});
  window.addEventListener('pth:session-changed',event=>{if(api.localOwner(storage)!==owner){form.reset();selection.clear();if(event.reason==='logout'&&owner)void queue.logout(owner).catch(()=>{});}void refresh();});
  window.addEventListener('online',()=>void reconnect());window.addEventListener('focus',()=>{void refresh();void reconnect();});
  setInterval(()=>{void refresh();void reconnect();},15000);
  void refresh().then(reconnect);
})();
