/* Shared checkout display rules. The server still validates every order. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PTHCheckoutForm=api;})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const fieldIds={nombre:'check-nombre',ci:'check-ci',tel:'check-tel',municipio:'check-municipio',localidad:'check-localidad',dir:'check-dir',notas:'check-notas',moneda:'check-moneda-pago',vuelto:'check-vuelto'};
  function tariffMap(rows){
    const map=Object.create(null);
    for(const row of rows||[]){
      if(!row||typeof row.municipio!=='string'||typeof row.localidad!=='string')continue;
      const pq=Number(row.precio_pequeno??row.pq),gr=Number(row.precio_grande??row.gr);
      if(!Number.isFinite(pq)||pq<0||!Number.isFinite(gr)||gr<0)continue;
      if(!map[row.municipio])map[row.municipio]=Object.create(null);
      map[row.municipio][row.localidad]={pq,gr};
    }
    return map;
  }
  function shipping({lines=[],municipio='',localidad='',pickup=false,tariffs=[]}={}){
    if(pickup)return 0;
    if(!municipio||!localidad)return null;
    const map=Array.isArray(tariffs)?tariffMap(tariffs):tariffs;
    const tariff=map?.[municipio]?.[localidad];if(!tariff)return null;
    const large=lines.some(item=>item.tamaño_envio==='Grande');
    let cost=Number(large?tariff.gr:tariff.pq);if(!Number.isFinite(cost)||cost<0)return null;
    const providerA=lines.some(item=>{const provider=String(item.proveedor||'').toUpperCase();return provider==='A'||provider.includes('PROVEEDOR A');});
    if(providerA&&!large){
      const vacuum=lines.some(item=>String(item.nombre||'').toUpperCase().includes('ASPIRADORA'));
      const far=['Plaza de la Revolución','Playa','Cotorro','Habana del Este'];
      cost=vacuum&&far.includes(municipio)||municipio==='Cotorro'||municipio==='Habana del Este'?10:6;
    }
    if(lines.reduce((sum,item)=>sum+Number(item.qty),0)>3)cost*=1.5;
    return cost;
  }
  const isWholesale=item=>['MAYORISTA','B2B','MIPYME'].some(term=>String(item?.categoria||'').toUpperCase().includes(term));
  function estimate(input={}){
    const equipment=(input.lines||[]).reduce((sum,item)=>sum+Number(item.precio_venta??item.price??item.precio)*Number(item.qty),0);
    const delivery=shipping(input);
    return {equipment:Number.isFinite(equipment)?equipment:null,shipping:delivery,total:Number.isFinite(equipment)&&delivery!==null?equipment+delivery:null};
  }
  function readForm(doc){const result={};for(const [field,id]of Object.entries(fieldIds))result[field]=doc.getElementById(id)?.value||'';result.pickup=doc.getElementById('check-recogida')?.checked===true;result.assisted=doc.getElementById('assisted-sale-checkbox')?.checked===true;return result;}
  function fillClient(doc,client){if(!client)return;for(const [field,value]of Object.entries({nombre:client.cliente,ci:client.ci,tel:client.telefono,dir:client.direccion}))if(doc.getElementById(fieldIds[field]))doc.getElementById(fieldIds[field]).value=String(value||'');}
  function option(doc,value,label){const node=doc.createElement('option');node.value=value;node.textContent=label;return node;}
  function bind(doc,{tariffs=[],clients=[],onChange=()=>{}}={}){
    const map=tariffMap(tariffs),municipality=doc.getElementById('check-municipio'),locality=doc.getElementById('check-localidad'),pickup=doc.getElementById('check-recogida'),direction=doc.getElementById('check-dir');
    municipality.replaceChildren(option(doc,'','Seleccionar Municipio...'));for(const value of Object.keys(map))municipality.append(option(doc,value,value));
    const populateLocalities=()=>{const values=Object.keys(map[municipality.value]||{});locality.replaceChildren(option(doc,'',values.length?'Seleccionar Reparto...':'Elige municipio primero'));for(const value of values)locality.append(option(doc,value,value));locality.disabled=!values.length||pickup.checked;};
    const togglePickup=()=>{municipality.disabled=pickup.checked;municipality.required=!pickup.checked;locality.required=!pickup.checked;direction.disabled=pickup.checked;direction.required=!pickup.checked;if(pickup.checked){municipality.value='';locality.replaceChildren(option(doc,'','No aplica'));locality.disabled=true;direction.value='Recogida en Almacén';}else{if(direction.value==='Recogida en Almacén')direction.value='';populateLocalities();}onChange();};
    municipality.onchange=()=>{populateLocalities();onChange();};locality.onchange=onChange;pickup.onchange=togglePickup;
    const datalist=doc.getElementById('crm-datalist');datalist.replaceChildren();const choices=new Map();
    for(const client of clients){const value=String(client.cliente||'')+' | '+String(client.telefono||'');if(choices.has(value))continue;choices.set(value,client);datalist.append(option(doc,value,value));}
    doc.getElementById('crm-search').onchange=event=>{fillClient(doc,choices.get(event.target.value));onChange();};
    togglePickup();return {populateLocalities,togglePickup,read:()=>readForm(doc),map,destroy(){choices.clear();municipality.onchange=null;locality.onchange=null;pickup.onchange=null;doc.getElementById('crm-search').onchange=null;}};
  }
  // Same plain-text extraction as the existing manual paste tool.
  function parseClipboard(value){
    let raw=String(value||'').slice(0,12000).replace(/(Nombre|Nom|Cliente|Dirección|Dir|Direccion|Teléfono|Telefono|Telf|Cel|Móvil|WhatsApp|CI|Carnet|Id):?/gi,' ').replace(/\t/g,' ').trim();
    const ci=raw.match(/\b\d{11}\b/)?.[0]||'';if(ci)raw=raw.replace(ci,' ');
    const match=raw.match(/(?:\+?53)?\s*[.\-]?\s*(5[\d\s\-.]{7,15})/);let tel='';if(match){let digits=match[0].replace(/\D/g,'');if(digits.length===10&&digits.startsWith('53'))digits=digits.substring(2);if(digits.length===8&&digits.startsWith('5')){tel=digits;raw=raw.replace(match[0],' ');}}
    const cleaned=raw.replace(/\r\n|\n|\r/g,' , ').replace(/\s+/g,' ').trim(),lower=cleaned.toLowerCase();
    let split=-1;for(const word of ['calle','ave','avenida','av.','entre','esq','esquina','pto','reparto','rpto','edif','edificio','apto','apartamento','carretera','finca','zona','municipio','provincia','habana','bajos','altos','km','no.','número','#']){const i=lower.includes(word+' ')?lower.indexOf(word+' '):lower.indexOf(' '+word);if(i>=3){split=i;break;}}
    let nombre='',dir='';if(split>=0){nombre=cleaned.substring(0,split);dir=cleaned.substring(split);}else if(cleaned.includes(',')){const parts=cleaned.split(',').sort((a,b)=>a.length-b.length);nombre=parts[0];dir=parts.slice(1).join(', ');}else nombre=cleaned;
    const trim=part=>part.replace(/^[\s,.-]+|[\s,.-]+$/g,'').trim();return {nombre:trim(nombre).replace(/\w\S*/g,w=>w.charAt(0).toUpperCase()+w.substring(1).toLowerCase()),ci,tel,dir:trim(dir)};
  }
  return {fieldIds,tariffMap,shipping,estimate,isWholesale,readForm,fillClient,bind,parseClipboard};
});
