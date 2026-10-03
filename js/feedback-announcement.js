/* Acknowledgements belong to the authenticated account, never browser storage. */
(function(root){
 'use strict';
 let dialog=null,observer=null,generation=0,activeToken=null,busy=false,previousFocus=null;
 const dismissed=new Set();
 function close(){
  generation++;observer?.disconnect();observer=null;activeToken=null;busy=false;
  if(dialog?.open)dialog.close();
  if(previousFocus?.isConnected)previousFocus.focus();
  previousFocus=null;
 }
 function mount(){
  if(dialog)return;
  dialog=document.createElement('dialog');dialog.id='feedback-announcement';
  dialog.setAttribute('aria-labelledby','feedback-announcement-title');
  dialog.setAttribute('aria-describedby','feedback-announcement-copy');
  // All markup and copy are static. Never interpolate reports or profile data.
  dialog.innerHTML=`<div class="feedback-announcement-card">
   <p class="feedback-announcement-eyebrow">Nuevo en tu panel</p>
   <h2 id="feedback-announcement-title" tabindex="-1">¿Algo no funciona o tienes una idea?</h2>
   <p id="feedback-announcement-copy">Ahora tienes <strong>“Problemas y mejoras”</strong>: un espacio para avisar de errores y proponer cambios que te ayuden a trabajar mejor y vender más. Cuéntanos qué pasó o qué necesitas. Podrás consultar el estado de tu envío y las respuestas desde esa misma sección.</p>
   <p id="feedback-announcement-status" role="status" aria-live="polite"></p>
   <div class="feedback-announcement-actions">
    <button type="button" data-announcement-action="open">Conocer la sección</button>
    <button type="button" data-announcement-action="acknowledge">Entendido</button>
   </div>
   <button type="button" data-announcement-action="later" hidden>Continuar por ahora</button>
  </div>`;
  dialog.addEventListener('keydown',event=>{
   if(event.key!=='Tab')return;
   const buttons=[...dialog.querySelectorAll('button')].filter(b=>!b.hidden&&!b.disabled);
   const first=buttons[0],last=buttons.at(-1);
   if(!first){event.preventDefault();return;}
   if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog.querySelector('h2'))){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('click',event=>{
   const action=event.target.closest('[data-announcement-action]')?.dataset.announcementAction;
   if(action==='later')close();else if(action)acknowledge(action);
  });
  document.body.append(dialog);
 }
 function setBusy(value){busy=value;dialog.querySelectorAll('.feedback-announcement-actions button').forEach(button=>button.disabled=value);}
 async function acknowledge(action){
  if(busy||!activeToken)return;
  const token=activeToken,current=generation;
  if(token!==root.PTHSecureData.token()){close();return;}
  setBusy(true);const status=dialog.querySelector('[role=status]');status.textContent='Guardando…';
  try{
   const result=await root.PTHSecureData.announcement({operation:'acknowledge'});
   if(current!==generation||token!==root.PTHSecureData.token())return;
   if(result.error||result.data?.acknowledged!==true)throw Error('save failed');
   close();if(action==='open')root.location.assign('feedback.html');
  }catch(_){
   if(current!==generation||token!==root.PTHSecureData.token())return;
   status.textContent='No se pudo confirmar que guardamos tu respuesta. Vuelve a pulsar un botón para intentarlo o continúa por ahora. El aviso podría aparecer otra vez.';
   dialog.querySelector('[data-announcement-action=later]').hidden=false;
  }finally{if(current===generation)setBusy(false);}
 }
 function otherNoticeOpen(){
  return ['login-overlay','pth-welcome','modal-welcome-agent','modal-intro-precios','modal-intro-radar'].some(id=>{
   const el=document.getElementById(id);return el&&!el.hidden&&getComputedStyle(el).display!=='none';
  });
 }
 async function show(){
  const token=root.PTHSecureData?.token();if(!token)return;
  if(activeToken===token)return;
  close();activeToken=token;const current=generation;
  try{
   const profile=await root.PTHSecureData.restore();
   if(current!==generation||token!==root.PTHSecureData.token())return;
   if(!profile?.id||profile.rol==='mensajero'||dismissed.has(profile.id)){close();return;}
   const ready=async()=>{
    if(current!==generation||token!==root.PTHSecureData.token())return;
    if(otherNoticeOpen())return;
    observer?.disconnect();observer=null;
    try{
     const result=await root.PTHSecureData.announcement({operation:'status'});
     if(current!==generation||token!==root.PTHSecureData.token())return;
     if(result.error||result.data?.acknowledged!==false){close();return;}
     mount();dismissed.add(profile.id);setBusy(false);
     dialog.querySelector('[role=status]').textContent='';
     dialog.querySelector('[data-announcement-action=later]').hidden=true;
     previousFocus=document.activeElement;dialog.showModal();dialog.querySelector('h2').focus();
    }catch(_){if(current===generation)close();}
   };
   if(otherNoticeOpen()){
    observer=new MutationObserver(()=>{if(!otherNoticeOpen())void ready();});
    observer.observe(document.body,{attributes:true,subtree:true,attributeFilter:['class','hidden','style','open']});
   }else await ready();
  }catch(_){if(current===generation)close();}
 }
 root.addEventListener('storage',event=>{if(event.key==='pth_secure_token')close();});
 root.addEventListener('pth:session-changed',close);
 root.addEventListener('pagehide',close);
 root.addEventListener('pageshow',event=>{if(event.persisted)void show();});
 root.PTHFeedbackAnnouncement={show,close};
})(window);
