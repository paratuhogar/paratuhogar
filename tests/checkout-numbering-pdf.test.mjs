import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// Real rendering functions with a drawing-API recorder; no network or PDF downloads.
for(const kind of ['Venta','B2B'])test('confirmed references reach '+kind+' PDF drawing output',async()=>{
 const name='generarComprobante'+kind;
 const src=fs.readFileSync(new URL('../js/'+(kind==='Venta'?'storefront.js':'storefront-extras.js'),import.meta.url),'utf8');
 const start=src.indexOf('async function '+name+'('),end=src.indexOf('\nasync function ',start+1);
 const endComment=kind==='Venta'?src.indexOf('\n// Función para verificar si un teléfono',start):src.indexOf('\n// --- FILTRAR VISIBILIDAD',start);
 const functionSource=src.slice(start,endComment<0?undefined:endComment);
 const drawing=[];
 const doc=new Proxy({lastAutoTable:{finalY:130},internal:{pageSize:{getWidth:()=>210,getHeight:()=>297}},text:x=>drawing.push(x),autoTable:x=>drawing.push(x.body),getTextWidth:()=>40,splitTextToSize:t=>[t],output:()=>({})},{get:(o,k)=>k in o?o[k]:()=>{}});
 const context={window:{jspdf:{jsPDF:function(){return doc;}},location:{origin:'https://example.test',pathname:'/'},PTHAffiliate:{current:()=>null,publicName:()=> 'Seller'}},localStorage:{getItem:()=>null},getAgentPhone:()=> '50000000',getOrGenerateShortLink:async()=>'',navigator:{},console};
 vm.createContext(context);vm.runInContext(functionSource,context);
 await context[name]({cliente:'Synthetic',direccion:'Synthetic street',ci:'00123456789',telefono:'50000000',totalUSD:53,mensajeria:3,items:[{nombre:'Fixture',qty:1,price:50}],referencias:['RO-22','AA-1']},'descargar');
 const output=JSON.stringify(drawing);assert.match(output,/RO-22/);assert.match(output,/AA-1/);assert.doesNotMatch(output,/#REF-/);
});
