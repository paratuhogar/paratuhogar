const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
for(const kind of ['Venta','B2B'])test('coupon gross, discount and net are drawn consistently in '+kind+' invoice',async()=>{
 const name='generarComprobante'+kind,src=fs.readFileSync(new URL('../js/'+(kind==='Venta'?'storefront.js':'storefront-extras.js'),`file://${__filename}`),'utf8');
 const start=src.indexOf('async function '+name+'('),end=src.indexOf(kind==='Venta'?'\n// Función para verificar si un teléfono':'\n// --- FILTRAR VISIBILIDAD',start),drawing=[];
 const doc=new Proxy({lastAutoTable:{finalY:130},internal:{pageSize:{getWidth:()=>210,getHeight:()=>297}},text:x=>drawing.push(x),autoTable:x=>drawing.push(x.body),getTextWidth:()=>40,splitTextToSize:t=>[t],output:()=>({})},{get:(o,k)=>k in o?o[k]:()=>{}});
 const context={window:{jspdf:{jsPDF:function(){return doc;}},location:{origin:'https://example.test',pathname:'/'},PTHAffiliate:{current:()=>null,publicName:()=> 'Seller'}},localStorage:{getItem:()=>null},getAgentPhone:()=> '50000000',getOrGenerateShortLink:async()=>'',navigator:{},console};
 vm.createContext(context);vm.runInContext(src.slice(start,end),context);
 await context[name]({cliente:'Synthetic',direccion:'Synthetic street',ci:'00123456789',telefono:'50000000',totalUSD:48.33,mensajeria:3,items:[{nombre:'Fixture',qty:1,price:50}],descuento:4.67,cupon:'VERANO',referencias:['AA-1']},'descargar');
 const output=JSON.stringify(drawing);assert.match(output,/DESCUENTO \(VERANO\)/);assert.match(output,/-\$4.67/);assert.match(output,/48.33/);assert.doesNotMatch(output,/48.33.00/);
});
