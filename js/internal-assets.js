/* Optional tools are fetched only when used; startup never waits on their CDNs. */
(function(root){
 'use strict';
 const pending=new Map();
 const definitions={
  studio:[['style','css/content-studio.css?v=20261002-studio1','pth-content-studio-css'],['script','js/studio-designs.js?v=20261002-studio4','pth-studio-designs-js'],['script','js/studio-jobs.js?v=20261002-studio3','pth-studio-jobs-js'],['script','js/content-studio.js?v=20261002-studio1','pth-content-studio-js']],
  charts:[['script','https://cdn.jsdelivr.net/npm/chart.js','pth-chart-js']],
  xlsx:[['script','https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js','pth-xlsx-js']],
  zip:[['script','https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js','pth-jszip-js']],
  pdf:[['script','https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js','pth-jspdf-js'],['script','https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js','pth-jspdf-autotable-js']],
  qr:[['script','https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js','pth-qrcode-js']],
  editor:[['style','https://cdn.quilljs.com/1.3.6/quill.snow.css','pth-quill-css'],['script','https://cdn.quilljs.com/1.3.6/quill.js','pth-quill-js']],
  traffic:[['script','admin-stats.js?v=20261002-admin1','pth-admin-stats-js']],
  session:[['script','subgestor-tutorial.js?v=20261001-fast1','pth-subgestor-tutorial-js'],['script','js/client-followup.js?v=20261001-fast1','pth-client-followup-js']]
 };
 function resource([kind,url,id]){
  if(pending.has(id))return pending.get(id);
  const existing=document.getElementById(id);
  if(existing?.dataset.loaded==='true')return Promise.resolve();
  const promise=new Promise((resolve,reject)=>{
   const node=document.createElement(kind==='style'?'link':'script');node.id=id;
   // Product details change the document URL with pushState. Local tools still
   // live at the site root, independently of the currently open product.
   const assetURL=new URL(url,new URL('/',document.baseURI)).href;
   if(kind==='style'){node.rel='stylesheet';node.href=assetURL;}else{node.src=assetURL;node.async=true;}
   const timer=setTimeout(()=>finish(Error('La herramienta tardó demasiado en cargar.')),8000);
   const finish=error=>{clearTimeout(timer);node.onload=node.onerror=null;if(error){node.remove();pending.delete(id);reject(error);}else{node.dataset.loaded='true';resolve();}};
   node.onload=()=>finish();node.onerror=()=>finish(Error('No se pudo cargar la herramienta.'));
   document.head.appendChild(node);
  });pending.set(id,promise);return promise;
 }
 async function load(name){
  const resources=definitions[name];if(!resources)throw Error('Herramienta desconocida.');
  // PDF plugin requires its core; all other downloads are independent.
  if(name==='pdf'||name==='studio'){for(const item of resources)await resource(item);}else await Promise.all(resources.map(resource));
 }
 async function ensure(name){try{await load(name);return true;}catch(error){root.alert(error.message+' Comprueba la conexión y vuelve a intentarlo.');return false;}}
 function scheduleSession(){const token=root.PTHSecureData?.token();const run=()=>{if(token&&token===root.PTHSecureData?.token())load('session').catch(error=>console.warn(error.message));};if(root.requestIdleCallback)root.requestIdleCallback(run,{timeout:2500});else setTimeout(run,250);}
 root.PTHAssets={load,ensure,scheduleSession};
})(window);
