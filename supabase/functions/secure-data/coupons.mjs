/* A code never authorizes a discount in the browser. All eligibility/quota
 * decisions belong to the service-only transaction in PostgreSQL. */
const fail=(code,message)=>{throw Object.assign(Error(message),{checkoutCode:code,status:code==='COUPON_UNAVAILABLE'?503:code==='COUPON_RATE_LIMIT'?429:400,publicCode:code});};
export function couponCode(value){
 if(typeof value!=='string')fail('COUPON_INVALID','Revisa el código de descuento.');
 const code=value.trim().toUpperCase();
 if(!/^[A-Z0-9-]{4,32}$/.test(code))fail('COUPON_INVALID','Revisa el código de descuento.');
 return code;
}
export function couponFailure(error){
 if(error?.code==='PT429')fail('COUPON_RATE_LIMIT','Espera un minuto antes de comprobar otro cupón. Tus datos se conservan.');
 if(['PT400','PT403','PT409'].includes(error?.code))fail('COUPON_INVALID','No se puede aplicar este cupón a este pedido. Revisa el código y las condiciones antes de confirmar.');
 fail('COUPON_UNAVAILABLE','No pudimos validar el cupón. Tus datos se conservan; no se ha enviado el pedido.');
}
export async function quoteCoupon(db,{code,rows,phone,rateKey}){
 const dataRows=rows.map(({_checkout_prices,_points_capture,...row})=>row);
 const result=await db.rpc('pth_coupon_quote',{p_code:code,p_phone:phone,p_rows:dataRows,p_rate_key:rateKey||null});
 if(result.error)couponFailure(result.error);
 const q=result.data;
 if(q?.error)couponFailure({code:q.sqlstate});
 if(!q||typeof q.id!=='string'||!Number.isSafeInteger(q.revision)||q.code!==code||!Number.isSafeInteger(q.subtotal_cents)||!Number.isSafeInteger(q.discount_cents)||q.discount_cents<=0||q.discount_cents>q.subtotal_cents||!Array.isArray(q.allocations)||q.allocations.length!==rows.length)couponFailure(null);
 let gross=0,discount=0;const providers=new Set();
 for(const a of q.allocations){
  const row=rows.find(x=>x.proveedor===a.proveedor);
  if(!row||providers.has(a.proveedor)||![a.gross_cents,a.discount_cents,a.net_cents].every(Number.isSafeInteger)||a.gross_cents!==Math.round((row.total-row.costo_mensajeria)*100)||a.discount_cents<0||a.net_cents<0||a.net_cents+a.discount_cents!==a.gross_cents)couponFailure(null);
  providers.add(a.proveedor);gross+=a.gross_cents;discount+=a.discount_cents;
 }
 if(gross!==q.subtotal_cents||discount!==q.discount_cents)couponFailure(null);
 return q;
}
export async function coupons(db,body,actor,enabled){
 if(body.operation==='settings')return {data:{enabled:enabled===true},error:null};
 if(!actor?.id||actor.estado!=='activo'||actor.activo===false||actor.parent_id||!['admin','administrador','superadmin'].includes(String(actor.rol).toLowerCase()))throw Object.assign(Error('Esta acción está reservada a administración.'),{status:403,publicCode:'COUPON_FORBIDDEN'});
 if(!['list','save'].includes(body.operation)||Object.keys(body).some(k=>!['action','operation','campaign'].includes(k)))fail('COUPON_INVALID','Operación de cupones no válida.');
 const campaign=body.campaign||{};
 if(!campaign||typeof campaign!=='object'||Array.isArray(campaign)||JSON.stringify(campaign).length>8000)fail('COUPON_INVALID','Revisa los datos del cupón.');
 const result=await db.rpc('pth_coupon_admin',{p_actor:actor.id,p_operation:body.operation,p_campaign:campaign});
 if(result.error)couponFailure(result.error);
 if(!result.data||typeof result.data!=='object')couponFailure(null);
 return {data:result.data,error:null};
}
