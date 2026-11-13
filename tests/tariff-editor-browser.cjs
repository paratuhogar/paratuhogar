const {chromium}=require('playwright');
const {readFileSync}=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const read=name=>readFileSync(path.join(__dirname,'..',name),'utf8');
const html=read('index.html');
const section=html.slice(html.indexOf('<div id="cnt-mensajeria"'),html.indexOf('<!-- Contenido: Análisis -->'));
const js=read('js/storefront.js');
const tariffCode=js.match(/function escapeDetailText\(value\) \{[\s\S]*?\n\}/)[0]+'\n'+js.slice(js.indexOf('let tarifasMensajeria ='),js.indexOf('function expressShippingSelected()'));
const css=read('css/tailwind.min.css')+read('css/admin-panel.css');
const fixture=`
window.currentUserData={rol:'admin'};
let sessionToken='synthetic-session';
window.PTHSecureData={token:()=>sessionToken};
const cart=[];
const calls=[];
let failSave=false, heldSave=null, holdSave=false, failRead=true;
let rows=Array.from({length:140},(_,i)=>({
 id:String(i),municipio:i<20?'Centro Habana':'Playa',localidad:'Reparto '+String(i).padStart(3,'0'),
 precio_pequeno:6,precio_mediano:i===105?7.125:null,precio_grande:10,precio_expres_pequeno:12,minutos_expres_pequeno:45
}));
const offlineStorefront={current:()=>null};
const recalcularTotalFinal=()=>{};
const supabaseClient={from(table){
 let operation='read',payload,key;
 const q={
  select(){return q}, order(){return q}, single(){return q}, forSession(){return q},
  eq(column,value){key=value;return q},
  update(row){operation='update';payload=row;return q},
  insert(row){operation='insert';payload=Array.isArray(row)?row[0]:row;return q},
  then(ok,bad){return Promise.resolve().then(async()=>{
   if(table!=='tarifas_mensajeria')throw Error('Wrong table');
   if(operation==='read')return failRead?{data:null,error:{message:'Simulación sin conexión'}}:{data:structuredClone(rows),error:null};
   calls.push({operation,key,payload});
   if(holdSave)await new Promise(resolve=>{heldSave=resolve});
   if(failSave)return {data:null,error:{message:'Simulación sin conexión'}};
   const saved={...rows.find(r=>r.id===key),...payload,id:operation==='insert'?'new':key};
   rows=rows.filter(r=>r.id!==saved.id).concat(saved);
   return {data:structuredClone(saved),error:null};
  }).then(ok,bad)}
 };return q;
}};
`;

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PTH_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  for(const width of [360,1280]){
   const page=await browser.newPage({viewport:{width,height:740},isMobile:width===360,hasTouch:width===360});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.setContent(`<!doctype html><html lang="es" class="${width===360?'dark':''}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body><main style="padding:12px">${section}</main><script>${fixture}</script><script>${read('js/checkout-form-shared.js')}</script><script>${tariffCode}</script></body></html>`);
   await page.evaluate(async()=>{document.getElementById('cnt-mensajeria').classList.remove('hidden');await loadTarifasMensajeria();});
   const addZone=page.getByRole('button',{name:'Añadir zona',exact:true});
   assert.equal(await addZone.isDisabled(),true,'cannot replace an unloaded list with one new zone');
   await page.evaluate(()=>{failRead=false;});
   await page.getByRole('button',{name:'Reintentar carga',exact:true}).click();
   await addZone.evaluate(el=>{if(el.disabled)throw Error('The full list did not load');});
   const search=page.locator('#search-mensajeria');
   await search.fill('Playa');
   const target=page.getByRole('row').filter({hasText:'Reparto 105'});
   const config=target.getByRole('button',{name:/configurar/i});
   assert.equal(await config.count(),1,'cada fila tiene su propio acceso al editor');
   assert.equal(await page.locator('#m-municipio').isVisible(),false,'el formulario no ocupa espacio arriba');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'la acción no queda fuera del ancho móvil');
   await config.evaluate(el=>el.scrollIntoView({block:'center'}));
   const offset=await page.evaluate(()=>scrollY);
   assert.ok(offset>2000);
   await config.click();
   const dialog=page.getByRole('dialog',{name:/configurar tarifa/i});
   assert.equal(await dialog.isVisible(),true);
   assert.equal(await dialog.locator('#m-localidad').inputValue(),'Reparto 105');
   assert.equal(await dialog.locator('#precio_expres_pequeno').inputValue(),'12');
   assert.equal(await dialog.locator('#minutos_expres_pequeno').inputValue(),'45');
   assert.equal(await page.evaluate(()=>scrollY),offset);
   if(process.env.PTH_TARIFF_SCREENSHOTS)await page.screenshot({path:path.join(process.env.PTH_TARIFF_SCREENSHOTS,'tariff-editor-'+width+'.png')});
   await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
   await dialog.waitFor({state:'hidden'});
   assert.equal(await config.evaluate(el=>el===document.activeElement),true,'cancelar devuelve el foco a la fila');
   assert.equal(await page.evaluate(()=>scrollY),offset);
   assert.equal(await page.evaluate(()=>calls.length),0);

   await config.click();
   await dialog.locator('#m-precio-pq').fill('7.25');
   assert.equal(await dialog.locator('#m-precio-md').evaluate(el=>el.validity.valid),true,'existing ordinary prices retain their precision');
   await page.evaluate(()=>{failSave=true;holdSave=true;});
   const save=dialog.getByRole('button',{name:/guardar/i});
   await save.click();
   await page.waitForFunction(()=>heldSave!==null);
   await page.keyboard.press('Escape');
   assert.equal(await dialog.isVisible(),true,'Escape no oculta un guardado en curso');
   await page.evaluate(()=>{holdSave=false;heldSave();heldSave=null;});
   await dialog.getByRole('alert').waitFor();
   assert.match(await dialog.getByRole('alert').textContent(),/No se pudo guardar/i);
   assert.equal(await dialog.locator('#m-precio-pq').inputValue(),'7.25');
   await page.evaluate(()=>{failSave=false;});
   await save.click();
   await dialog.waitFor({state:'hidden'});
   assert.equal(await search.inputValue(),'Playa');
   await page.waitForFunction(()=>document.activeElement?.closest('tr')?.dataset.tariffId==='105');
   assert.equal(await config.evaluate(el=>el===document.activeElement),true,'guardar devuelve el foco a la fila actualizada');
   assert.equal(await page.evaluate(()=>scrollY),offset);
   assert.match(await target.textContent(),/\$7\.25/);
   const [attempt,update]=await page.evaluate(()=>calls);
   assert.deepEqual(update,{operation:'update',key:'105',payload:{municipio:'Playa',localidad:'Reparto 105',precio_pequeno:7.25,precio_mediano:7.125,precio_grande:10,precio_expres_pequeno:12,minutos_expres_pequeno:45,precio_expres_mediano:null,minutos_expres_mediano:null,precio_expres_grande:null,minutos_expres_grande:null}});
   assert.deepEqual(attempt,update);

   await addZone.click();
   const add=page.getByRole('dialog',{name:/añadir zona/i});
   assert.equal(await add.locator('#m-municipio').inputValue(),'');
   assert.equal(await add.locator('#m-precio-pq').inputValue(),'');
   assert.ok((await page.locator('#list-municipios option').evaluateAll(nodes=>nodes.map(n=>n.value))).includes('Playa'));
   await add.locator('#m-municipio').fill('Municipio nuevo');
   await add.locator('#m-localidad').fill("Reparto d'Ángel");
   await add.locator('#m-precio-pq').fill('8');
   await add.locator('#m-precio-gr').fill('12');
   await add.getByRole('button',{name:/guardar/i}).click();
   await add.waitFor({state:'hidden'});
   assert.equal(await search.inputValue(),'Playa');
   assert.match(await page.locator('#mensajeria-list-status').textContent(),/Zona añadida/i);
   await search.fill('Municipio nuevo');
   const created=page.getByRole('row').filter({hasText:"Reparto d'Ángel"});
   assert.match(await created.textContent(),/\$8/);
   await page.evaluate(()=>{window.currentUserData.rol='logistica';});
   await created.getByRole('button',{name:/configurar/i}).click();
   assert.equal(await dialog.locator('#precio_expres_pequeno').isDisabled(),true,'logística no obtiene permisos de exprés');
   await dialog.locator('#m-precio-pq').fill('9');
   await dialog.getByRole('button',{name:/guardar/i}).click();
   await dialog.waitFor({state:'hidden'});
   const last=await page.evaluate(()=>calls.at(-1));
   assert.equal(last.payload.precio_pequeno,9);
   assert.ok(!Object.keys(last.payload).some(key=>key.includes('_expres_')));
   await search.fill('Playa');
   await config.scrollIntoViewIfNeeded();
   const anchor=await config.evaluate(el=>{
    window.scrollTo({top:scrollY+el.getBoundingClientRect().top-innerHeight/2,behavior:'instant'});
    return el.getBoundingClientRect().top;
   });
   await config.click();
   await dialog.locator('#m-municipio').fill('Otro municipio');
   await dialog.getByRole('button',{name:/guardar/i}).click();
   await dialog.waitFor({state:'hidden'});
   const next=page.getByRole('row').filter({hasText:'Reparto 106'}).getByRole('button',{name:/configurar/i});
   await page.waitForFunction(()=>document.activeElement?.closest('tr')?.dataset.tariffId==='106',null,{timeout:1500});
   assert.ok(Math.abs(await next.evaluate(el=>el.getBoundingClientRect().top)-anchor)<=1,'renaming outside the filter preserves the next visible row');
   assert.equal(await search.inputValue(),'Playa');
   const beforeSessionChange=await page.evaluate(()=>calls.length);
   await next.click();
   await page.evaluate(()=>{sessionToken='other-session';});
   await dialog.getByRole('button',{name:/guardar/i}).click();
   assert.equal(await page.evaluate(()=>calls.length),beforeSessionChange,'an old editor cannot save under a new session');
   await dialog.waitFor({state:'hidden'});
   assert.deepEqual(errors,[]);
   await page.close();
   console.log('PASS tariff editor '+width+'px: configure, cancel, failed save, scroll/focus, add, logistics');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
