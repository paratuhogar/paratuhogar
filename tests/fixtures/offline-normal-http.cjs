// Local-only gateway + allowlisted checked-in assets. No remote requests or writes.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const remote = 'https://ljqwaovevfatkiigirhf.supabase.co';
const TOKENS = {a: 'a'.repeat(64), b: 'b'.repeat(64)};
const MARKERS = {a: 'PRIVATE_A_CUSTOMER_47', b: 'PRIVATE_B_CUSTOMER_63', address: 'PRIVATE_A_ADDRESS_47'};

async function startFixture() {
  const {fixture} = await import('./new-checkout.mjs');
  const {hash} = await import('../../supabase/functions/secure-data/handler.mjs');
  const f = await fixture();
  const until = Date.now() + 86400000;
  const a = {...f.rows.gestores[0], nombre: 'Synthetic seller A', telefono: '5350000001'};
  const b = {...a, id: 'actor-b', nombre: 'Synthetic seller B', password: 'synthetic-only-b', telefono: '5350000002'};
  f.rows.gestores = [a, b];
  f.rows.pth_feedback_announcement_ack = [{gestor_id:a.id},{gestor_id:b.id}];
  f.rows.pth_secure_sessions = await Promise.all([a,b].map(async(actor,i) => ({token_hash: await hash(TOKENS[i?'b':'a']), gestor_id: actor.id, credential_hash: await hash(actor.password), expires_at: new Date(until).toISOString()})));
  // The original historical record remains untouched throughout the test.
  f.rows.pedidos.push({id:'own-a', gestor:a.nombre, cliente:MARKERS.a, telefono:'5351111111', ci:'11111111111', direccion:MARKERS.address, fecha:new Date().toISOString()},
    {id:'own-b', gestor:b.nombre, cliente:MARKERS.b, telefono:'5352222222', ci:'22222222222', direccion:'PRIVATE_B_ADDRESS_63', fecha:new Date().toISOString()});
  f.rows.productos.forEach((p,i) => Object.assign(p, {categoria: i?'ENERGIA':'HOGAR', descripcion:i?'Descripción equipo B':'Descripción equipo A', thumbnail:'/icons/product-placeholder.svg', created_at:new Date().toISOString()}));
  let oldWorker = false, serial = 0;
  const assetFailures=new Map();
  const requests = [], unexpected = [];
  const json = (res, data, status=200) => {res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  const server = http.createServer(async(req,res) => {
    try {
      const url = new URL(req.url, origin);
      if(!url.pathname.startsWith('/__qa')&&fs.existsSync(path.join(root,'../evidence/network-offline'))) {req.socket.destroy();return;}
      if(url.pathname==='/__qa') {
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
        return res.end(`<!doctype html><title>QA local sintético</title><h1>Controles de prueba local</h1><p>Solo datos sintéticos. No controla la red del Mac.</p>
        <button id="offline" onclick="fetch('/__qa-network?offline=1').then(()=>status.textContent='Servidor de aplicación sin red simulada')">Simular sin red</button>
        <button id="online" onclick="fetch('/__qa-network?offline=0').then(()=>status.textContent='Servidor conectado')">Reconectar</button>
        <button id="expire" onclick="localStorage.setItem('pth_secure_token_expires_at',String(Date.now()-1));fetch('/__qa-expire').then(()=>status.textContent='Sesión sintética caducada')">Caducar sesión demo</button>
        <button id="incomplete" onclick="caches.keys().then(async names=>{for(const n of names)if(n.startsWith('pth-public-static-'))await (await caches.open(n)).delete('/js/offline-checkout-copy.js?v=20261005-copy2');status.textContent='Caché incompleta';})">Eliminar un recurso público</button>
        <button id="evict-copy" onclick="let r=indexedDB.open('pth_offline_checkout_copy_v1',1);r.onsuccess=()=>{let t=r.result.transaction('copies','readwrite');t.objectStore('copies').clear();t.oncomplete=()=>{r.result.close();status.textContent='Copia local desalojada';};}">Desalojar copia sintética</button>
        <button id="audit" onclick="Promise.all([fetch('/__qa-state').then(r=>r.json()),readCopies(),readQueues()]).then(x=>{document.getElementById('output').textContent=JSON.stringify(x,null,2);})">Auditar persistencia y servidor</button>
        <p id="status">Control listo</p><pre id="output"></pre><script>
        const status=document.getElementById('status');
        function rows(dbName,table){return new Promise(resolve=>{const r=indexedDB.open(dbName,1);r.onsuccess=()=>{if(!r.result.objectStoreNames.contains(table)){r.result.close();resolve([]);return;}const q=r.result.transaction(table).objectStore(table).getAll();q.onsuccess=()=>{r.result.close();resolve(q.result);};};});}
        function readCopies(){return rows('pth_offline_checkout_copy_v1','copies').then(r=>r.map(x=>({owner:x.owner,clients:x.clients.map(c=>c.cliente),products:x.products.length,tariffs:x.tariffs.length,expiresAt:x.expiresAt})));}
        function readQueues(){return rows('pth_pending_checkout_v2','queues').then(r=>r.map(x=>({owner:x.owner,orders:x.orders.map(o=>({id:o.id,state:o.state,client:o.form?.nombre,receipts:o.receipts}))})));}
        </script>`);
      }
      if(url.pathname==='/__qa-network'){const flag=path.join(root,'../evidence/network-offline');if(url.searchParams.get('offline')==='1')fs.writeFileSync(flag,'');else fs.rmSync(flag,{force:true});return json(res,{ok:true});}
      if(url.pathname==='/__qa-expire'){f.rows.pth_secure_sessions.forEach(s=>s.expires_at=new Date(Date.now()-1000).toISOString());return json(res,{ok:true});}
      if(url.pathname==='/__qa-state'){return json(res,{writes:f.writes,orders:f.rows.pedidos.map(o=>({id:o.id,client:o.cliente,reference:o.orden_dia})),requests:requests.filter(r=>r.action).map(r=>({action:r.action,operation:r.operation,table:r.table}))});}
      const record = {path:url.pathname, query:url.search, method:req.method,hasCookie:Boolean(req.headers.cookie),hasAuthorization:Boolean(req.headers.authorization)}; requests.push(record);
      if(url.pathname === '/functions/v1/secure-data') {
        let raw=''; for await(const chunk of req) {raw += chunk; if(raw.length>150000)throw Error('Fixture body too large');}
        const body=JSON.parse(raw);record.action=body.action;record.table=body.table;record.operation=body.operation;
        const bearer=(req.headers.authorization||'').replace(/^Bearer\s+/i,'')||null;
        const result=await f.request(body,bearer);return json(res,result,f.lastStatus);
      }
      if(url.pathname.startsWith('/rest/v1/')) {
        const table=url.pathname.slice('/rest/v1/'.length);
        if(table==='rpc/reservar_consecutivo_pedido') return json(res,'A'+String(++serial).padStart(5,'0'));
        if(table==='tarifas_mensajeria') return json(res,f.rows.tarifas_mensajeria);
        if(table==='categorias') return json(res,[{nombre:'HOGAR'},{nombre:'ENERGIA'}]);
        if(table==='control_sistema')return json(res,req.headers.accept?.includes('object')?{valor:'2026-10-03'}:[{valor:'2026-10-03'}]);
        if(/^(customer_bindings|customer_binding_events|spy_logs|spy_sessions|visitas|analytics_events|customer_leads|producto_descripciones|inventario_eventos|clientes_protegidos|product_sales_stats|notificaciones|tipo_cambio|system_config|rpc\/contar_pedidos_entregados)$/.test(table))return json(res,[]);
        // Optional legacy dashboards are never evidence of offline availability.
        unexpected.push(table); return json(res,[]);
      }
      if(url.pathname.startsWith('/realtime/')) {res.writeHead(404);return res.end();}
      if(url.pathname === '/__warm-old') {
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
        return res.end('<!doctype html><title>Synthetic old worker</title><script>navigator.serviceWorker.register("/service-worker.js?v=before-normal",{scope:"/",updateViaCache:"none"})</script>');
      }
      if(url.pathname === '/__storage') {
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
        return res.end('<!doctype html><title>Synthetic storage control tab</title>');
      }
      let relative=url.pathname==='/'||url.pathname.startsWith('/producto/')?'index.html':url.pathname.slice(1);
      if(!/^(?:index\.html|offline(?:-catalog|-order)?\.html|log\.jpeg|manifest\.webmanifest|service-worker\.js|js\/[\w./-]+\.(?:js|mjs)|css\/[\w.-]+\.css|icons\/[\w-]+\.(?:png|svg))$/.test(relative)) {record.status=404;res.writeHead(404);return res.end();}
      const filename=path.resolve(root,relative);
      assert.ok(filename.startsWith(root+path.sep));
      if(!fs.existsSync(filename)){record.status=404;res.writeHead(404);return res.end();}
      if(assetFailures.has(url.pathname)){record.status=assetFailures.get(url.pathname);res.writeHead(record.status);return res.end('Synthetic public asset unavailable');}
      let body=fs.readFileSync(filename);
      if(relative==='service-worker.js'&&oldWorker)body=fs.readFileSync(path.join(__dirname,'offline-worker-before-normal.js'));
      // Only endpoint plumbing changes; the shipped SDK, DOM, worker and business rules are real.
      if(/\.(js|mjs)$/.test(relative))body=Buffer.from(String(body).split(remote).join(origin));
      const type=relative.endsWith('.html')?'text/html; charset=utf-8':/\.(js|mjs)$/.test(relative)?'application/javascript; charset=utf-8':relative.endsWith('.css')?'text/css; charset=utf-8':relative.endsWith('.svg')?'image/svg+xml':relative.endsWith('.webmanifest')?'application/manifest+json':'image/png';
      res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','Service-Worker-Allowed':'/'});res.end(body);
    } catch(error) {json(res,{data:null,error:{message:error.message,code:'FIXTURE_ERROR'}},500);}
  });
  let origin;
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  origin='http://127.0.0.1:'+server.address().port;
  return {origin, f, requests, unexpected, until, actors:{a,b}, tokens:TOKENS, markers:MARKERS,
    failAsset(path,status=503){assert.ok(path.startsWith('/')&&!path.startsWith('/functions/')&&!path.startsWith('/rest/'));if(status===null)assetFailures.delete(path);else assetFailures.set(path,status);},
    setOldWorker(value){oldWorker=value;},close:()=>new Promise(resolve=>server.close(resolve))};
}
module.exports={startFixture};
if(require.main===module)startFixture().then(f=>{
  fs.mkdirSync(path.join(root,'../evidence'),{recursive:true});
  fs.writeFileSync(path.join(root,'../evidence/fixture-origin.txt'),f.origin);
  console.log(f.origin+' — synthetic seller: Synthetic seller A / synthetic-only');
  process.on('SIGINT',()=>f.close().then(()=>process.exit()));
});
