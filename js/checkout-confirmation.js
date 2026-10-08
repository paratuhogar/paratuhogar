/* Confirmed receipts survive form cleanup. Private messages stay in memory only. */
(function(root){
  'use strict';
  const key='pth_checkout_confirmations_v1',age=7*86400000;
  let entries=[],load=null,panel=null;
  const owner=()=>root.PTHSecureData.accountId?.()||'visitor';
  const token=()=>root.PTHSecureData.token();
  const valid=entry=>entry&&entry.owner===owner()&&['pedidos','pedidos_subgestores'].includes(entry.table)&&/^\d{8,15}$/.test(entry.phone||'')&&Array.isArray(entry.receipts)&&entry.receipts.length>0&&entry.receipts.length<=30&&entry.receipts.every(r=>typeof r.reference==='string'&&r.reference.length>0&&r.reference.length<=200)&&Number.isFinite(entry.savedAt)&&Date.now()-entry.savedAt>=0&&Date.now()-entry.savedAt<age;
  const inScope=entry=>entry.owner===owner()&&entry.token===token();
  function persist(){try{root.localStorage.setItem(key,JSON.stringify(entries.map(({owner,table,phone,receipts,savedAt})=>({owner,table,phone,receipts,savedAt}))));}catch(_) {}}
  function url(entry){return 'https://api.whatsapp.com/send?phone='+entry.phone+'&text='+encodeURIComponent(entry.message||'Pedido confirmado: '+entry.receipts.map(r=>'#'+r.reference).join(', ')+'. Por favor, revisa los detalles en la web.');}
  function render(){
    if(!entries.length){panel?.remove();panel=null;return;}
    if(!panel){const target=root.document.getElementById('sec-catalogo');if(!target)return;panel=root.document.createElement('aside');panel.id='pth-checkout-confirmations';panel.className='pth-connectivity-card';panel.style.margin='24px';panel.setAttribute('aria-label','Pedidos confirmados y envío por WhatsApp');target.before(panel);}
    panel.replaceChildren();
    for(const entry of entries){
      const section=root.document.createElement('section'),title=root.document.createElement('h3'),status=root.document.createElement('p'),button=root.document.createElement('button');
      title.textContent='Pedido recibido: '+entry.receipts.map(r=>'#'+r.reference).join(', ');
      status.textContent='Ya está guardado en la web. Abre WhatsApp y pulsa Enviar para comunicarlo. No necesitas repetir el pedido.';
      button.type='button';button.className='pth-connectivity-action';button.textContent='Enviar pedido por WhatsApp';
      button.onclick=()=>{
        if(!inScope(entry))return;
        if(entry.message||!load||entry.owner==='visitor'){root.open(url(entry),'_blank','noopener,noreferrer');return;}
        // A restored receipt needs a scoped read. The second, explicit click
        // opens WhatsApp synchronously so async popup restrictions cannot hide it.
        button.disabled=true;status.textContent='Recuperando el vale confirmado…';
        return Promise.resolve(load(entry)).then(message=>{
          if(!inScope(entry))return;
          if(!message)throw Error('RECEIPT_UNAVAILABLE');
          entry.message=message;button.textContent='Abrir WhatsApp';status.textContent='Vale listo. Pulsa Abrir WhatsApp y después Enviar.';
        }).catch(()=>{if(inScope(entry))status.textContent='No se pudo recuperar el vale. Reintenta con conexión o revísalo en Mi dashboard. No crees otro pedido.';}).finally(()=>{if(inScope(entry))button.disabled=false;});
      };
      section.append(title,status,button);panel.append(section);
    }
  }
  function restore(){
    let saved=[];try{saved=JSON.parse(root.localStorage.getItem(key)||'[]');}catch(_){}
    const signature=e=>e.table+'|'+e.receipts.map(r=>r.reference).join('|');
    const previous=new Map(entries.filter(e=>valid(e)&&inScope(e)).map(e=>[signature(e),e]));
    const restored=new Map((Array.isArray(saved)?saved:[]).filter(valid).map(e=>{
      const before=previous.get(signature(e));
      const entry=before||{owner:e.owner,table:e.table,phone:e.phone,receipts:e.receipts.map(r=>({reference:r.reference,proveedor:r.proveedor})),savedAt:e.savedAt,token:token(),message:null};
      return [signature(entry),entry];
    }));
    // A quota/read failure cannot erase an acknowledged in-memory receipt.
    for(const [id,entry] of previous)restored.set(id,entry);
    const next=[...restored.values()].sort((a,b)=>a.savedAt-b.savedAt).slice(-25);
    if(next.length===entries.length&&next.every((entry,i)=>entry===entries[i]))return;
    entries=next;render();
  }
  root.PTHCheckoutConfirmation={
    format(rows,{isSubgestor=false,isLogged=true,name='',phone=''}={}){
      return rows.map(row=>{
        const total=Number(row.total)||0,shipping=Number(row.costo_mensajeria)||0;
        let text='🧾 *PEDIDO CONFIRMADO #'+row.orden_dia+'*\n📅 Fecha: '+new Date(row.fecha||row.created_at).toLocaleDateString()+'\n\n';
        text+='👤 *CLIENTE*\nNombre: '+row.cliente+'\nTel: '+row.telefono+'\nDirección: '+(row.direccion||'')+'\n📍 Zona: '+(row.municipio||'')+'\n';
        if(row.ci&&row.ci!=='No especificado')text+='CI: '+row.ci+'\n';
        text+='\n🛒 *DETALLE*\n'+String(row.producto||'').split(' + ').map(p=>'📦 '+p).join('\n')+'\n\n💰 *TOTAL A PAGAR: $'+total+' USD*\n(Equipos: $'+(total-shipping)+' + Envío: $'+shipping+')\n';
        const payment=String(row.direccion||'').match(/\[PAGO:\s*([^\]]+)\]/i);if(payment)text+='💳 *MÉTODO PAGO:* '+payment[1]+'\n';
        if(isLogged){text+='\n👮‍♂️ *DATOS INTERNOS*\nComercial: '+(isSubgestor?name:row.gestor||name)+'\nComisión'+(isSubgestor?' asignada al subgestor':'')+': $'+(Number(isSubgestor?row.comision_subgestor:row.comision_total)||0)+'\nTel Comercial: '+phone+'\n';}
        return text;
      }).join('\n------------------------------------\n\n');
    },
    configure(options){load=options.load;restore();},restore,
    show(value){const entry={...value,savedAt:Date.now(),token:token()};if(!valid(entry))return;entries=entries.filter(e=>inScope(e)&&e.receipts.map(r=>r.reference).join('|')!==entry.receipts.map(r=>r.reference).join('|'));entries.push(entry);entries=entries.slice(-25);persist();render();},
    clear(){entries=[];try{root.localStorage.removeItem(key);}catch(_){}render();}
  };
  root.addEventListener('pth:session-changed',()=>root.PTHCheckoutConfirmation.clear());
  root.addEventListener('storage',()=>{entries=entries.filter(inScope);render();});
})(window);
