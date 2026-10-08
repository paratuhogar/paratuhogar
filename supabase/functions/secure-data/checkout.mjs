/* New checkout only. No UPDATE, legacy lookup, backfill or ownership inference. */
const ATTEMPT_AGE=7*86400000, QUOTE_AGE=120000;
const encode=value=>new TextEncoder().encode(String(value));
const hex=bytes=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
const unhex=value=>new Uint8Array(value.match(/../g).map(v=>parseInt(v,16)));
const fail=(code,message)=>{throw Object.assign(Error(message),{checkoutCode:code});};
const cents=value=>Math.round(Number(value)*100);
const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const customerPhone=value=>{const digits=String(value||'').replace(/\D/g,'');return digits.length===10&&digits.startsWith('53')?digits.slice(2):digits;};
const inputFields=['gestor','subgestor_id','cliente','telefono','ci','direccion','municipio','proveedor','origen'];
function clean(body){
  if(!['pedidos','pedidos_subgestores'].includes(body.table)||!Array.isArray(body.inputs)||!body.inputs.length||body.inputs.length>30)fail('CHECKOUT_INVALID','Revisa los productos del pedido.');
  const providers=new Set();
  const inputs=body.inputs.map(input=>{
    if(!input||input._approval_id||typeof input.proveedor!=='string'||!input.proveedor||providers.has(input.proveedor))fail('CHECKOUT_INVALID','Revisa los proveedores del pedido.');
    providers.add(input.proveedor);
    const row={};
    for(const field of inputFields)if(Object.hasOwn(input,field)){if(typeof input[field]==='string'&&input[field].length>5000)fail('CHECKOUT_INVALID','Revisa los datos del pedido.');row[field]=input[field];}
    if(['cliente','telefono','direccion','municipio'].some(field=>typeof row[field]!=='string'||!row[field].trim()))fail('CHECKOUT_INVALID','Completa nombre, teléfono y dirección.');
    if(!Array.isArray(input._lineas)||!input._lineas.length||input._lineas.length>100)fail('CHECKOUT_INVALID','Revisa los productos del pedido.');
    row._lineas=input._lineas.map(line=>{if(typeof line.producto_id!=='string'||!Number.isInteger(Number(line.cantidad))||Number(line.cantidad)<1||Number(line.cantidad)>10000)fail('CHECKOUT_INVALID','Revisa las cantidades.');return {producto_id:line.producto_id,cantidad:Number(line.cantidad)};});
    return row;
  });
  const d=body.delivery;
  if(inputs.reduce((sum,input)=>sum+input._lineas.length,0)>100)fail('CHECKOUT_INVALID','El pedido supera el límite de productos.');
  if(!d||typeof d.pickup!=='boolean'||typeof d.municipio!=='string'||typeof d.localidad!=='string'||d.municipio.length>200||d.localidad.length>200)fail('CHECKOUT_INVALID','Selecciona el lugar de entrega.');
  if(!/^[a-f0-9]{64}$/.test(body.intentId||'')||!Number.isFinite(body.intentCreatedAt))fail('CHECKOUT_INVALID','No se pudo verificar el borrador de este pedido.');
  return {table:body.table,intentId:body.intentId,intentCreatedAt:body.intentCreatedAt,inputs,delivery:{pickup:d.pickup,municipio:d.municipio,localidad:d.localidad}};
}
export function deliveryCost(products,lines,delivery,tariff){
  if(delivery.pickup)return 0;
  if(!tariff)fail('DELIVERY_UNAVAILABLE','No se pudo verificar la tarifa de esta localidad. Revisa la entrega.');
  const large=products.some(p=>p['tamaño_envio']==='Grande');
  let value=Number(large?tariff.precio_grande:tariff.precio_pequeno);
  const supplierA=products.some(p=>String(p.proveedor||'').toUpperCase()==='A'||String(p.proveedor||'').toUpperCase().includes('PROVEEDOR A'));
  if(supplierA&&!large){
    const vacuum=products.some(p=>String(p.nombre||'').toUpperCase().includes('ASPIRADORA'));
    value=vacuum&&['Plaza de la Revolución','Playa','Cotorro','Habana del Este'].includes(delivery.municipio)||['Cotorro','Habana del Este'].includes(delivery.municipio)?10:6;
  }
  if(lines.reduce((sum,line)=>sum+line.cantidad,0)>3)value*=1.5;
  if(!Number.isFinite(value)||value<0)fail('DELIVERY_UNAVAILABLE','La tarifa de entrega necesita revisión.');
  return cents(value)/100;
}
export function createCheckoutService({db,canonicalSale,signingSecret,now=Date.now}){
  let signingKey;
  const key=()=>signingKey||(signingKey=crypto.subtle.importKey('raw',encode('pth-new-checkout-v1:'+signingSecret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']));
  const sign=async value=>hex(await crypto.subtle.sign('HMAC',await key(),encode(value)));
  const verify=async(value,signature)=>/^[a-f0-9]{64}$/.test(signature||'')&&await crypto.subtle.verify('HMAC',await key(),unhex(signature),encode(value));
  async function parse(token){
    if(typeof token!=='string'||token.length>600)fail('ATTEMPT_INVALID','No se pudo verificar la clave del intento.');
    const parts=token.split('.');
    if(parts.length!==9||parts[0]!=='pthn1'||!/^\d{13}$/.test(parts[1])||!['p','s'].includes(parts[2])||!/^\d{1,2}$/.test(parts[3])||parts.slice(4,8).some(p=>!/^[a-f0-9]{64}$/.test(p))||!await verify(parts.slice(0,8).join('.'),parts[8]))fail('ATTEMPT_INVALID','No se pudo verificar la clave del intento.');
    const age=now()-Number(parts[1]);if(age<0||age>ATTEMPT_AGE)fail('ATTEMPT_EXPIRED','Este intento venció. Revisa si el pedido llegó antes de iniciar otro.');
    return {table:parts[2]==='p'?'pedidos':'pedidos_subgestores',count:Number(parts[3]),nonce:parts[4],actor:parts[5],payload:parts[6],providers:parts[7],issued:Number(parts[1])};
  }
  async function receipts(token,attempt){
    const table=attempt.table,dateField=table==='pedidos'?'fecha':'created_at';
    const result=await db.from(table).select('id,orden_dia,proveedor,'+dateField).eq('submission_token',token).gte(dateField,new Date(attempt.issued-1000).toISOString());
    if(result.error||!Array.isArray(result.data))fail('ORDER_OUTCOME_UNKNOWN','No se pudo comprobar la confirmación. Reintenta la consulta.');
    let found=result.data;
    // Approval may move a new child order into the existing principal table.
    // The exact signed key follows it; no name or historical ownership lookup.
    if(table==='pedidos_subgestores'&&found.length<attempt.count){
      const approved=await db.from('pedidos').select('id,orden_dia,proveedor,fecha').eq('submission_token',token).gte('fecha',new Date(attempt.issued-1000).toISOString());
      if(approved.error||!Array.isArray(approved.data))fail('ORDER_OUTCOME_UNKNOWN','No se pudo comprobar la confirmación. Reintenta la consulta.');
      found=[...found,...approved.data];
    }
    const confirmed=[...new Map(found.filter(row=>row.id).map(row=>[row.proveedor,{proveedor:row.proveedor,reference:row.orden_dia||row.id}])).values()];
    return {confirmed,complete:new Set(confirmed.map(row=>row.proveedor)).size===attempt.count};
  }
  async function canonical(payload,actor,token,confirmed=[]){
    const allLines=payload.inputs.flatMap(row=>row._lineas),ids=[...new Set(allLines.map(line=>line.producto_id))];
    const productsResult=await db.from('productos').select('*').in('id',ids);
    if(productsResult.error||!Array.isArray(productsResult.data)||productsResult.data.length!==ids.length)fail('PRODUCT_UNAVAILABLE','No se pudieron comprobar los productos.');
    const products=productsResult.data;
    if(products.some(p=>p.disponible!=='SI'))fail('PRODUCT_UNAVAILABLE','Un producto dejó de estar disponible. Revisa el carrito.');
    let tariff;
    if(!payload.delivery.pickup){
      const result=await db.from('tarifas_mensajeria').select('precio_pequeno,precio_grande').eq('municipio',payload.delivery.municipio).eq('localidad',payload.delivery.localidad).maybeSingle();
      if(result.error||!result.data)fail('DELIVERY_UNAVAILABLE','No se pudo verificar una tarifa única para la localidad. Revisa la entrega.');tariff=result.data;
    }
    const shipping=deliveryCost(products,allLines,payload.delivery,tariff),rows=[];
    for(let index=0;index<payload.inputs.length;index++){
      const input=payload.inputs[index];if(confirmed.some(row=>row.proveedor===input.proveedor))continue;
      if(payload.delivery.pickup&&(input.municipio!=='Almacén'||!String(input.direccion).startsWith('Recogida presencial en almacén')))fail('CHECKOUT_INVALID','Revisa la recogida en almacén.');
      if(!payload.delivery.pickup&&(input.municipio!==payload.delivery.municipio||!String(input.direccion).includes('('+payload.delivery.localidad+')')))fail('CHECKOUT_INVALID','Revisa la dirección de entrega.');
      const lineProducts=input._lineas.map(line=>products.find(p=>p.id===line.producto_id));
      if(lineProducts.some(p=>p.proveedor!==input.proveedor))fail('PRODUCT_UNAVAILABLE','Revisa los proveedores del carrito.');
      const guarantee=lineProducts.map(p=>({nombre:p.nombre,garantia:String(p.garantia||'').trim()}));
      if(guarantee.some(p=>!p.garantia))fail('PRODUCT_UNAVAILABLE','Falta la garantía de un producto. Revisa el carrito.');
      const row=await canonicalSale(db,payload.table,{...input,costo_mensajeria:index===0?shipping:0,submission_token:token},actor,true);
      row.garantia_venta=guarantee.map(p=>`${p.nombre}: ${p.garantia}`).join(' | ');
      for(const price of row._checkout_prices||[])price.garantia=products.find(p=>p.id===price.id)?.garantia;
      const unique=[...new Set(guarantee.map(p=>p.garantia))];
      const warranty=unique.length===1?unique[0].toLowerCase():'';
      const number=Number((warranty.match(/\d+(?:[.,]\d+)?/)||['0'])[0].replace(',','.'));
      const unit=warranty.includes('año')?365:warranty.includes('mes')?30:warranty.includes('semana')?7:warranty.includes('día')||warranty.includes('dia')?1:0;
      row.garantia_dias=number&&unit?Math.round(number*unit):null;
      rows.push(row);
    }
    return rows;
  }
  const terms=rows=>rows.map(row=>({proveedor:row.proveedor,total:row.total,costo_mensajeria:row.costo_mensajeria,producto:row.producto,garantia_venta:row.garantia_venta,garantia_dias:row.garantia_dias??null,prices:row._checkout_prices||[]}));
  async function recentDuplicates(rows,actor){
    // Only this signed-in seller's recent orders. No public lookup, name-based
    // ownership expansion, customer records, or commission data in the reply.
    if(!actor?.id)return [];
    const child=Boolean(actor.parent_id),since=new Date(now()-86400000).toISOString(),found=[],actorTag=await sign('actor:'+actor.id);
    for(const table of child?['pedidos_subgestores','pedidos']:['pedidos']){
      const date=table==='pedidos'?'fecha':'created_at';
      let query=db.from(table).select('id,orden_dia,proveedor,cliente,telefono,ci,producto,total,estado,subgestor_nombre,submission_token,'+date)
        .gte(date,since);
      query=child?query.eq(table==='pedidos'?'subgestor_nombre':'subgestor_id',table==='pedidos'?actor.nombre:actor.id):query.eq('gestor',actor.nombre);
      if(child&&table==='pedidos')query=query.eq('gestor',actor.parent_nombre);
      const result=await query.order(date,{ascending:false}).limit(201);
      if(result.error||!Array.isArray(result.data)||result.data.length>200)fail('DUPLICATE_CHECK_UNAVAILABLE','No pudimos comprobar posibles pedidos repetidos. Tus datos se conservan; reintenta la comprobación.');
      for(const candidate of result.data){
        if(normalized(candidate.estado)==='cancelado'||!child&&candidate.subgestor_nombre)continue;
        // A name is only a query prefilter. The signed checkout initiator ID
        // must match, including approved children and same-named siblings.
        let prior;try{prior=await parse(candidate.submission_token);}catch(_){continue;}
        if(prior.actor!==actorTag)continue;
        const match=rows.some(row=>{
          const phone=customerPhone(row.telefono),ci=String(row.ci||'').replace(/\D/g,'');
          const sameCustomer=phone.length>=8&&phone===customerPhone(candidate.telefono)||ci.length>=6&&ci===String(candidate.ci||'').replace(/\D/g,'');
          return sameCustomer&&normalized(row.cliente)===normalized(candidate.cliente)&&row.proveedor===candidate.proveedor&&normalized(row.producto)===normalized(candidate.producto)&&cents(row.total)===cents(candidate.total);
        });
        if(match)found.push({reference:candidate.orden_dia||candidate.id,proveedor:candidate.proveedor});
      }
    }
    return [...new Map(found.map(row=>[row.reference,row])).values()].sort((a,b)=>a.reference.localeCompare(b.reference));
  }
  async function duplicateProof(token,duplicates){
    const prefix=['pthd1',now(),await sign('duplicates:'+JSON.stringify(duplicates)),await sign('attempt:'+token)].join('.');
    return prefix+'.'+await sign(prefix);
  }
  async function reviewedDuplicates(proof,token,duplicates){
    const parts=String(proof||'').split('.');
    return parts.length===5&&parts[0]==='pthd1'&&/^\d{13}$/.test(parts[1])&&now()-Number(parts[1])>=0&&now()-Number(parts[1])<=ATTEMPT_AGE&&parts[2]===await sign('duplicates:'+JSON.stringify(duplicates))&&parts[3]===await sign('attempt:'+token)&&await verify(parts.slice(0,4).join('.'),parts[4]);
  }
  return async function checkout(body,actor){
    try{
      if(!signingSecret)fail('CHECKOUT_UNAVAILABLE','La confirmación de pedidos nuevos no está disponible.');
      if(body.operation==='receipt'){
        const attempt=await parse(body.attempt);return {data:await receipts(body.attempt,attempt),error:null};
      }
      if(!['quote','submit'].includes(body.operation))fail('CHECKOUT_INVALID','Operación de pedido no válida.');
      if(actor?.rol==='mensajero')fail('CHECKOUT_INVALID','Esta cuenta no puede iniciar pedidos.');
      const payload=clean(body),actorTag=await sign('actor:'+String(actor?.id||'public'));
      let token=body.attempt,attempt;
      if(token){
        attempt=await parse(token);
        if(attempt.actor!==actorTag)fail('SESSION_CHANGED','Vuelve a la cuenta que inició este pedido. Puedes comprobar el recibo sin sesión.');
        if(attempt.table!==payload.table||attempt.payload!==await sign('payload:'+attempt.nonce+':'+JSON.stringify(payload)))fail('PAYLOAD_CHANGED','Los datos del intento cambiaron. Comprueba primero el recibo antes de iniciar otro pedido.');
      }else{
        if(body.operation!=='quote')fail('ATTEMPT_INVALID','Primero comprueba las condiciones del pedido.');
        const age=now()-payload.intentCreatedAt;if(age<0||age>ATTEMPT_AGE)fail('ATTEMPT_EXPIRED','El borrador venció. Revisa tus pedidos antes de iniciar otro.');
        // Same random draft intent across tabs produces the same attempt. The
        // payload MAC binds customer/products/delivery without storing them.
        const nonce=await sign('nonce:'+actorTag+':'+payload.table+':'+payload.intentId),issued=payload.intentCreatedAt;
        const prefix=['pthn1',issued,payload.table==='pedidos'?'p':'s',payload.inputs.length,nonce,actorTag,await sign('payload:'+nonce+':'+JSON.stringify(payload)),await sign('providers:'+JSON.stringify(payload.inputs.map(row=>row.proveedor)))].join('.');
        token=prefix+'.'+await sign(prefix);attempt=await parse(token);
      }
      const existing=await receipts(token,attempt);
      if(existing.complete)return {data:{...existing,attempt:token},error:null};
      if(existing.confirmed.length)fail('ORDER_OUTCOME_UNKNOWN','Hay una confirmación parcial que necesita revisión. No se reescribirá ningún pedido aceptado.');
      const rows=await canonical(payload,actor,token,existing.confirmed),currentTerms=terms(rows);
      const duplicates=await recentDuplicates(rows,actor);
      const stamp=now(),digest=await sign('terms:'+JSON.stringify(currentTerms));
      if(body.operation==='quote'){
        const prefix=['pthq1',stamp,digest,await sign('attempt:'+token)].join('.');
        return {data:{attempt:token,quote:prefix+'.'+await sign(prefix),terms:currentTerms,duplicates,duplicateReview:duplicates.length?await duplicateProof(token,duplicates):null,...existing},error:null};
      }
      const proof=String(body.quote||'').split('.');
      if(proof.length!==5||proof[0]!=='pthq1'||!/^\d{13}$/.test(proof[1])||now()-Number(proof[1])<0||now()-Number(proof[1])>QUOTE_AGE||proof[2]!==digest||proof[3]!==await sign('attempt:'+token)||!await verify(proof.slice(0,4).join('.'),proof[4]))fail('CONDITIONS_CHANGED','Cambió el precio, la disponibilidad o la entrega. Comprueba el carrito y confirma nuevamente.');
      if(duplicates.length&&!await reviewedDuplicates(body.duplicateReview,token,duplicates))fail('POSSIBLE_DUPLICATE','Hay un pedido reciente parecido: '+duplicates.map(row=>row.reference).join(', ')+'. Revisa si ya se recibió antes de confirmar una compra distinta.');
      const originals=new Map(body.inputs.map(input=>[input.proveedor,input]));
      for(const [index,row] of rows.entries()){const reference=originals.get(row.proveedor)?.orden_dia;if(typeof reference!=='string'||!reference||reference.length>100)fail('CHECKOUT_INVALID','No se pudo verificar la referencia del pedido.');row.orden_dia=reference;
        delete row._checkout_prices;
        // A deterministic new-row PK also fences a changed-payload race for
        // one draft intent. A collision never updates or reveals another row.
        const id=await sign('row-id:'+attempt.nonce+':'+(index===0?'anchor':'provider:'+row.proveedor));row.id=`${id.slice(0,8)}-${id.slice(8,12)}-4${id.slice(13,16)}-a${id.slice(17,20)}-${id.slice(20,32)}`;
      }
      // One multi-row INSERT is atomic. Existing (token,provider) uniqueness
      // resolves competing retries; accepted rows are never updated/upserted.
      const inserted=await db.from(payload.table).insert(rows).select('id,orden_dia,proveedor');
      if(inserted.error&&inserted.error.code!=='23505')fail('ORDER_OUTCOME_UNKNOWN','Se perdió la confirmación. Comprueba el recibo antes de reintentar.');
      const result=await receipts(token,attempt);
      if(!result.complete)fail('ORDER_OUTCOME_UNKNOWN','Aún no se confirmó todo el pedido. Comprueba el recibo antes de reintentar.');
      return {data:{...result,attempt:token},error:null};
    }catch(error){return {data:null,error:{code:error.checkoutCode||'CHECKOUT_UNAVAILABLE',message:error.checkoutCode?error.message:'No se pudo validar este pedido nuevo. Reintenta la comprobación.'}};}
  };
}
