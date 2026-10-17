/* Confirmed receipts survive form cleanup. Private messages stay in memory only. */
(function(root){
  'use strict';
  const key='pth_checkout_confirmations_v1',age=7*86400000;
  let entries=[],load=null,panel=null;
  const owner=()=>root.PTHSecureData.accountId?.()||'visitor';
  const token=()=>root.PTHSecureData.token();
  const valid=(entry,account=owner())=>entry&&entry.owner===account&&['pedidos','pedidos_subgestores'].includes(entry.table)&&/^\d{8,15}$/.test(entry.phone||'')&&Array.isArray(entry.receipts)&&entry.receipts.length>0&&entry.receipts.length<=30&&entry.receipts.every(r=>typeof r.reference==='string'&&r.reference.length>0&&r.reference.length<=200)&&Number.isFinite(entry.savedAt)&&Date.now()-entry.savedAt>=0&&Date.now()-entry.savedAt<age;
  const inScope=entry=>entry.owner===owner()&&entry.token===token();
  const signature=e=>e.table+'|'+e.receipts.map(r=>r.reference).join('|');
  const actionable=entry=>inScope(entry)&&entries.at(-1)===entry&&!entry.dismissed;
  function retained(values){
    const current=values.filter(e=>valid(e)&&inScope(e)).sort((a,b)=>a.savedAt-b.savedAt);
    // Keep every minimal receipt within the existing seven-day retention.
    return current;
  }
  function persist(reopened){
    restore();
    // Only an explicit re-send may override a stored dismissal. Ordinary
    // repeated acknowledgments still merge the closed state across tabs.
    if(reopened&&valid(reopened)&&inScope(reopened)){reopened.dismissed=false;entries=retained([...entries.filter(e=>signature(e)!==signature(reopened)),reopened]);}
    try {
      const saved=JSON.parse(root.localStorage.getItem(key)||'[]');
      const others=(Array.isArray(saved)?saved:[]).filter(e=>e&&typeof e.owner==='string'&&e.owner!==owner()&&valid(e,e.owner));
      const minimal=[...others,...entries].map(({owner,table,phone,receipts,savedAt,dismissed})=>({owner,table,phone,receipts:receipts.map(({reference,proveedor})=>({reference,proveedor})),savedAt,dismissed:Boolean(dismissed)}));
      root.localStorage.setItem(key,JSON.stringify(minimal));
    } catch(_) {}
  }
  function url(entry){return 'https://api.whatsapp.com/send?phone='+entry.phone+'&text='+encodeURIComponent(entry.message||'Pedido confirmado: '+entry.receipts.map(r=>'#'+r.reference).join(', ')+'. Por favor, revisa los detalles en la web.');}
  function render(){
    // Select before dismissal: closing the latest must not reveal older notices.
    const visible=entries.slice(-1).filter(entry=>!entry.dismissed);
    if(!visible.length){panel?.remove();panel=null;return;}
    if(!panel){const target=root.document.getElementById('sec-catalogo');if(!target)return;panel=root.document.createElement('aside');panel.id='pth-checkout-confirmations';panel.className='pth-connectivity-card';panel.style.margin='24px';panel.setAttribute('aria-label','Pedidos confirmados y envío por WhatsApp');target.before(panel);}
    panel.replaceChildren();
    for(const entry of visible){
      const section=root.document.createElement('section'),title=root.document.createElement('h3'),status=root.document.createElement('p'),button=root.document.createElement('button'),close=root.document.createElement('button');
      title.textContent='Pedido recibido: '+entry.receipts.map(r=>'#'+r.reference).join(', ');
      status.textContent=entry.loading?'Recuperando el vale confirmado…':entry.recoveryFailed?'No se pudo recuperar el vale. Reintenta con conexión o revísalo en Mi dashboard. No crees otro pedido.':'Pedido guardado. Si ya lo enviaste por WhatsApp, puedes cerrar este aviso.';
      button.type='button';button.className='pth-connectivity-action';button.textContent='Enviar pedido por WhatsApp';
      button.disabled=Boolean(entry.loading);
      close.type='button';close.className='pth-connectivity-action';close.textContent='Cerrar';close.disabled=Boolean(entry.loading||entry.recoveryFailed);
      close.onclick=()=>{
        if(!actionable(entry)||entry.loading||entry.recoveryFailed)return;
        // Dismiss this notice only. Keep its receipt and every pending order;
        // opening WhatsApp is never evidence that a message was sent.
        entry.dismissed=true;persist();render();
      };
      button.onclick=()=>{
        if(!actionable(entry)||entry.loading)return;
        if(entry.message||!load||entry.owner==='visitor'){root.open(url(entry),'_blank','noopener,noreferrer');return;}
        // A restored receipt needs a scoped read. The second, explicit click
        // opens WhatsApp synchronously so async popup restrictions cannot hide it.
        entry.loading=true;entry.recoveryFailed=false;button.disabled=true;close.disabled=true;status.textContent='Recuperando el vale confirmado…';
        return new Promise(resolve=>resolve(load(entry))).then(message=>{
          if(!actionable(entry))return;
          if(!message)throw Error('RECEIPT_UNAVAILABLE');
          entry.message=message;button.textContent='Abrir WhatsApp';status.textContent='Vale listo. Pulsa Abrir WhatsApp y después Enviar.';
        }).catch(()=>{if(actionable(entry)){entry.recoveryFailed=true;status.textContent='No se pudo recuperar el vale. Reintenta con conexión o revísalo en Mi dashboard. No crees otro pedido.';}}).finally(()=>{entry.loading=false;if(actionable(entry)){button.disabled=false;close.disabled=Boolean(entry.recoveryFailed);render();}});
      };
      section.append(title,status,button,close);panel.append(section);
    }
  }
  function restore(){
    let saved=[];try{saved=JSON.parse(root.localStorage.getItem(key)||'[]');}catch(_){}
    let dismissalChanged=false;
    const previous=new Map(entries.filter(e=>valid(e)&&inScope(e)).map(e=>[signature(e),e]));
    const restored=new Map((Array.isArray(saved)?saved:[]).filter(e=>valid(e)).map(e=>{
      const before=previous.get(signature(e));
      if(before&&e.dismissed===true&&!before.dismissed){before.dismissed=true;dismissalChanged=true;}
      const entry=before||{owner:e.owner,table:e.table,phone:e.phone,receipts:e.receipts.map(r=>({reference:r.reference,proveedor:r.proveedor})),savedAt:e.savedAt,dismissed:e.dismissed===true,token:token(),message:null};
      return [signature(entry),entry];
    }));
    // A quota/read failure cannot erase an acknowledged in-memory receipt.
    for(const [id,entry] of previous)restored.set(id,entry);
    const next=retained([...restored.values()]);
    if(!dismissalChanged&&next.length===entries.length&&next.every((entry,i)=>entry===entries[i]))return;
    entries=next;render();
  }
  root.PTHCheckoutConfirmation={
    format(rows,{isSubgestor=false,isLogged=true,name='',phone='',commercialPhones={}}={}){
      return rows.map(row=>{
        const total=Number(row.total)||0,shipping=Number(row.costo_mensajeria)||0;
        let text='🧾 *PEDIDO CONFIRMADO #'+row.orden_dia+'*\n📅 Fecha: '+new Date(row.fecha||row.created_at).toLocaleDateString()+'\n\n';
        text+='👤 *CLIENTE*\nNombre: '+row.cliente+'\nTel: '+row.telefono+'\nDirección: '+(row.direccion||'')+'\n📍 Zona: '+(row.municipio||'')+'\n';
        if(row.ci&&row.ci!=='No especificado')text+='CI: '+row.ci+'\n';
        text+='\n🛒 *DETALLE*\n'+String(row.producto||'').split(' + ').map(p=>'📦 '+p).join('\n')+'\n\n💰 *TOTAL A PAGAR: $'+total+' USD*\n(Equipos: $'+(total-shipping)+' + Envío: $'+shipping+')\n';
        const payment=String(row.direccion||'').match(/\[PAGO:\s*([^\]]+)\]/i);if(payment)text+='💳 *MÉTODO PAGO:* '+payment[1]+'\n';
        if(isLogged){
          const commercial=isSubgestor?name:row.gestor||name;
          const commercialPhone=Object.prototype.hasOwnProperty.call(commercialPhones,commercial)?commercialPhones[commercial]:commercial===name?phone:'';
          text+='\n👮‍♂️ *DATOS INTERNOS*\nComercial: '+commercial+'\nComisión'+(isSubgestor?' asignada al subgestor':'')+': $'+(Number(isSubgestor?row.comision_subgestor:row.comision_total)||0)+'\nTel Comercial: '+(commercialPhone||'No disponible')+'\n';
        }
        return text;
      }).join('\n------------------------------------\n\n');
    },
    configure(options){load=options.load;restore();},restore,
    show(value,{reopen=false}={}){
      const entry={...value,savedAt:Date.now(),token:token(),dismissed:false};if(!valid(entry))return;
      restore();entries=entries.filter(inScope);
      if(entries.some(e=>signature(e)===signature(entry))&&!reopen)return;
      entries=entries.filter(e=>signature(e)!==signature(entry));entries.push(entry);entries=retained(entries);
      persist(reopen?entry:undefined);render();
    },
    clear(){entries=[];render();}
  };
  root.addEventListener('pth:session-changed',()=>root.PTHCheckoutConfirmation.clear());
  root.addEventListener('storage',restore);
})(window);
