import {mountAdminPush} from './admin-push.mjs?v=20261002-lowdata1';
import {adminPushRegistration} from './admin-push-registration.mjs?v=20261002-fasttools1';
const host=document.getElementById('push-settings');
try{
 let timer,profile;
 try{profile=await Promise.race([PTHSecureData.restore(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('No se pudo verificar tu sesión a tiempo. Pulsa «Volver a comprobar».')),15000);})]);}finally{clearTimeout(timer);}
 if(!profile?.id||profile.parent_id||!['admin','administrador','superadmin','logistica'].includes(String(profile.rol).toLowerCase()))throw Error('Entra con tu cuenta de administración para configurar los avisos.');
 const token=PTHSecureData.token();
 async function request(body){
  if(PTHSecureData.token()!==token)throw Error('La sesión cambió.');
  const result=await PTHSecureData.push(body);
  if(PTHSecureData.token()!==token)throw Error('La sesión cambió.');
  if(result.error)throw Error(result.error.message);return result.data;
 }
 const cleanup=await mountAdminPush(host,{
  retry:()=>location.reload(),scope:()=>PTHSecureData.token(),config:()=>request({operation:'config'}),
  existing:async()=>{if(!navigator.serviceWorker?.getRegistration)return null;const registration=await navigator.serviceWorker.getRegistration('/');return registration?.pushManager.getSubscription();},
  registration:()=>adminPushRegistration(navigator.serviceWorker),
  status:endpoint=>request({operation:'status',endpoint}),
  save:body=>request({operation:'save',...body}),
  remove:endpoint=>request({operation:'remove',endpoint}),
  pilot:endpoint=>request({operation:'pilot',endpoint}),
 });
 window.addEventListener('pagehide',cleanup,{once:true});
}catch(error){
 host.replaceChildren();const message=document.createElement('p');message.setAttribute('role','status');message.textContent=error.message||'No se pudo abrir la configuración. Vuelve a intentarlo.';
 const retry=document.createElement('button');retry.type='button';retry.textContent='Volver a comprobar';retry.onclick=()=>location.reload();host.append(message,retry);
}
