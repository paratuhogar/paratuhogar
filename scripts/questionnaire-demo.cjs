// Generates a local fixture from the actual form and registration function.
// The fixture has no SDK, fetch, service worker or real database connection.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const form=html.slice(html.indexOf('<div id="form-register"'),html.indexOf('            <!-- NUEVO: FORMULARIO RECUPERACIÓN -->')).replace('space-y-4 hidden','space-y-4');
const source=fs.readFileSync(path.join(root,'js/storefront.js'),'utf8');
const start=source.indexOf('let registrationBusy=false;');
const end=source.indexOf('\nasync function ',source.indexOf('async function processRegister()',start)+40);
const demo=`<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>Demo aislada · solicitud de gestor</title><link rel="stylesheet" href="../css/tailwind.min.css"><style>body{background:#f8fafc;color:#172554;padding:24px}main{max-width:520px;margin:auto;background:white;padding:24px;border-radius:24px}[hidden]{display:none!important}details p{margin:12px 0;overflow-wrap:anywhere}input,select{max-width:100%}</style><main><h1 class="font-black text-xl">Demo aislada</h1><p>Solo fixtures. Ninguna conexión a producción.</p>${form}<h2 class="font-black text-lg">Vista administrativa · fixtures</h2><p>8 de octubre de 2026 · WhatsApp: contacto ficticio</p><div id="demo-admin"></div></main><script src="../js/gestor-questionnaire.js"></script><script>
const localStorage={getItem:()=>null};
function toggleLoginMode(){document.getElementById('reg-status').textContent='Solicitud demo enviada. Decisión manual de Elizabeth.'}
const supabaseClient={from(){return {select(){return this},eq(){return this},maybeSingle:async()=>({data:null,error:null}),insert:async rows=>{document.getElementById('demo-admin').append(PTHQuestionnaire.render(document,rows[0].questionnaire));return {error:null}}}};
${source.slice(start,end)}
PTHQuestionnaire.sync(document);document.getElementById('demo-admin').append(PTHQuestionnaire.render(document,null));</script></html>`;
fs.mkdirSync(path.join(root,'evidence'),{recursive:true});
fs.writeFileSync(path.join(root,'evidence/questionnaire-demo.html'),demo);
