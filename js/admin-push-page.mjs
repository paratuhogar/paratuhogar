import {mountAdminPush} from './admin-push.mjs?v=20261001-push1';
import {adminPushRegistration} from './admin-push-registration.mjs?v=20261001-push1';
const host=document.getElementById('push-settings');
try{
 const profile=await PTHSecureData.restore();
 if(!profile?.id||profile.parent_id||!['admin','administrador','superadmin','logistica'].includes(String(profile.rol).toLowerCase()))throw Error('Entra con tu cuenta de administración para configurar los avisos.');
 const token=PTHSecureData.token();
 async function request(body){
  if(PTHSecureData.token()!==token)throw Error('La sesión cambió.');
  const result=await PTHSecureData.push(body);
  if(PTHSecureData.token()!==token)throw Error('La sesión cambió.');
  if(result.error)throw Error(result.error.message);return result.data;
 }
 const cleanup=await mountAdminPush(host,{
  scope:()=>PTHSecureData.token(),config:()=>request({operation:'config'}),
  existing:async()=>{const registration=await navigator.serviceWorker.getRegistration('/');return registration?.pushManager.getSubscription();},
  registration:()=>adminPushRegistration(navigator.serviceWorker),
  status:endpoint=>request({operation:'status',endpoint}),
  save:body=>request({operation:'save',...body}),
  remove:endpoint=>request({operation:'remove',endpoint}),
  pilot:endpoint=>request({operation:'pilot',endpoint}),
 });
 window.addEventListener('pagehide',cleanup,{once:true});
}catch(error){host.textContent=error.message||'No se pudo abrir la configuración. Vuelve a intentarlo.';}
