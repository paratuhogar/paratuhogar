/* Bridges an explicitly saved local order to the existing validated checkout. */
(() => {
  'use strict';
  const api=window.PTHPendingCheckout;
  if(!api)return;
  let storage,idb;try{storage=localStorage;idb=indexedDB;}catch(_){}
  const queue=api.create(api.indexedStore(idb));
  let active=null,busy=false,lastOwner=api.localOwner(storage),panel=null,renderGeneration=0,reviewing=null,preparing=false;
  const owner=()=>window.PTHSecureData.accountId?.()||null;
  const form=document.getElementById('checkout-form');
  const labels={queued:'Guardado. Esperando conexión con el servidor.',sending:'Comprobando y enviando al servidor…',uncertain:'Comprobando si el servidor recibió el pedido. No se creará otro intento.',blocked:'El envío necesita revisión.',paused:'Reintentos detenidos. Comprueba si el servidor recibió el intento anterior.',expired:'El pendiente venció. Revisa tus pedidos antes de iniciar otro.',confirmed:'El servidor confirmó la recepción del pedido.'};
  function snapshot(){
    const values={};for(const field of ['nombre','ci','tel','municipio','localidad','dir','notas','vuelto'])values[field]=document.getElementById('check-'+field)?.value||'';
    values.moneda=document.getElementById('check-moneda-pago').value;
    values.pickup=document.getElementById('check-recogida').checked;
    values.assisted=Boolean(document.getElementById('assisted-sale-checkbox')?.checked);
    return {lines:cart.map(p=>({id:p.id,qty:p.qty,price:Number(p.precio_venta)})),form:values};
  }
  function text(message){const target=document.getElementById('pth-pending-message');if(target)target.textContent=message;}
  function lockReviewFields(locked){for(const input of form.querySelectorAll('input,select,textarea')){if(input.tagName==='SELECT'||['checkbox','radio'].includes(input.type)){if(locked){input.dataset.pthPendingDisabled=String(input.disabled);input.disabled=true;}else if(input.dataset.pthPendingDisabled!==undefined){input.disabled=input.dataset.pthPendingDisabled==='true';delete input.dataset.pthPendingDisabled;}}else input.readOnly=locked;}}
  function bindForm(row){
    const missing=row.lines.filter(p=>!productosRaw.some(product=>product.id===p.id));
    if(missing.length)throw Object.assign(Error('PRODUCT_UNAVAILABLE'),{code:'PRODUCT_UNAVAILABLE',safeMessage:'Un producto no está disponible. Revisa el pendiente.'});
    cart=row.lines.map(p=>{const product=productosRaw.find(product=>product.id===p.id);return {...product,qty:p.qty,precio_venta:p.price,comision_actual:Number(product.comision||0),comision_original_pool:Number(product.comision_original_pool||product.comision||0),shipping_linea:0};});
    newCartRevision=row.intentId||row.id;
    for(const field of ['nombre','ci','tel','dir','notas','vuelto'])document.getElementById('check-'+field).value=row.form[field];
    document.getElementById('check-moneda-pago').value=row.form.moneda;
    document.getElementById('check-recogida').checked=row.form.pickup;
    toggleRecogidaEnAlmacen();
    if(!row.form.pickup){
      if(!Object.keys(tarifasMensajeria).length)throw Object.assign(Error('Tariffs not loaded'),{code:'NETWORK_ERROR'});
      const municipality=document.getElementById('check-municipio');municipality.value=row.form.municipio;
      if(municipality.value!==row.form.municipio)throw Object.assign(Error('DELIVERY_UNAVAILABLE'),{code:'DELIVERY_UNAVAILABLE',safeMessage:'La zona de entrega necesita revisión.'});
      actualizarLocalidades();document.getElementById('check-localidad').value=row.form.localidad;
      document.getElementById('check-dir').value=row.form.dir;
      if(document.getElementById('check-localidad').value!==row.form.localidad)throw Object.assign(Error('DELIVERY_UNAVAILABLE'),{code:'DELIVERY_UNAVAILABLE',safeMessage:'La localidad de entrega necesita revisión.'});
    }
    const assisted=document.getElementById('assisted-sale-checkbox');if(assisted)assisted.checked=row.form.assisted;
    document.getElementById('cart-count').textContent=String(cart.reduce((sum,p)=>sum+p.qty,0));
    // Preserve the saved intent; normal draft saving must not replace it.
    renderCart();recalcularTotalFinal();
  }
  async function render(){
    const generation=++renderGeneration;
    const local=api.localOwner(storage),account=owner()&&owner()!==local?null:owner()||local;
    const button=document.getElementById('pth-queue-order');if(button)button.hidden=!account;
    if(!account){if(panel){panel.hidden=true;panel.replaceChildren();}return;}
    if(panel&&panel.dataset.owner!==account){panel.hidden=true;panel.replaceChildren();}
    let row;try{row=await queue.read(account);}catch(_){text('Este navegador no pudo abrir el almacenamiento. El pedido no está guardado.');return;}
    if(generation!==renderGeneration||api.localOwner(storage)!==account||owner()&&owner()!==account)return;
    if(reviewing&&(!row||row.id!==reviewing.id)){reviewing=null;lockReviewFields(false);}
    const submit=document.getElementById('final-submit-btn');
    if(submit&&!active){
      if(row?.form){submit.dataset.pthPendingLocked='true';submit.disabled=!reviewing;submit.innerText=reviewing?'Guardar revisión y enviar pendiente':'Confirma primero el pendiente';}
      else if(submit.dataset.pthPendingLocked){delete submit.dataset.pthPendingLocked;submit.disabled=false;submit.innerText='Confirmar Pedido';}
    }
    if(!panel){const grid=document.getElementById('productos-container');if(!grid)return;panel=document.createElement('aside');panel.id='pth-pending-order-panel';panel.className='pth-connectivity-card pth-pending-card';panel.style.margin='24px 0';grid.before(panel);}
    panel.replaceChildren();panel.dataset.owner=account;panel.hidden=!row;if(!row)return;
    const heading=document.createElement('h3');heading.textContent='Pedido pendiente en este dispositivo';
    const status=document.createElement('p');status.setAttribute('role','status');status.textContent=labels[row.state]||labels.blocked;
    const note=document.createElement('p');note.textContent=row.message|| (row.state==='confirmed'?row.receipts.map(p=>p.reference).join(', '):'Se envía con la web abierta y tu misma cuenta. Los datos del cliente se borran al confirmar recepción.');
    panel.append(heading,status,note);
    const review=document.createElement('a');review.href='/offline-order.html';review.textContent='Revisar o cancelar pendiente';review.className='pth-connectivity-action';panel.append(review);
    if(row.form&&row.state==='blocked'){
      const retry=document.createElement('button');retry.type='button';retry.textContent='Revisar pendiente';retry.onclick=async()=>{
        if(owner()!==account||api.localOwner(storage)!==account)return;
        bindForm(row);toggleCartModal(true);
        reviewing={id:row.id,owner:account,immutable:Boolean(row.outcome?.attempt)};lockReviewFields(reviewing.immutable);
        text(reviewing.immutable?'Revisa el total. Este intento ya tiene una clave de recibo: conserva los datos originales; para cambiar el cliente o los productos, detén los reintentos y comprueba primero la recepción.':'Corrige los datos o los productos y pulsa Guardar revisión y enviar pendiente cuando estés listo.');
        await render();
      };retry.className='pth-connectivity-action';panel.append(retry);
    }
  }
  async function tick(){
    if(busy||!owner()||api.localOwner(storage)!==owner()||navigator.onLine===false||!productosRaw.length)return;
    busy=true;const account=owner();
    try{
      await queue.run(account,async context=>{
        const expectedToken=PTHSecureData.token();
        if(owner()!==account||api.localOwner(storage)!==account||!window.PTHSecureData.token())throw Object.assign(Error('SESSION_CHANGED'),{code:'SESSION_CHANGED'});
        for(const attempt of context.row.priorAttempts||[]){
          const result=await PTHSecureData.checkout({operation:'receipt',attempt});if(result.error)throw result.error;
          if(owner()!==account||api.localOwner(storage)!==account||PTHSecureData.token()!==expectedToken)throw Object.assign(Error('SESSION_CHANGED'),{code:'SESSION_CHANGED'});
          if(result.data.confirmed.length)throw Object.assign(Error('Previous order received'),{code:'REVIEW',safeMessage:'El intento anterior fue recibido: '+result.data.confirmed.map(p=>p.reference).join(', ')+'. Este nuevo pendiente no se ha enviado. Revisa tus pedidos antes de continuar.'});
        }
        if(cart.length&&PTHLowConnectivity.fingerprint(cart)!==PTHLowConnectivity.fingerprint(context.row.lines))throw Object.assign(Error('Other cart open'),{code:'REVIEW',safeMessage:'Hay otro carrito abierto. Revisa el pendiente antes de sustituirlo.'});
        document.getElementById('cart-modal').inert=true;
        active=context;active.expectedToken=expectedToken;bindForm(context.row);await form.onsubmit({preventDefault(){}});
        if(context.row.state==='confirmed')return;
        if(active.failure)throw active.failure;
        const lines=snapshot().lines;
        await context.save({state:'blocked',lines,message:active.message||'Revisa el pedido antes de reintentar.',lease:null});
      });
    }catch(_){text('No se pudo guardar el estado del pendiente. Mantén la web abierta y vuelve a comprobar.');}
    finally{active=null;busy=false;document.getElementById('cart-modal').inert=false;await render();}
  }
  window.PTHPendingCheckoutUI={
    active:()=>active,
    cartLocked:()=>Boolean(active||reviewing?.immutable),
    localForm:()=>Boolean(active||reviewing||preparing),
    outcome:()=>active?.row.outcome||null,
    intent:()=>active?{intentId:active.row.intentId||active.row.id,savedAt:active.row.createdAt}:null,
    async markOutcome(value){if(active)await active.save({outcome:value});},
    async confirmed(receipts){if(active)await active.confirmed(receipts);},
    message(message){if(active){active.message=message;return true;}return false;},
    failure(error,message){if(active)active.failure=Object.assign(Error(error.code||'REVIEW'),{code:error.code||'REVIEW',safeMessage:message});},
    guard(){return Boolean(active&&(owner()!==active.row.owner||api.localOwner(storage)!==active.row.owner||PTHSecureData.token()!==active.expectedToken));},
    async catalogReady(){await render();await tick();},
    saveDeliveryZones(rows){try{storage.setItem('pth_pending_delivery_zones_v1',JSON.stringify({savedAt:Date.now(),zones:rows.map(p=>({municipio:String(p.municipio),localidad:String(p.localidad)}))}));}catch(_){}},
    render
  };
  const queueButton=document.createElement('button');queueButton.type='button';queueButton.id='pth-queue-order';queueButton.className='pth-connectivity-action';queueButton.textContent='Dejar pendiente de envío';queueButton.hidden=true;
  const help=document.createElement('p');help.className='pth-cart-draft-note';help.textContent='Puedes guardar un pedido por cuenta en este dispositivo. Se envía al recuperar conexión con la web abierta; con el navegador cerrado no se garantiza el envío. Los datos se borran al confirmar, cancelar o cerrar sesión. Si pasan 7 días, se borran al volver a abrir el pendiente.';
  const message=document.createElement('p');message.id='pth-pending-message';message.setAttribute('role','status');
  document.getElementById('final-submit-btn').before(queueButton,help,message);
  queueButton.onclick=async()=>{
    const local=api.localOwner(storage),account=owner()&&owner()!==local?null:owner()||local;
    if(!account){text('Vuelve a tu cuenta para guardar un pendiente.');return;}
    if(!form.reportValidity())return;
    queueButton.disabled=true;preparing=true;const token=PTHSecureData.token(),data=snapshot();
    try{await queue.save(account,data,lowConnectivity.readDraft(account));if(api.localOwner(storage)!==account||owner()&&owner()!==account||PTHSecureData.token()!==token)return;for(const field of ['nombre','ci','tel','dir','vuelto']){try{const key='autosave_check-'+field;if(storage.getItem(key)===data.form[field])storage.removeItem(key);}catch(_){}}try{clearAutoSave();}catch(_){}form.reset();text('Pedido guardado. Se enviará al recuperar conexión con esta web abierta.');toggleCartModal(false);await render();await tick();}
    catch(error){text(error.code==='EXISTS'?'Ya tienes un pendiente. Revísalo antes de preparar otro.':error.code==='INVALID'?'Completa los datos del cliente, la entrega y los productos.':'No se pudo guardar el pedido. No cierres esta pantalla; el pendiente no está preparado.');}
    finally{queueButton.disabled=false;preparing=false;}
  };
  form.addEventListener('submit',async event=>{
    if(!reviewing||active)return;
    event.preventDefault();event.stopImmediatePropagation();
    const review=reviewing,token=PTHSecureData.token();
    try{
      if(owner()!==review.owner||api.localOwner(storage)!==review.owner)return;
      const data=api.clean(snapshot()),row=await queue.read(review.owner);
      if(owner()!==review.owner||api.localOwner(storage)!==review.owner||PTHSecureData.token()!==token||row?.id!==review.id)return;
      await queue.revise(review.owner,review.id,data);
      if(owner()!==review.owner||api.localOwner(storage)!==review.owner||PTHSecureData.token()!==token)return;
      reviewing=null;lockReviewFields(false);await tick();
    }catch(error){text(error.code==='SIGNED_CHANGE'?'Este intento conserva los datos originales. Detén los reintentos y comprueba el recibo antes de cambiarlo.':'No se pudo guardar la revisión. El pendiente anterior se conserva.');}
  },true);
  window.addEventListener('pth:session-changed',event=>{
    const next=owner();if(lastOwner&&!next&&event.reason==='logout')void queue.logout(lastOwner).finally(render);
    reviewing=null;lockReviewFields(false);lastOwner=next;void render();if(next)void tick();
  });
  window.addEventListener('online',()=>void tick());
  window.addEventListener('storage',event=>{if(['pth_session','pth_secure_token'].includes(event.key)&&api.localOwner(storage)!==owner()){form.reset();if(panel){panel.hidden=true;panel.replaceChildren();}}});
  window.addEventListener('focus',()=>{void render();void tick();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){void render();void tick();}});
  setInterval(()=>{void render();void tick();},15000);
  void render();
})();
