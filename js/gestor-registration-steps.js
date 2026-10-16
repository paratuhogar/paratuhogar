/* Presentation only: no storage, requests or changes to the shared validator. */
(function(root){
 'use strict';
 let initialized=false,refresh;
 function init(){
  if(localStorage.getItem('pth_invitado_por_id')||new URLSearchParams(location.search).get('invitado_por'))return;
  if(initialized){refresh();return;}
  const form=document.getElementById('form-register'),q=document.getElementById('gestor-questionnaire');
  if(!form||!q)return;
  initialized=true;
  const titles=['Tu contacto','Cómo nos conociste','Tu experiencia y clientes','Canales y otras tiendas','Revisa tu solicitud'];
  const groups=[];
  function group(parent,start,end){
   const box=document.createElement('section');box.className='space-y-4';
   parent.insertBefore(box,start);
   let node=start;while(node&&node!==end){const next=node.nextSibling;box.append(node);node=next;}
   groups.push(box);
  }
  group(form,document.getElementById('reg-name'),q);
  const origin=document.getElementById('q-source').closest('label');
  const experience=document.getElementById('q-experience').closest('label');
  const channels=document.getElementById('q-channels').closest('label');
  group(q,origin,experience);group(q,experience,channels);group(q,channels,null);
  const review=document.createElement('section');review.className='space-y-4';q.after(review);groups.push(review);
  const progress=document.createElement('h3');progress.className='font-black text-lg';progress.tabIndex=-1;form.prepend(progress);
  const nav=document.createElement('div');nav.className='flex gap-3';review.after(nav);
  function button(text){const b=document.createElement('button');b.type='button';b.textContent=text;b.className='flex-1 bg-gray-900 text-white p-3 rounded-xl font-bold';nav.append(b);return b;}
  const back=button('Anterior'),next=button('Continuar'),submit=document.getElementById('reg-submit'),status=document.getElementById('reg-status');
  let step=0;
  const defaults={source:'facebook',sourceOther:'',referrer:'',referrerGestor:'no_se',experience:'no',experienceMonths:'',clients:'0',loyalty:'',channels:'no',channelNames:'',channelSize:'',storesCount:'0',storeNames:''};
  function validateThrough(index){
   if(!['reg-name','reg-tel','reg-pass'].every(id=>document.getElementById(id).value.trim()))throw Error('Nombre, Teléfono y Contraseña son obligatorios.');
   const proxy={getElementById(id){const actual=document.getElementById(id);if(!id.startsWith('q-'))return actual;
    const owner=groups.findIndex(box=>box.contains(actual));return owner<=index?actual:{value:defaults[id.slice(2)]};},querySelectorAll:selector=>document.querySelectorAll(selector)};
   return PTHQuestionnaire.read(proxy);
  }
  function show(focus=true){
   groups.forEach((box,i)=>{box.hidden=i!==step;});
   q.hidden=step===0||step===4;
   progress.textContent=`Paso ${step+1} de 5 · ${titles[step]}`;
   back.hidden=step===0;next.hidden=step===4;submit.hidden=step!==4;
   submit.textContent='Enviar solicitud para revisión';status.textContent='';
   if(focus)progress.focus();
  }
  back.onclick=()=>{step--;show();};
  next.onclick=()=>{
   try{
    const answers=validateThrough(step);
    if(step===3){
     const contact=document.createElement('p');contact.textContent=`${document.getElementById('reg-name').value.trim()} · WhatsApp: ${document.getElementById('reg-tel').value.trim()} · Correo: ${document.getElementById('reg-email').value.trim()||'Sin indicar'}`;
     const note=document.createElement('p');note.textContent='Elizabeth revisará tus respuestas y decidirá personalmente. Puedes volver para corregirlas antes de enviar.';
     const rendered=PTHQuestionnaire.render(document,answers);rendered.open=true;review.replaceChildren(contact,rendered,note);
    }
    step++;show();
   }catch(error){status.textContent=error.message;}
  };
  refresh=()=>show(false);
  show(false);
 }
 root.PTHRegistrationSteps={init};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(globalThis);
