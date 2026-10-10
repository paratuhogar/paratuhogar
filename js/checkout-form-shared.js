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
  // Names are search terms, never identities. Only a current explicit choice can fill a form.
  function bindClients(doc,{clients=[],onChange=()=>{},confirmReplace=message=>doc.defaultView.confirm(message)}={}){
    const search=doc.getElementById('crm-search'),datalist=doc.getElementById('crm-datalist');
    if(!search||!datalist)return {update(){},select(){},destroy(){}};
    const choices=doc.createElement('div');choices.id='pth-crm-choices';choices.setAttribute('role','group');choices.setAttribute('aria-label','Clientes encontrados');
    choices.style.cssText='display:grid;gap:8px;margin-top:8px;max-height:240px;overflow:auto';
    const help=doc.createElement('p');help.id='pth-crm-help';help.setAttribute('aria-live','polite');help.style.cssText='font-size:12px;margin-top:8px';
    datalist.after(help,choices);search.setAttribute('aria-describedby',help.id);search.setAttribute('autocomplete','off');
    let rows=[],generation=0,destroyed=false,lastFill=null,handledInput=search.value;
    const fields=['nombre','ci','tel','dir'];
    const values=client=>({nombre:String(client.cliente||''),ci:String(client.ci||''),tel:String(client.telefono||''),dir:String(client.direccion||'')});
    const label=client=>String(client.cliente||'')+' | '+String(client.telefono||'');
    const key=client=>JSON.stringify(values(client));
    const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().trim();
    function choose(client,version){
      if(destroyed||version!==generation||!rows.some(row=>key(row)===key(client)))return false;
      const incoming=values(client),editable=fields.filter(field=>doc.getElementById(fieldIds[field])&&!doc.getElementById(fieldIds[field]).disabled);
      const edited=editable.some(field=>{const current=doc.getElementById(fieldIds[field]).value;return current!==incoming[field]&&(lastFill&&Object.hasOwn(lastFill,field)?current!==lastFill[field]:Boolean(current));});
      if(edited&&!confirmReplace('Ya hay datos editados en el formulario. ¿Sustituirlos por los de la clienta seleccionada?')){help.textContent='Se conservaron los datos editados. Puedes continuar manualmente o seleccionar de nuevo.';return false;}
      generation++;
      lastFill={};
      for(const field of editable){const input=doc.getElementById(fieldIds[field]);input.value=incoming[field];lastFill[field]=incoming[field];input.dispatchEvent(new doc.defaultView.Event('input',{bubbles:true}));}
      search.value=label(client);choices.replaceChildren();help.textContent='Clienta seleccionada. Revisa sus datos antes de continuar.';onChange();return true;
    }
    function render(){
      generation++;
      choices.replaceChildren();const text=normalize(search.value);
      if(!text){help.textContent='Escribe el nombre y elige una coincidencia con su teléfono. También puedes completar el formulario manualmente.';return;}
      const matches=rows.filter(client=>normalize(label(client)).includes(text));
      help.textContent=matches.length?'Elige la clienta por su teléfono y dirección; escribir un nombre no completa sus datos.':'No hay coincidencias en los clientes cargados. Puedes completar el formulario manualmente.';
      const version=generation;
      for(const client of matches.slice(0,10)){const button=doc.createElement('button');button.type='button';button.textContent=label(client)+(client.direccion?' — '+client.direccion:'');button.style.cssText='text-align:left;white-space:normal;overflow-wrap:anywhere;padding:10px;border:1px solid #818cf8;border-radius:8px;background:#fff;color:#312e81;min-height:44px';button.addEventListener('click',()=>choose(client,version));choices.append(button);}
      if(matches.length>10)help.textContent='Hay más de 10 coincidencias. Escribe más del nombre o teléfono para reducir la lista.';
    }
    function select(value){const matches=rows.filter(client=>label(client)===value);if(matches.length===1)return choose(matches[0],generation);render();return false;}
    const input=()=>{handledInput=search.value;if(!select(search.value))render();};
    const change=()=>{if(search.value===handledInput)return;handledInput=search.value;if(rows.filter(client=>label(client)===search.value).length===1)select(search.value);};
    search.addEventListener('input',input);search.addEventListener('change',change);
    function update(next){generation++;rows=[];const seen=new Set();for(const client of next||[]){if(!client||!client.telefono)continue;const id=key(client);if(seen.has(id))continue;seen.add(id);rows.push({...client});}datalist.replaceChildren();for(const client of rows){if(rows.filter(row=>label(row)===label(client)).length===1)datalist.append(option(doc,label(client),String(client.direccion||'')));}render();}
    update(clients);
    return {update,select,destroy(){destroyed=true;generation++;rows=[];lastFill=null;search.removeEventListener('input',input);search.removeEventListener('change',change);datalist.replaceChildren();choices.remove();help.remove();search.removeAttribute('aria-describedby');}};
  }
  function bind(doc,{tariffs=[],clients=[],onChange=()=>{}}={}){
    const map=tariffMap(tariffs),municipality=doc.getElementById('check-municipio'),locality=doc.getElementById('check-localidad'),pickup=doc.getElementById('check-recogida'),direction=doc.getElementById('check-dir');
    municipality.replaceChildren(option(doc,'','Seleccionar Municipio...'));for(const value of Object.keys(map))municipality.append(option(doc,value,value));
    const populateLocalities=()=>{const values=Object.keys(map[municipality.value]||{});locality.replaceChildren(option(doc,'',values.length?'Seleccionar Reparto...':'Elige municipio primero'));for(const value of values)locality.append(option(doc,value,value));locality.disabled=!values.length||pickup.checked;};
    const togglePickup=()=>{municipality.disabled=pickup.checked;municipality.required=!pickup.checked;locality.required=!pickup.checked;direction.disabled=pickup.checked;direction.required=!pickup.checked;if(pickup.checked){municipality.value='';locality.replaceChildren(option(doc,'','No aplica'));locality.disabled=true;direction.value='Recogida en Almacén';}else{if(direction.value==='Recogida en Almacén')direction.value='';populateLocalities();}onChange();};
    municipality.onchange=()=>{populateLocalities();onChange();};locality.onchange=onChange;pickup.onchange=togglePickup;
    const clientChoices=bindClients(doc,{clients,onChange});
    togglePickup();return {populateLocalities,togglePickup,read:()=>readForm(doc),map,clients:clientChoices,destroy(){clientChoices.destroy();municipality.onchange=null;locality.onchange=null;pickup.onchange=null;}};
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
  return {fieldIds,tariffMap,shipping,estimate,isWholesale,readForm,fillClient,bindClients,bind,parseClipboard};
});
