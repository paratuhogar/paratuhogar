// Opt-in component. Backend configuration controls availability.
export function capability(env=window){
 if(!env.isSecureContext)return 'Abre la web con una conexión HTTPS segura.';
 const nav=env.navigator,ios=/iPad|iPhone|iPod/.test(nav.userAgent||'')||(nav.platform==='MacIntel'&&nav.maxTouchPoints>1);
 if(ios&&!nav.standalone&&!env.matchMedia?.('(display-mode: standalone)').matches)return 'En iPhone o iPad, añade ParaTuHogar a la pantalla de inicio y ábrela desde ese icono. Necesitas una versión compatible (iOS/iPadOS 16.4 o posterior).';
 if(!nav.serviceWorker||!env.PushManager||!env.Notification)return 'Este navegador no ofrece notificaciones push. Prueba un navegador compatible en PC o Android, o la web instalada en iPhone/iPad.';
 if(env.Notification.permission==='denied')return 'Las notificaciones están bloqueadas. Puedes cambiar el permiso en los ajustes del navegador.';
 return '';
}
function keyBytes(value){
 if(typeof value!=='string'||!/^[A-Za-z0-9_-]{87}$/.test(value))throw Error('Configuración no disponible.');
 const bytes=Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='),c=>c.charCodeAt(0));
 if(bytes.length!==65||bytes[0]!==4)throw Error('Configuración no disponible.');return bytes;
}
export async function mountAdminPush(host,adapter,env=window){
 host.replaceChildren();const doc=host.ownerDocument;
 const node=(tag,text)=>{const n=doc.createElement(tag);n.textContent=text;return n;};
 host.append(node('h3','Notificaciones de administración'),node('p','Recibe avisos de pedidos nuevos y mejoras que tu cuenta tenga permiso para revisar. No mostraremos nombres ni datos de clientes en la notificación.'));
 const status=node('p','Comprobando disponibilidad…');status.setAttribute('role','status');status.setAttribute('aria-live','polite');host.append(status);
 const choices=node('fieldset',''),legend=node('legend','¿Qué avisos quieres recibir en este dispositivo?');choices.append(legend);host.append(choices);
 const enable=node('button','Activar notificaciones'),disable=node('button','Desactivar en este dispositivo');enable.type=disable.type='button';enable.disabled=true;disable.hidden=true;host.append(enable,disable);
 const pilot=node('button','Enviar aviso de prueba');pilot.type='button';pilot.hidden=true;host.append(pilot);
 for(const button of [enable,disable])button.style.cssText='min-height:46px;padding:12px 18px;margin:8px 8px 8px 0;border:1px solid #1a4789;border-radius:12px;background:#1a4789;color:white;font:inherit';
 choices.style.cssText='border:0;padding:8px 0';host.style.cssText='padding:24px;border:1px solid #dce5ef;border-radius:24px;background:#fff;color:#203651;font:15px/1.6 system-ui;max-width:760px';
 let config,busy=false,disposed=false,subscription=null;const originalScope=adapter.scope();
 const current=()=>!disposed&&originalScope===adapter.scope();
 const controls=[];
 const reset=()=>{disposed=true;choices.replaceChildren();enable.disabled=true;disable.hidden=true;pilot.hidden=true;status.textContent='La sesión cambió. Vuelve a abrir esta sección.';};
 const sessionChanged=()=>{if(!current())reset();};
 env.addEventListener?.('storage',sessionChanged);env.addEventListener?.('pth:session-changed',sessionChanged);
 const cleanup=()=>{disposed=true;env.removeEventListener?.('storage',sessionChanged);env.removeEventListener?.('pth:session-changed',sessionChanged);};
 disable.onclick=async()=>{
  if(busy||!current()||!subscription)return;busy=true;disable.disabled=true;let removed=false,stopped=false;
  try{await adapter.remove(subscription.endpoint);removed=true;}catch(_){}
  try{stopped=await subscription.unsubscribe();}catch(_){}
  if(current()){status.textContent=removed&&stopped?'Notificaciones desactivadas.':'No se pudo confirmar toda la desactivación. Reintenta o bloquea el permiso desde el navegador.';disable.hidden=removed&&stopped;if(removed&&stopped)pilot.hidden=true;}
  busy=false;disable.disabled=false;
 };
 try{
  config=await adapter.config();if(!current()){reset();return cleanup;}
  // Read only: paused delivery must still let this browser unsubscribe.
  subscription=await adapter.existing?.()||null;if(!current()){reset();return cleanup;}
  if(subscription)disable.hidden=false;
  if(config?.enabled!==true){
   const ready=config?.readiness;
   const reason=ready?[
    ['deliveryReady','El servicio de notificaciones todavía se está preparando.'],
    ['switchOn','El interruptor de notificaciones sigue apagado en el servidor.'],
    ['publicKeyValid','El servidor no reconoce la clave pública de notificaciones guardada.'],
    ['privateKeyValid','El servidor no reconoce la clave privada de notificaciones guardada.'],
    ['dispatchSecretValid','El servidor no reconoce el secreto de envío guardado.'],
    ['subjectValid','La identificación del servicio no coincide con la de ParaTuHogar.'],
   ].find(([key])=>ready[key]===false)?.[1]:null;
   status.textContent=reason||'Las notificaciones aún no están habilitadas. Puedes seguir revisando el panel.';return cleanup;
  }
  const reason=capability(env);if(reason){status.textContent=reason;return cleanup;}
  keyBytes(config.publicKey);
  for(const [kind,label] of [['orders','Pedidos nuevos'],['suggestions','Mejoras nuevas']])if(config.allowedTopics?.includes(kind)){
   const wrap=node('label',''),input=node('input','');input.type='checkbox';input.value=kind;input.style.marginRight='10px';wrap.style.cssText='display:block;min-height:44px;padding:8px 0';wrap.append(input,doc.createTextNode(label));choices.append(wrap);controls.push(input);
  }
  if(!controls.length){status.textContent='Tu cuenta no tiene avisos disponibles.';return cleanup;}
  status.textContent='Elige los avisos y pulsa Activar. El navegador te pedirá permiso; tú decides si lo concedes.';
  enable.disabled=false;
  // Read an existing registration only; never install/subscribe during mount.
  if(subscription){
   const saved=await adapter.status(subscription.endpoint);if(!current()){reset();return cleanup;}
   if(saved.active){controls.forEach(input=>input.checked=saved.topics.includes(input.value));pilot.hidden=false;status.textContent='Este dispositivo tiene avisos activados para tu sesión. Puedes cambiar los tipos o enviar una prueba.';}
   else status.textContent='Hay una suscripción anterior en este navegador. Desactívala aquí antes de volver a activar los avisos.';
  }
 }catch(_){status.textContent='No se pudo comprobar el servicio. Vuelve a abrir la sección para reintentar.';return cleanup;}
 enable.onclick=async()=>{
  if(busy||!current())return;
  const topics=controls.filter(n=>n.checked).map(n=>n.value);if(!topics.length){status.textContent='Elige al menos un tipo de aviso.';return;}
  busy=true;enable.disabled=true;let created=false;
  try{
   // First async operation is the user-initiated browser prompt. Never on mount.
   const permission=await env.Notification.requestPermission();
   if(permission!=='granted'){status.textContent=permission==='denied'?'Permiso bloqueado. Puedes cambiarlo en los ajustes del navegador.':'No se activaron las notificaciones.';return;}
   if(!current())throw Error('session');
   const registration=await adapter.registration();if(!current())throw Error('session');
   subscription=await registration.pushManager.getSubscription();
   if(!subscription){subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(config.publicKey)});created=true;}
   if(!current())throw Error('session');
   await adapter.save({subscription:subscription.toJSON(),topics});
   if(!current())throw Error('session');
   status.textContent='Notificaciones activadas en este dispositivo para tu sesión actual.';disable.hidden=false;pilot.hidden=false;
  }catch(_){if(created&&subscription)await subscription.unsubscribe().catch(()=>{});status.textContent=current()?'No se completó la activación. Puedes volver a intentarlo.':'La sesión cambió. No se confirmó la activación.';}
  finally{busy=false;enable.disabled=!current()||env.Notification.permission==='denied';}
 };
 pilot.onclick=async()=>{
  if(busy||!current()||!subscription)return;busy=true;pilot.disabled=true;
  try{await adapter.pilot(subscription.endpoint);if(current())status.textContent='Prueba enviada al servicio de notificaciones. Comprueba si aparece en tu dispositivo.';}
  catch(_){if(current())status.textContent='No se pudo enviar la prueba. Puedes volver a intentarlo.';}
  finally{busy=false;pilot.disabled=false;}
 };
 return cleanup;
}
