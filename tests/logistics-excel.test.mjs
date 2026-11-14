import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../js/storefront.js',import.meta.url),'utf8');
const exportCode=source.slice(source.indexOf('async function exportLogisticaExcel()'),source.indexOf('// --- FUNCIÓN PARA ACTUALIZAR PRECIO Y COMISIÓN ---'));
const order=(ref,id,estado='Entregado')=>({orden_dia:ref,mensajero_id:id,estado,fecha:'2026-08-12T15:00:00Z',gestor:'Gestor de prueba',total:120});
const messengers=[{id:'active',nombre:'Mensajera actual',activo:true},{id:'inactive',nombre:'Mensajero anterior',activo:false}];

async function exportFixture(orders,{lookupError=false,sessionChange=false,filterChange=false}={}){
 const requests=[],downloads=[],alerts=[];
 let token='fixture-session';
 const ctx={
  pedidosRawAdmin:orders,currentStatusFilter:'FINALIZADOS',
  window:{PTHSecureData:{token:()=>token},PTHAssets:{ensure:async()=>true}},
  document:{getElementById:()=>({value:''})},
  alert:message=>alerts.push(message),
  supabaseClient:{from(table){
   const request={table};
   return {
    select(columns){request.columns=columns;return this},
    in(column,ids){request.column=column;request.ids=Array.from(ids);return this},
    async forSession(boundToken){
     requests.push({...request,boundToken});
     if(sessionChange)token='other-session';
     if(filterChange)ctx.currentStatusFilter='Pendiente';
     if(lookupError)return {data:null,error:{message:'Synthetic outage'}};
     return {data:messengers.filter(m=>request.ids.includes(m.id)).map(({id,nombre})=>({id,nombre})),error:null};
    }
   };
  }},
  XLSX:{utils:{
   json_to_sheet:rows=>({rows:structuredClone(rows),'!ref':'A1:N'+(rows.length+1)}),
   book_new:()=>({}),
   book_append_sheet:(book,sheet,name)=>Object.assign(book,{sheet,name})
  },writeFile:(book,name)=>downloads.push({book,name})}
 };
 await vm.runInNewContext(exportCode+'\nexportLogisticaExcel();',ctx);
 return {requests,downloads,alerts};
}

test('historical exports name active and inactive couriers and distinguish missing records from unassigned orders',async()=>{
 const orders=[order('A-1','active'),order('A-2','inactive'),order('A-3',null),order('A-4','missing'),order('A-5','ignored','Pendiente')];
 const {requests,downloads}=await exportFixture(orders);
 assert.equal(downloads.length,1);
 const rows=downloads[0].book.sheet.rows;
 assert.deepEqual(rows.map(row=>[row['ID PEDIDO'],row['Mensajero asignado'],row['Estado Actual']]),[
  ['A-1','Mensajera actual','Entregado'],['A-2','Mensajero anterior','Entregado'],
  ['A-3','Sin asignar','Entregado'],['A-4','Nombre no disponible','Entregado']
 ]);
 assert.deepEqual(requests,[{table:'mensajeros',columns:'id,nombre',column:'id',ids:['active','inactive','missing'],boundToken:'fixture-session'}]);
 assert.equal(downloads[0].book.sheet['!cols'].length,Object.keys(rows[0]).length);
 assert.equal(downloads[0].book.sheet['!autofilter'].ref,'A1:N5');
});

test('a courier lookup error does not produce a misleading spreadsheet',async()=>{
 const {downloads,alerts}=await exportFixture([order('A-1','active')],{lookupError:true});
 assert.equal(downloads.length,0);
 assert.match(alerts[0],/No se pudieron consultar los mensajeros/);
});

test('no export is downloaded under a different session',async()=>{
 const {downloads}=await exportFixture([order('A-1','active')],{sessionChange:true});
 assert.equal(downloads.length,0);
});

test('an unassigned-only export requires no courier query',async()=>{
 const {requests,downloads}=await exportFixture([order('A-1',null)]);
 assert.deepEqual(requests,[]);
 assert.equal(downloads[0].book.sheet.rows[0]['Mensajero asignado'],'Sin asignar');
});

test('changing the status tab during the lookup does not rename the historical download',async()=>{
 const {downloads}=await exportFixture([order('A-1','active')],{filterChange:true});
 assert.equal(downloads[0].book.sheet.rows[0]['Estado Actual'],'Entregado');
 assert.match(downloads[0].name,/^Logistica_FINALIZADOS_/);
});
