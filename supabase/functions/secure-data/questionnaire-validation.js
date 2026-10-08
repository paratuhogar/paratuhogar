/* Shared browser/server validation; answers are rendered only as text. */
(function(root){
 'use strict';
 const options={source:['facebook','whatsapp','recomendacion','otro'],referrerGestor:['si','no','no_se'],experience:['si','no'],clients:['0','1-10','11-30','31-100','100+'],channels:['si','no']};
 function validate(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Completa el cuestionario.');
  const out={version:1};
  const text=(key,max=300,required=false)=>{const value=input[key]??'';if(typeof value!=='string'||value.length>max)throw Error('Revisa la respuesta: '+key);const result=value.trim();if(required&&!result)throw Error('Completa la respuesta: '+key);return result;};
  const choice=key=>{if(!options[key].includes(input[key]))throw Error('Selecciona una opción: '+key);return input[key];};
  for(const key of ['source','experience','clients','channels'])out[key]=choice(key);
  out.sourceOther=out.source==='otro'?text('sourceOther',150,true):'';
  out.referrer=out.source==='recomendacion'?text('referrer',100):'';
  out.referrerGestor=out.source==='recomendacion'?choice('referrerGestor'):'';
  out.experienceMonths=null;
  if(out.experience==='si'){const n=input.experienceMonths;if(n===''||n==null||!Number.isInteger(Number(n))||Number(n)<0||Number(n)>1200)throw Error('Indica el tiempo de experiencia en meses.');out.experienceMonths=Number(n);}
  if(!Array.isArray(input.platforms)||input.platforms.length>6||input.platforms.some(p=>!['Facebook','WhatsApp','Instagram','TikTok','Telegram','Otra'].includes(p)))throw Error('Revisa las plataformas.');
  out.platforms=[...new Set(input.platforms)];
  out.loyalty=text('loyalty',300,out.clients!=='0');
  out.channelNames=out.channels==='si'?text('channelNames',300,true):'';
  out.channelSize=out.channels==='si'?text('channelSize',100,true):'';
  const count=input.storesCount;
  if(count===''||count==null||!Number.isInteger(Number(count))||Number(count)<0||Number(count)>1000)throw Error('Indica cuántas otras tiendas (0 si ninguna).');
  out.storesCount=Number(count);out.storeNames=out.storesCount?text('storeNames',300,true):'';
  return out;
 }
 function read(document){
  const value=key=>document.getElementById('q-'+key).value;
  return validate(Object.fromEntries([...Object.keys(options),'sourceOther','referrer','experienceMonths','loyalty','channelNames','channelSize','storesCount','storeNames'].map(k=>[k,value(k)]).concat([['platforms',Array.from(document.querySelectorAll('[name="q-platform"]:checked'),el=>el.value)]])));
 }
 function sync(document){
  for(const [id,visible] of [['referral',document.getElementById('q-source').value==='recomendacion'],['other',document.getElementById('q-source').value==='otro'],['time',document.getElementById('q-experience').value==='si'],['channels',document.getElementById('q-channels').value==='si'],['stores',Number(document.getElementById('q-storesCount').value)>0]]){
   const el=document.getElementById('q-block-'+id);el.hidden=!visible;for(const field of el.querySelectorAll('input,select,textarea'))field.disabled=!visible;
  }
 }
 function render(document,answers){
  const box=document.createElement('details'),summary=document.createElement('summary');summary.textContent=answers?'Respuestas del cuestionario':'Solicitud anterior al cuestionario';box.append(summary);
  if(!answers)return box;
  let q;try{q=validate(answers);}catch{const note=document.createElement('p');note.textContent='Cuestionario no disponible. Revisar manualmente.';box.append(note);return box;}
  const label=(key,v)=>({facebook:'Facebook',whatsapp:'WhatsApp',recomendacion:'Recomendación',otro:'Otro',si:'Sí',no:'No',no_se:'No sé'})[v]||v;
  const groups=[['Cómo conoció ParaTuHogar',label('source',q.source)+(q.sourceOther?' · '+q.sourceOther:'')],['Recomendación',q.source==='recomendacion'?(q.referrer||'Prefiere no identificar al referente')+' · ¿Es gestor? '+label('',q.referrerGestor):'No aplica'],['Experiencia en ventas por redes',q.experience==='si'?q.experienceMonths+' meses':'Sin experiencia'],['Plataformas',q.platforms.join(', ')||'Ninguna indicada'],['Clientes habituales y fidelización',q.clients+' · '+(q.loyalty||'Sin clientes habituales todavía')],['Grupos o canales',q.channels==='si'?q.channelNames+' · Tamaño aproximado: '+q.channelSize:'Ninguno'],['Otras tiendas',q.storesCount+' · '+(q.storeNames||'Ninguna')]];
  for(const [title,value] of groups){const p=document.createElement('p'),strong=document.createElement('strong');strong.textContent=title+': ';p.append(strong,document.createTextNode(value));box.append(p);}
  return box;
 }
 root.PTHQuestionnaire={validate,read,sync,render};
})(globalThis);
