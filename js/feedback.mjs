const $=id=>document.getElementById(id);
const form=$('feedback-form');
let rows=[],owner=false,next=null,busy=false,imageBusy=false,screenshot=null,requestId=crypto.randomUUID(),dirty=false;
let generation=0;
const sessionToken=window.PTHSecureData.token();
const stateLabels={nuevo:'Nuevo',en_revision:'En revisión',pendiente_informacion:'Necesita más información',planificado:'Planificado',resuelto:'Resuelto',descartado:'No se realizará',duplicado:'Agrupado con otro reporte'};
const statuses=['nuevo','en_revision','pendiente_informacion','planificado','resuelto','descartado','duplicado'];
const knownPages=new Set(['/','/index.html','/subgestores.html','/gestores.html','/studio.html','/master.html']);
let page='/feedback.html';
try{const ref=new URL(document.referrer);if(ref.origin===location.origin&&knownPages.has(ref.pathname))page=ref.pathname;}catch{}
$('page-label').textContent='Guardamos automáticamente la página desde la que llegaste y la fecha del envío. No hace falta que las escribas.';
const message=text=>{$('message').textContent=text;};
function clearPrivate(){generation++;rows=[];screenshot=null;form.reset();$('preview').removeAttribute('src');$('reports').replaceChildren();$('private').hidden=true;dirty=false;}
async function api(body){
 if(sessionToken!==PTHSecureData.token()){clearPrivate();throw Error('La sesión cambió. Vuelve a entrar.');}
 const result=await PTHSecureData.feedback(body);
 if(sessionToken!==PTHSecureData.token()){clearPrivate();throw Error('Tu sesión venció o cambió. Vuelve a entrar.');}
 if(result.error)throw Error(result.error.message);
 return result.data;
}
function element(tag,text){const node=document.createElement(tag);node.textContent=text;return node;}
function field(label,value,options){const wrap=element('label',label),input=document.createElement(options?'select':'textarea');if(options)for(const option of options){const el=element('option',stateLabels[option]||option.replaceAll('_',' '));el.value=option;input.append(el);}input.value=value||'';wrap.append(input);return {wrap,input};}
function render(){
 $('reports').replaceChildren();
 const search=$('search').value.toLocaleLowerCase();
 const counts={};for(const row of rows)counts[row.status]=(counts[row.status]||0)+1;
 $('summary').textContent=`${rows.length} envíos cargados${next!==null?' (hay más)':''}. `+Object.entries(counts).map(([state,n])=>`${stateLabels[state]||state}: ${n}`).join(' · ');
 for(const row of rows.filter(r=>[r.title,r.need,r.workflow,r.benefit].some(v=>v.toLocaleLowerCase().includes(search)))){
  const article=element('article','');article.append(element('h3',`${row.kind==='problema'?'Problema':'Mejora'} · ${row.title}`),element('p',`${stateLabels[row.status]||row.status} · ${new Date(row.created_at).toLocaleString('es',{timeZone:'America/Havana'})} (Cuba) · ${row.page}`),element('p',`Referencia: ${row.id}`),element('p',`${row.kind==='problema'?'Qué querías hacer':'Qué te gustaría poder hacer'}: ${row.need}`),element('p',`${row.kind==='problema'?'Qué ocurrió':'Cómo lo haces ahora'}: ${row.workflow}`));
  if(row.benefit)article.append(element('p',`Beneficio esperado: ${row.benefit}`));
  if(row.response)article.append(element('p',`Respuesta: ${row.response}`));
  const imageButton=element('button','Ver captura privada');imageButton.type='button';
  imageButton.onclick=async()=>{imageButton.disabled=true;try{const data=await api({operation:'screenshot',id:row.id});if(data.screenshot){const image=document.createElement('img');image.alt='Captura adjunta al reporte';image.src=data.screenshot;article.append(image);imageButton.remove();}else imageButton.textContent='Sin captura';}catch(e){message(e.message);imageButton.disabled=false;}};
  article.append(imageButton);
  if(owner){
   const details=element('details','');details.append(element('summary','Clasificar / responder'));
   const state=field('Estado',row.status,statuses),priority=field('Prioridad',row.priority,['baja','normal','alta']),response=field('Respuesta visible para el gestor',row.response),note=field('Nota privada: beneficio, esfuerzo, riesgos y recomendación',row.owner_note),duplicate=field('Referencia original (solo si es duplicado)',row.duplicate_of);
   response.input.maxLength=2000;note.input.maxLength=4000;duplicate.input.maxLength=36;
   for(const item of [state,priority,response,note,duplicate])details.append(item.wrap);
   const save=element('button','Guardar revisión');save.type='button';save.onclick=async()=>{save.disabled=true;try{await api({operation:'triage',id:row.id,revision:row.revision,status:state.input.value,priority:priority.input.value,response:response.input.value,owner_note:note.input.value,duplicate_of:duplicate.input.value.trim()||null});await load();message('Revisión guardada.');}catch(e){message(e.message);}finally{save.disabled=false;}};details.append(save);article.append(details);
  }
  $('reports').append(article);
 }
 if(!rows.length)$('reports').append(element('p','Todavía no hay envíos.'));
 $('more').hidden=next===null;
}
async function load(append=false){const current=++generation;$('refresh').disabled=true;$('more').disabled=true;try{const data=await api({operation:'list',offset:append?next:0});if(current!==generation)return;rows=append?[...rows,...data.rows.filter(r=>!rows.some(old=>old.id===r.id))]:data.rows;owner=data.owner;next=data.next;$('list-title').textContent=owner?'Revisión de reportes y mejoras':'Mis envíos';$('list-help').textContent=owner?'Consulta los envíos, responde y actualiza su estado. Las notas privadas solo aparecen en esta vista de revisión.':'Aquí verás el estado de lo que enviaste y las respuestas. Las ideas se revisan antes de decidir si se pueden hacer.';render();}finally{$('refresh').disabled=false;$('more').disabled=false;}}
$('refresh').onclick=()=>load().catch(e=>message(e.message));$('more').onclick=()=>load(true).catch(e=>message(e.message));$('search').oninput=render;
form.elements.kind.onchange=()=>{
 const improvement=form.elements.kind.value==='mejora';
 $('kind-guide-title').textContent=improvement?'Una idea para trabajar más fácil o vender más':'Cuando algo no funciona como esperabas';
 $('kind-guide-text').textContent=improvement?'Cuéntanos qué te gustaría poder hacer, cómo lo resuelves hoy y qué ganarías con el cambio. Las ideas se revisan antes de decidir si se pueden hacer.':'Cuéntanos qué querías hacer y qué salió mal. Por ejemplo: un botón no responde o una página no termina de cargar.';
 $('title-help').textContent=improvement?'Resume tu idea en una frase para encontrarla fácilmente.':'Resume el problema en una frase para encontrarlo fácilmente.';
 form.elements.title.placeholder=improvement?'Ej.: Compartir varias ofertas de una sola vez':'Ej.: No puedo copiar el enlace de mi tienda';
 $('need-label').textContent=improvement?'¿Qué te gustaría poder hacer?':'¿Qué intentabas hacer?';
 $('need-help').textContent=improvement?'Explica qué necesitas para hacer tu trabajo más fácil. Puedes describir la idea aunque no sepas cómo construirla.':'Explica qué querías conseguir y en qué parte de la web estabas.';
 form.elements.need.placeholder=improvement?'Ej.: Me gustaría elegir varias ofertas y compartirlas juntas.':'Ej.: Quería copiar el enlace para compartir mi tienda.';
 $('workflow-label').textContent=improvement?'¿Cómo lo haces ahora?':'¿Qué pasó en realidad?';
 $('workflow-help').textContent=improvement?'Cuenta cómo resuelves esa tarea hoy y qué parte te resulta lenta o difícil.':'Cuenta los pasos que seguiste y qué ocurrió. Si apareció un mensaje, escríbelo sin datos privados.';
 form.elements.workflow.placeholder=improvement?'Ej.: Hoy tengo que abrir cada producto y copiar su enlace uno por uno.':'Ej.: Pulsé «Copiar enlace», pero no apareció la confirmación.';
 $('benefit-wrap').hidden=!improvement;form.elements.benefit.required=improvement;
 $('submit').textContent=improvement?'Enviar mejora':'Enviar problema';
};
form.oninput=()=>{dirty=true;};
function removeImage(){screenshot=null;$('preview').hidden=true;$('preview').removeAttribute('src');$('remove-image').hidden=true;$('screenshot').value='';}
$('remove-image').onclick=removeImage;
$('screenshot').onchange=async()=>{const file=$('screenshot').files[0];removeImage();if(!file)return;imageBusy=true;$('submit').disabled=true;try{
 if(!['image/png','image/jpeg'].includes(file.type)||file.size>5*1024*1024)throw Error('Selecciona una imagen PNG o JPEG de hasta 5 MB.');
 const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');const scale=Math.min(1,1000/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 let data=canvas.toDataURL('image/png');while(data.length>110000&&canvas.width>240){const copy=document.createElement('canvas');copy.width=Math.round(canvas.width*.75);copy.height=Math.round(canvas.height*.75);copy.getContext('2d').drawImage(canvas,0,0,copy.width,copy.height);canvas.width=copy.width;canvas.height=copy.height;canvas.getContext('2d').drawImage(copy,0,0);data=canvas.toDataURL('image/png');}
 if(data.length>110000)throw Error('Recorta la captura a la parte necesaria y vuelve a adjuntarla.');
 screenshot=data;$('preview').src=data;$('preview').hidden=false;$('remove-image').hidden=false;dirty=true;
}catch(e){message(e.message);}finally{imageBusy=false;$('submit').disabled=false;}};
form.onsubmit=async event=>{event.preventDefault();if(busy||imageBusy||!form.reportValidity())return;busy=true;$('submit').disabled=true;const controls=[...form.elements];controls.forEach(c=>c.disabled=true);message('Enviando…');try{
 const values=Object.fromEntries(['kind','title','need','workflow','benefit'].map(k=>[k,form.elements[k].value]));await api({operation:'create',id:requestId,...values,page,screenshot});
 requestId=crypto.randomUUID();form.reset();removeImage();form.elements.kind.onchange();dirty=false;message('Envío recibido. Puedes consultar su estado aquí.');await load();
}catch(e){message(e.message+' Si el envío quedó pendiente, usa Enviar otra vez; no se creará un duplicado.');}finally{busy=false;controls.forEach(c=>c.disabled=false);}};
window.addEventListener('beforeunload',event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}});
window.addEventListener('storage',event=>{if(event.key==='pth_secure_token'&&sessionToken!==PTHSecureData.token()){clearPrivate();message('La sesión cambió. Vuelve a entrar.');}});
try{const profile=await PTHSecureData.restore();if(!profile||profile.rol==='mensajero')throw Error('Entra como gestor desde ParaTuHogar para consultar esta sección.');$('private').hidden=false;await load();message('Sección privada.');}catch(e){message(e.message);}

window.addEventListener('pagehide',clearPrivate);
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
