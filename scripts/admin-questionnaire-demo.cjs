// Isolated administration fixture: actual pending-list markup and renderer, no SDK/network.
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const section=html.slice(html.indexOf('<div id="cnt-aprobaciones"'),html.indexOf('    <!-- BLOQUE 2: ACTIVOS -->'));
const source=fs.readFileSync(path.join(root,'js/storefront-extras.js'),'utf8');
const renderer=source.slice(source.indexOf('let pendingGestoresCache'),source.indexOf('async function loadPendingGestores()'));
const answer={version:1,source:'recomendacion',referrer:'',referrerGestor:'no_se',experience:'no',platforms:['WhatsApp'],clients:'0',loyalty:'',channels:'no',storesCount:2,storeNames:'Tienda Demo A, Tienda Demo B'};
const demo=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';script-src 'self' 'unsafe-inline';style-src 'self' 'unsafe-inline';connect-src 'none'"><title>Administración · respuestas por solicitud · fixtures</title><link rel="stylesheet" href="../css/tailwind.min.css"><link rel="stylesheet" href="../css/admin-panel.css"><style>body{padding:24px;color:#172554;background:#f8fafc}main{max-width:1100px;margin:auto}details p{padding:8px;overflow-wrap:anywhere}summary{cursor:pointer;font-weight:700;padding:8px}</style></head><body><main><h1>Administración · demo aislada</h1><p>Datos ficticios; sin sesión, SDK, conexión ni decisiones reales.</p><button class="admin-control" id="tab-aprobaciones" onclick="openPendingGestorReview()">Solicitudes de gestores</button>${section}</div></main><script src="../js/admin-panel-data.js"></script><script src="../js/gestor-questionnaire.js"></script><script>
${renderer}
function changeAdminTab(){document.getElementById('cnt-aprobaciones').classList.remove('hidden')}
function approveGestorOnly(){throw Error('Decisiones deshabilitadas en fixture')}
function approveGestor(){throw Error('Decisiones deshabilitadas en fixture')}
function loadPendingGestores(){renderPendingGestores()}
pendingGestoresCache=[{id:'old-fixture',nombre:'Solicitud antigua demo',telefono:'contacto ficticio',estado:'pendiente',created_at:'2026-07-01T12:00:00Z'},{id:'new-fixture',nombre:'Solicitante demo con encuesta',telefono:'WhatsApp ficticio',estado:'pendiente',created_at:'2026-10-08T12:00:00Z',questionnaire:${JSON.stringify(answer)}}];
renderPendingGestores();document.querySelectorAll('#list-admin-aprobaciones button').forEach(b=>{if(b.textContent!=='Ver respuestas')b.disabled=true});
</script></body></html>`;
fs.writeFileSync(path.join(root,'evidence/admin-questionnaire-demo.html'),demo);
