const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const nav=html.match(/<nav id="admin-master-nav"[\s\S]*?<\/nav>/)[0];
const pending=html.slice(html.indexOf('<div id="cnt-aprobaciones"'),html.indexOf('    <!-- BLOQUE 2: ACTIVOS -->',html.indexOf('<div id="cnt-aprobaciones"')))+'</div>';
const css=['css/tailwind.min.css','css/admin-panel.css'].map(p=>fs.readFileSync(path.join(root,p),'utf8')).join('\n');
const storefront=fs.readFileSync(path.join(root,'js/storefront.js'),'utf8'),extras=fs.readFileSync(path.join(root,'js/storefront-extras.js'),'utf8');
const tabCode=storefront.slice(storefront.indexOf('function changeAdminTab(tab)'),storefront.indexOf('// Registro de estadísticas',storefront.indexOf('function changeAdminTab(tab)')));
const pendingCode=extras.slice(extras.indexOf('let pendingGestoresCache'),extras.indexOf('async function loadPendingGestores'));
const sdk=`var calls=[],failTraffic=false,failCharts=false,hangTraffic=false,actions=[],chartConfigs=[];
var supabaseClient={from(table){let start=0,end=499,filters=[],columns='*',head=false;
const q={select(c,o={}){columns=c;head=o.head;return q},gte(c,v){filters.push(['gte',c,v]);return q},lte(c,v){filters.push(['lte',c,v]);return q},order(c,o){return q},range(a,b){start=a;end=b;return q},abortSignal(s){q.signal=s;return q},then(ok,no){calls.push({table,start,end,filters,columns,head});if(hangTraffic&&table==='link_analytics')return new Promise(()=>{}).then(ok,no);const time=new Date(Date.now()-86400000).toISOString();let result=table==='pedidos'?{data:null,count:800,error:null}:{data:Array.from({length:table==='link_analytics'?1601:1100},(_,id)=>table==='link_analytics'?{id,timestamp:time,agent_name:'<img src=x onerror="window.executed=true">',pais:'Cuba',os:'Android'}:{id,fecha:time,nombre_producto:'__proto__'}).slice(start,end+1),error:null};if(failTraffic&&table==='link_analytics'&&start>=500)result={data:null,error:{message:'secret text'}};return Promise.resolve(result).then(ok,no)}};return q;}};
window.PTHAssets={load(name){if(name==='charts'&&failCharts)return Promise.reject(Error('CDN unavailable'));return Promise.resolve()}};
window.Chart=function(ctx,config){chartConfigs.push(config);this.destroy=()=>{}};
var approveGestorOnly=(id,name)=>actions.push(['activate',id,name]),approveGestor=(id,state)=>actions.push(['reject',id,state]);`;
function contrast(color,bg){const lum=c=>{const a=c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*a[0]+.7152*a[1]+.0722*a[2]};const a=[lum(color),lum(bg)].sort((a,b)=>b-a);return (a[0]+.05)/(a[1]+.05);}
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 for(const width of [360,390,1280])for(const dark of [false,true]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());
  await page.setContent(`<!doctype html><html lang="es" class="${dark?'dark':''}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><section style="padding:16px">${nav}<div id="cnt-logistica" class="tab-cnt"></div><div id="cnt-inventario" class="tab-cnt hidden"></div>${pending}<div id="cnt-trafico" class="tab-cnt hidden"></div></section><script>${sdk}</script><script>${fs.readFileSync(path.join(root,'js/admin-panel-data.js'),'utf8')}</script><script>${tabCode}\n${pendingCode}</script><script>${fs.readFileSync(path.join(root,'admin-stats.js'),'utf8')}</script></body></html>`);
  assert.equal(await page.locator('#tab-trafico').count(),1);assert.equal(await page.locator('#admin-master-nav button button').count(),0);
  const controls=await page.locator('#admin-master-nav > *').evaluateAll(ns=>ns.map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {left:r.left,right:r.right,width:r.width,height:r.height,scroll:n.scrollWidth,client:n.clientWidth,color:s.color,bg:s.backgroundColor};}));
  for(const c of controls){assert.ok(c.height>=44&&c.width>=44&&c.left>=0&&c.right<=width);assert.ok(c.scroll<=c.client);assert.ok(contrast(c.color,c.bg)>=4.5);}
  await page.locator('#tab-logistica').focus(); await page.keyboard.press('Tab');
  assert.equal(await page.locator('#tab-mensajeria').evaluate(n=>n===document.activeElement && getComputedStyle(n).outlineWidth==='3px'),true);
  await page.click('#tab-inventario');assert.equal(await page.locator('#tab-inventario').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#tab-logistica').getAttribute('aria-pressed'),'false');
  await page.click('#tab-aprobaciones');await page.evaluate(()=>{const now=Date.now();pendingGestoresCache=[{id:'recent',estado:'pendiente',created_at:new Date(now-1000).toISOString(),nombre:'<img src=x onerror="window.executed=true">',telefono:'prueba'},{id:'old',estado:'pendiente',created_at:new Date(now-8*86400000).toISOString(),nombre:'Anterior'},{id:'missing',estado:'pendiente',created_at:null,nombre:'Sin fecha'}];renderPendingGestores()});
  assert.equal(await page.locator('#list-admin-aprobaciones tr').count(),1);assert.equal(await page.locator('#admin-pending-count').textContent(),'1');assert.equal(await page.locator('#list-admin-aprobaciones img').count(),0);
  await page.locator('#list-admin-aprobaciones button').first().click();assert.equal((await page.evaluate(()=>actions))[0][1],'recent');
  await page.selectOption('#admin-pending-filter','history');assert.ok((await page.locator('#list-admin-aprobaciones').textContent()).includes('Anterior'));
  await page.selectOption('#admin-pending-filter','unknown');assert.ok((await page.locator('#list-admin-aprobaciones').textContent()).includes('Fecha por revisar'));
  await page.click('#tab-trafico');await page.waitForFunction(()=>document.getElementById('stat-total-clicks')?.textContent==='1,601');
  assert.equal(await page.locator('#stat-orders').textContent(),'800');assert.equal(await page.locator('#traffic-table-0 img').count(),0);assert.equal(await page.evaluate(()=>window.executed),undefined);
  const calls=await page.evaluate(()=>calls);assert.equal(calls.filter(c=>c.table==='link_analytics').length,4);assert.equal(calls.filter(c=>c.table==='metricas_vistas').length,3);assert.ok(calls.every(c=>c.filters.length===2));assert.ok(calls.every(c=>!c.columns.includes('ip_address')));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(process.env.PTH_ADMIN_SCREENSHOTS){fs.mkdirSync(process.env.PTH_ADMIN_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.PTH_ADMIN_SCREENSHOTS,`admin-${width}-${dark?'dark':'light'}.png`),fullPage:true});}
  await page.evaluate(()=>{failCharts=true;return refreshTrafficDashboard()});assert.equal(await page.locator('#stat-total-clicks').textContent(),'1,601');assert.ok((await page.locator('#traffic-chart-status').textContent()).includes('No se pudieron'));
  await page.evaluate(()=>{failTraffic=true;return refreshTrafficDashboard()});assert.equal(await page.locator('#stat-total-clicks').textContent(),'—');assert.equal(await page.locator('#traffic-refresh').isDisabled(),false);assert.ok(!(await page.locator('#traffic-status').textContent()).includes('secret'));
  await page.evaluate(()=>{failTraffic=false;failCharts=false;return refreshTrafficDashboard()});assert.equal(await page.locator('#stat-total-clicks').textContent(),'1,601');
  await page.selectOption('#traffic-period','7');await page.waitForFunction(()=>document.getElementById('traffic-refresh').disabled===false);assert.ok((await page.evaluate(()=>calls.at(-1).filters[0][2])).length>10);
  await page.evaluate(()=>{hangTraffic=true;refreshTrafficDashboard()});await page.click('#tab-inventario');await page.waitForTimeout(50);assert.equal(await page.locator('#cnt-trafico').isVisible(),false);assert.equal(await page.evaluate(()=>pthTrafficRefreshTimer===null),true);
  assert.deepEqual(errors,[]);await page.close();console.log(`PASS admin ${width}px ${dark?'dark':'light'}: navigation, contrast, recent/history/missing dates, inert text/actions, uncapped windowed reads, recovery and interrupted navigation`);
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
