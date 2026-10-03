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
  const requests = [], unexpected = [];
  const json = (res, data, status=200) => {res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  const server = http.createServer(async(req,res) => {
    try {
      const url = new URL(req.url, origin);
      const record = {path:url.pathname, query:url.search, method:req.method}; requests.push(record);
      if(url.pathname === '/functions/v1/secure-data') {
        let raw=''; for await(const chunk of req) {raw += chunk; if(raw.length>150000)throw Error('Fixture body too large');}
        const body=JSON.parse(raw);record.action=body.action;record.table=body.table;record.operation=body.operation;
        const bearer=(req.headers.authorization||'').replace(/^Bearer\s+/i,'')||null;
        return json(res,await f.request(body,bearer));
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
    setOldWorker(value){oldWorker=value;},close:()=>new Promise(resolve=>server.close(resolve))};
}
module.exports={startFixture};
