import test from 'node:test';
import assert from 'node:assert/strict';
import { actorKind, projectRow, scopeFor, calculateSale } from '../supabase/functions/secure-data/policy.mjs';

const principal = { id:'principal', nombre:'Principal', estado:'activo', parent_id:null, rol:'gestor' };
const sub = { id:'sub', nombre:'Sub', estado:'activo', parent_id:'principal', rol:'superadmin' };
const admin = { id:'owner', nombre:'Owner', estado:'activo', parent_id:null, rol:'superadmin' };

test('un subgestor no obtiene privilegios aunque su perfil declare superadmin', () => {
  assert.equal(actorKind(sub), 'subgestor');
});
test('el historial del subgestor devuelve solo su comisión, incluso solicitando todas las columnas', () => {
  const row = projectRow('pedidos', {id:'sale',gestor:'Principal',subgestor_nombre:'Sub',comision_total:40,comision_parent:25,comision_subgestor:15,costo_proveedor:200,pago_gestor:'Pendiente',pago_subgestor:'Pagado'},sub);
  assert.equal(row.comision_total,15);
  assert.equal(row.pago_gestor,'Pagado');
  assert.equal('comision_parent' in row,false);
  assert.equal('costo_proveedor' in row,false);
  assert.equal(projectRow('pedidos_subgestores',{comision_total:40,comision_subgestor:0},sub).comision_total,0);
});
test('la comisión del principal permanece disponible en su vista privada', () => {
  const row = projectRow('pedidos', {comision_total:40,comision_parent:25,comision_subgestor:15},principal);
  assert.equal(row.comision_total,40);
  assert.equal(row.comision_parent,25);
});
test('el catálogo público y el del subgestor no revelan la comisión base ni el costo', () => {
  const product={id:'p',comision:40,costo_proveedor:200,nombre:'Equipo',precio:250};
  const assigned=new Map([['p',{comision_subgestor:15}]]);
  assert.equal(projectRow('productos',product,sub,assigned).comision,15);
  assert.equal(projectRow('productos',product,sub,new Map()).comision,0);
  assert.equal(projectRow('productos',product,null).comision,0);
  assert.equal('costo_proveedor' in projectRow('productos',product,sub,assigned),false);
  assert.equal(projectRow('productos',product,admin).costo_proveedor,200);
});
test('el subgestor no puede consultar pedidos del principal ni modificar su perfil para ascender', () => {
  assert.deepEqual(scopeFor('pedidos',sub,'select'),[['eq','subgestor_nombre','Sub']]);
  assert.throws(()=>scopeFor('precios_personalizados',sub,'update'),/permiso/i);
  assert.throws(()=>scopeFor('gestores',sub,'update',{rol:'superadmin'}),/permiso/i);
  assert.throws(()=>scopeFor('pedidos_subgestores',principal,'upsert',{id:'otro'}),/permiso/i);
  assert.throws(()=>scopeFor('pedidos_subgestores',principal,'update',{comision_total:900}),/comisión/i);
});
test('los eventos de inventario no filtran la comisión original dentro del JSON', () => {
  const row=projectRow('inventario_eventos',{tipo:'comision',valor_anterior:40,valor_nuevo:50,datos_producto:{id:'p',comision:50,costo_proveedor:200}},sub);
  assert.equal(row,null);
  const price=projectRow('inventario_eventos',{tipo:'precio',datos_producto:{id:'p',comision:50,costo_proveedor:200}},sub);
  assert.equal('comision' in price.datos_producto,false);
  assert.equal('costo_proveedor' in price.datos_producto,false);
});
test('el servidor calcula bolsa y reparto desde configuración real, no valores enviados por el navegador', () => {
  const sale=calculateSale([{producto_id:'p',cantidad:2}],[{id:'p',nombre:'Equipo',precio:100,comision:10,precio_flexible:'SI'}],[{producto_id:'p',nuevo_precio:115,comision_subgestor:7}],true);
  assert.deepEqual(sale,{producto:'2x Equipo [USD]',equipment:230,totalCommission:50,subCommission:14,parentCommission:36});
  assert.throws(()=>calculateSale([{producto_id:'p',cantidad:-1}],[{id:'p',precio:100,comision:10}],[],true));
  assert.throws(()=>calculateSale([{producto_id:'p',cantidad:1}],[{id:'p',precio:100,comision:10}],[{producto_id:'p',comision_subgestor:20}],true),/comisión/i);
});
