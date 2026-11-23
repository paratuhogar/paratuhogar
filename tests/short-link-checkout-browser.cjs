// Actual ?s -> browser redirect -> anonymous checkout. Every request is local/synthetic.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),parent='11111111-1111-4111-a111-111111111111',child='22222222-2222-4222-a222-222222222222';
(async()=>{
 const {fixture}=await import('./fixtures/new-checkout.mjs'),f=await fixture();
 f.rows.gestores.push({id:parent,nombre:'Synthetic parent',rol:'gestor',estado:'activo',activo:true,telefono:'50000001'},
  {id:child,nombre:'Synthetic child',rol:'gestor',estado:'activo',activo:true,parent_id:parent,telefono:'50000002'});
 f.rows.precios_personalizados=f.rows.productos.map(p=>({gestor:'Synthetic parent',producto_id:p.id,comision_subgestor:3,visible_subgestor:true}));
 const browser=await chromium.launch({executablePath:process.env.PTH_CHROMIUM||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try {
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[],shortReads=[],navigations=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations.push(frame.url());});
  await context.routeWebSocket('**',socket=>socket.close());
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.pathname==='/rest/v1/short_links'){
    assert.equal(req.method(),'GET');shortReads.push(url.searchParams.get('slug'));
    return route.fulfill({json:url.searchParams.get('slug')==='eq.child01'?[{slug:'child01',original_url:'https://paratuhogar.org/?ref='+child,gestor:'Synthetic parent'}]:[]});
   }
   if(url.pathname==='/functions/v1/secure-data'){
    const body=req.postDataJSON();let result;
    if(body.action==='announcement')result={data:{acknowledged:true},error:null};
    else result=await f.request(body,req.headers().authorization?.replace(/^Bearer /,'')||null);
    return route.fulfill({json:result});
   }
   if(url.pathname.startsWith('/rest/v1/'))return route.fulfill({json:[]});
   if(url.origin==='https://paratuhogar.org'){
    const rel=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1)),file=path.resolve(root,rel);
    if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({contentType:/\.html$/.test(file)?'text/html':/\.js$/.test(file)?'application/javascript':/\.css$/.test(file)?'text/css':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream',body:fs.readFileSync(file)});
   }
   return route.fulfill({body:'',contentType:req.resourceType()==='stylesheet'?'text/css':'application/json'});
  });
  await page.addInitScript(()=>{
   sessionStorage.setItem('pth_intro_vista','true');localStorage.setItem('pth_data_saving_v1','on');
   window.alerts=[];window.alert=value=>alerts.push(value);window.confirm=()=>true;
  });
  await page.goto('https://paratuhogar.org/?s=child01');
  await page.waitForFunction(()=>typeof productosRaw!=='undefined'&&productosRaw.length===2);
  assert.equal(new URL(page.url()).searchParams.get('ref'),child);assert.ok(navigations.some(url=>url.includes('?s=child01')));assert.ok(shortReads.includes('eq.child01'));
  assert.equal(await page.evaluate(()=>PTHAffiliate.checkoutReference()),child);
  await page.evaluate(()=>{
   addProductFromCard('Equipo A');toggleCartModal(true);document.getElementById('check-recogida').checked=true;toggleRecogidaEnAlmacen();
   document.getElementById('check-nombre').value='Synthetic Customer';document.getElementById('check-tel').value='51234567';document.getElementById('check-ci').value='00123456789';
   PTHSecureData.checkout=async body=>{window.prepared=body;return{data:null,error:{code:'STOP_TEST',message:'No transmission'}};};
   document.getElementById('checkout-form').onsubmit({preventDefault(){}});
  });
  await page.waitForFunction(()=>!!window.prepared);
  const prepared=await page.evaluate(()=>window.prepared);assert.equal(prepared.table,'pedidos_subgestores');
  assert.ok(prepared.inputs.every(row=>row.subgestor_id===child&&row._referral_reference===child));assert.equal(f.writes,0);assert.deepEqual(errors,[]);
  await page.goto('https://paratuhogar.org/?s=unknown');await page.getByRole('button',{name:'Reintentar',exact:true}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('s'),'unknown');assert.equal(f.writes,0);assert.deepEqual(errors,[]);
  await context.close();console.log('PASS actual short URL redirects to the child UUID, real anonymous checkout keeps only child attribution, missing code blocks checkout with retry; no orders or production requests.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
