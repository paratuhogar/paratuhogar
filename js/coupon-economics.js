(function(root){
 'use strict';
 const cents=v=>Math.round(Number(v)*100);
 function snapshot(row){
  if(!row?.cupon_codigo||row.subtotal_productos==null||row.descuento_productos==null)return null;
  const gross=cents(row.subtotal_productos),discount=cents(row.descuento_productos),shipping=cents(row.costo_mensajeria||0),net=cents(row.total);
  if(![gross,discount,shipping,net].every(Number.isSafeInteger)||gross<0||discount<0||discount>gross||shipping<0||net!==gross-discount+shipping)throw Error('El desglose del cupón no coincide con el total confirmado.');
  return {gross:gross/100,discount:discount/100,shipping:shipping/100,net:net/100,code:String(row.cupon_codigo)};
 }
 function message(row){const s=snapshot(row);return s?`Productos: $${s.gross.toFixed(2)} − Descuento (${s.code}): $${s.discount.toFixed(2)} + Envío: $${s.shipping.toFixed(2)}\n`:'';}
 root.PTHCouponEconomics={snapshot,message};
})(window);
