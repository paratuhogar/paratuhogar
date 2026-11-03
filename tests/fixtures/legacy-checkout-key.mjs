// Synthetic pre-server-clock capability. Never production signing material.
const secret='synthetic-only-signing-material-not-a-production-secret';
export async function legacyAttempt(f,issued=f.body.intentCreatedAt){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('pth-new-checkout-v1:'+secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sign=async text=>Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(text))).toString('hex');
 const b=f.body,fields=['gestor','subgestor_id','cliente','telefono','ci','direccion','municipio','proveedor','origen'];
 const payload={table:b.table,intentId:b.intentId,intentCreatedAt:b.intentCreatedAt,inputs:b.inputs.map(input=>({...Object.fromEntries(fields.filter(k=>Object.hasOwn(input,k)).map(k=>[k,input[k]])),_lineas:input._lineas})),delivery:b.delivery};
 const actor=await sign('actor:'+f.rows.gestores[0].id),nonce=await sign('nonce:'+actor+':'+b.table+':'+b.intentId);
 const prefix=['pthn1',issued,b.table==='pedidos'?'p':'s',b.inputs.length,nonce,actor,await sign('payload:'+nonce+':'+JSON.stringify(payload)),await sign('providers:'+JSON.stringify(b.inputs.map(r=>r.proveedor)))].join('.');
 return prefix+'.'+await sign(prefix);
}
