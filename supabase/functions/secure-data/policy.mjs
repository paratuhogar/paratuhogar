export const PROTECTED_TABLES = new Set(['productos','gestores','pedidos','pedidos_subgestores','precios_personalizados','inventario_eventos','caja_gestores','solicitudes_cobro','solicitudes_cobro_detalle','solicitudes_cobro_adelantos','configuracion_equipo','mensajeros']);
export const MY_RPCS = new Set(['mis_solicitudes_cobro','mis_pedidos_solicitudes_cobro','solicitar_cobro_comision','solicitar_cobro_comision_pedidos']);
export const ADMIN_RPCS = new Set(['es_admin_boveda','listar_deuda_sistema','resumen_deuda_sistema','listar_pedidos_boveda','liquidar_deuda_sistema','listar_solicitudes_cobro_beatriz','registrar_adelanto_solicitud_cobro','gestionar_solicitud_cobro_beatriz','archivar_solicitudes_pagadas_beatriz','listar_adelantos_solicitudes_nomina','listar_historial_pagos_gestores','listar_historial_solicitudes_cobro_beatriz','aplicar_inactividad_gestores','owner_statistics_orders','owner_statistics_orders_v2','owner_statistics_products','owner_statistics_traffic','owner_statistics_views']);
export const OWNER_IDS = new Set(['38f20b63-a845-4a03-8d10-9a57da2ac2c4','6193f310-1e3f-4404-b874-977d0e23a6a0']);
export function actorKind(actor) {
  if (!actor) return 'public';
  if (actor.parent_id) return 'subgestor';
  if(actor.rol==='mensajero')return 'mensajero';
  if (['admin','administrador','superadmin','logistica'].includes(String(actor.rol).toLowerCase())) return 'admin';
  return 'gestor';
}
export function scopeFor(table,actor,operation,payload={}) {
  if (!PROTECTED_TABLES.has(table)) throw Error('Operación no permitida.');
  const kind=actorKind(actor);
  if(kind==='admin') return [];
  if(kind==='mensajero'){
    if(table==='pedidos'&&operation==='select')return [['eq','mensajero_id',actor.id]];
    if(table==='pedidos'&&operation==='update'&&Object.keys(payload).every(key=>['estado','fecha_entrega'].includes(key))&&payload.estado==='Entregado')return [['eq','mensajero_id',actor.id]];
    throw Error('Operación no permitida para mensajería.');
  }
  if(operation==='select') {
    if(['productos','gestores','inventario_eventos'].includes(table)) return [];
    if(table==='precios_personalizados') return kind==='subgestor' ? [['eq','gestor',actor.parent_nombre]] : kind==='gestor' ? [['eq','gestor',actor.nombre]] : [];
    if(table==='pedidos'&&actor) return [['eq',kind==='subgestor'?'subgestor_nombre':'gestor',actor.nombre]];
    if(table==='pedidos_subgestores'&&actor) return [['eq',kind==='subgestor'?'subgestor_id':'parent_gestor_id',actor.id]];
    if(table==='solicitudes_cobro'&&actor) return [['eq','gestor_id',actor.id]];
    throw Error('No tienes permiso para consultar estos datos.');
  }
  if(table==='gestores'&&operation==='insert') return [];
  if(table==='pedidos'||table==='pedidos_subgestores') {
    if(operation==='insert') return [];
    if(!actor) throw Error('Inicia sesión para modificar el pedido.');
    if(table==='pedidos_subgestores'&&kind==='gestor'&&['update','delete'].includes(operation)) {
      const allowed=new Set(['cliente','telefono','ci','direccion','municipio']);
      if(Object.keys(payload).some(key=>!allowed.has(key))) throw Error('No puedes cambiar la comisión del pedido pendiente.');
      return [['eq','parent_gestor_id',actor.id]];
    }
    if(table==='pedidos'&&operation==='update') {
      const allowed=new Set(['cliente','telefono','ci','direccion','municipio','estado']);
      if(kind==='gestor') allowed.add('pago_subgestor');
      if(Object.keys(payload).some(key=>!allowed.has(key))) throw Error('No tienes permiso para modificar importes o comisiones.');
      if(payload.estado&&payload.estado!=='Cancelado') throw Error('No tienes permiso para cambiar el estado logístico.');
      return [['eq',kind==='subgestor'?'subgestor_nombre':'gestor',actor.nombre]];
    }
  }
  if(table==='precios_personalizados'&&kind==='gestor') return [['eq','gestor',actor.nombre]];
  if(table==='gestores'&&kind==='gestor') {
    const allowed=new Set(['estado','password','nombre','email','telefono','comision_sub_pct']);
    if(Object.keys(payload).some(key=>!allowed.has(key))) throw Error('No tienes permiso para cambiar roles o jerarquías.');
    return [['eq','parent_id',actor.id]];
  }
  throw Error('No tienes permiso para realizar esta operación.');
}
export function projectRow(table,source,actor,assigned=new Map()) {
  const kind=actorKind(actor);
  const row={...source};
  if(table==='gestores'){delete row.application_token;if(kind!=='admin')delete row.questionnaire;}
  if(kind==='mensajero'){
    for(const key of Object.keys(row))if(/comision|pago_gestor|pago_subgestor|pago_sistema|estado_financiero|costo_proveedor/i.test(key))delete row[key];
    return row;
  }
  if(table==='gestores') {
    if(kind==='admin') {if(row.id===actor.id)row.password='__session__';return row;}
    const isOwn=actor?.id===row.id;
    const isChild=kind==='gestor'&&row.parent_id===actor.id;
    if(isOwn) row.password='__session__';
    else if(!isChild) {
      for(const key of Object.keys(row)) if(!['id','nombre','nombre_publico','telefono','estado','parent_id','created_at'].includes(key)) delete row[key];
    }
    return row;
  }
  if(table==='productos') {
    if(kind==='admin') return row;
    delete row.costo_proveedor;
    if(kind==='subgestor') {
      const price=assigned.get(row.id);row.comision=Number(price?.comision_subgestor)||0;
      if(row.precio_flexible==='SI'&&Number(price?.nuevo_precio)>=Number(row.precio))row.precio=Number(price.nuevo_precio);
    }
    if(kind==='public') row.comision=0;
  }
  if(table==='precios_personalizados'&&kind==='public') row.comision_subgestor=0;
  if(['pedidos','pedidos_subgestores'].includes(table)&&kind==='subgestor') {
    row.comision_total=Number(row.comision_subgestor)||0;
    if(table==='pedidos') row.pago_gestor=row.pago_subgestor;
    delete row.comision_parent;
    delete row.costo_proveedor;
    delete row.estado_financiero;
    delete row.pago_gestor_en;
  }
  if(['pedidos','pedidos_subgestores'].includes(table)&&kind==='public') {
    for(const key of Object.keys(row)) if(key.startsWith('comision')||key.startsWith('pago_')||key==='estado_financiero') delete row[key];
  }
  if(table==='inventario_eventos'&&kind!=='admin') {
    if(kind==='public'||(kind==='subgestor'&&String(row.tipo).toLowerCase().includes('comision'))) return null;
    if(row.datos_producto) {
      row.datos_producto={...row.datos_producto};
      delete row.datos_producto.costo_proveedor;
      if(kind==='subgestor') delete row.datos_producto.comision;
    }
  }
  return row;
}
const cents=value=>Math.round(Number(value)*100);
export function calculateSale(lines,products,prices,isSubgestor) {
  if(!Array.isArray(lines)||!lines.length||lines.length>100) throw Error('Faltan los equipos del pedido.');
  let equipment=0,totalCommission=0,subCommission=0;
  const detail=[];
  for(const line of lines) {
    const qty=Number(line.cantidad);
    const product=products.find(p=>p.id===line.producto_id);
    if(!product||!Number.isInteger(qty)||qty<1||qty>10000) throw Error('Equipo o cantidad no válidos.');
    const price=prices.find(p=>p.producto_id===product.id);
    if(isSubgestor&&price?.visible_subgestor===false) throw Error('El equipo no está disponible para el subgestor.');
    const base=cents(product.precio);
    const custom=cents(price?.nuevo_precio);
    const actual=product.precio_flexible==='SI'&&Number.isFinite(custom)&&custom>=base?custom:base;
    const pool=cents(product.comision)+(actual-base);
    const allocated=isSubgestor?cents(price?.comision_subgestor||0):0;
    if(!Number.isFinite(pool)||pool<0||allocated<0||allocated>pool) throw Error('La comisión asignada es inconsistente. Revisa la configuración.');
    equipment+=actual*qty;totalCommission+=pool*qty;subCommission+=allocated*qty;
    detail.push(`${qty}x ${product.nombre} [USD]`);
  }
  return {producto:detail.join(' + '),equipment:equipment/100,totalCommission:totalCommission/100,subCommission:subCommission/100,parentCommission:(totalCommission-subCommission)/100};
}
