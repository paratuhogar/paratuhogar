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
function bounded(promise,ms,message){
 let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error(message),{name:'PushTimeout'})),ms);})]).finally(()=>clearTimeout(timer));
}
export async function mountAdminPush(host,adapter,env=window,limits={}){
 const wait={config:15000,existing:8000,permission:60000,registration:25000,subscription:20000,save:20000,cleanup:5000,pilot:20000,remove:15000,...limits};
 host.replaceChildren();const doc=host.ownerDocument;
 const node=(tag,text)=>{const n=doc.createElement(tag);n.textContent=text;return n;};
 host.append(node('h3','Notificaciones de administración'),node('p','Recibe avisos de pedidos, mejoras o solicitudes de gestores según los permisos de tu cuenta. Cada dispositivo necesita su propia activación. No incluimos nombres ni datos personales en los avisos.'));
 const status=node('p','Comprobando disponibilidad…');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.style.cssText='padding:14px;border:1px solid #c6d8ef;border-radius:12px;background:#eaf2fc;color:#203651;line-height:1.6';host.append(status);
 const choices=node('fieldset',''),legend=node('legend','¿Qué avisos quieres recibir en este dispositivo?');choices.append(legend);choices.hidden=true;host.append(choices);
 const enable=node('button','Activar notificaciones'),disable=node('button','Desactivar en este dispositivo');enable.type=disable.type='button';enable.disabled=true;enable.hidden=true;disable.hidden=true;host.append(enable,disable);
 const pilot=node('button','Enviar aviso de prueba');pilot.type='button';pilot.hidden=true;host.append(pilot);
 const retry=node('button','Volver a comprobar');retry.type='button';retry.hidden=true;retry.onclick=()=>adapter.retry?.();host.append(retry);
 for(const button of [enable,disable,pilot,retry])button.style.cssText='min-height:46px;padding:12px 18px;margin:8px 8px 8px 0;border:1px solid #1a4789;border-radius:12px;background:#1a4789;color:white;font:inherit';
 choices.style.cssText='border:0;padding:8px 0';host.style.cssText='padding:24px;border:1px solid #dce5ef;border-radius:24px;background:#fff;color:#203651;font:15px/1.6 system-ui;max-width:760px';
 let config,busy=false,disposed=false,subscription=null;const originalScope=adapter.scope();
 const current=()=>!disposed&&originalScope===adapter.scope();
 const controls=[];let setupStage='config';
 const updateButtons=()=>{enable.disabled=busy||!current()||config?.enabled!==true||env.Notification?.permission==='denied';disable.disabled=pilot.disabled=retry.disabled=busy;for(const button of [enable,disable,pilot,retry]){button.style.cursor=button.disabled?'not-allowed':'pointer';button.setAttribute('aria-busy',String(busy&&!button.hidden));}};
 const reset=()=>{disposed=true;choices.replaceChildren();enable.disabled=true;disable.hidden=true;pilot.hidden=true;status.textContent='La sesión cambió. Vuelve a abrir esta sección.';updateButtons();};
 const sessionChanged=()=>{if(!current())reset();};
 env.addEventListener?.('storage',sessionChanged);env.addEventListener?.('pth:session-changed',sessionChanged);
 const cleanup=()=>{disposed=true;env.removeEventListener?.('storage',sessionChanged);env.removeEventListener?.('pth:session-changed',sessionChanged);};
 disable.onclick=async()=>{
  if(busy||!current()||!subscription)return;busy=true;updateButtons();status.textContent='Desactivando las notificaciones…';let removed=false,stopped=false;
  try{await bounded(adapter.remove(subscription.endpoint),wait.remove,'No se confirmó la desactivación en el servidor.');removed=true;}catch(_){}
  try{stopped=await bounded(subscription.unsubscribe(),wait.cleanup,'No se confirmó la desactivación en el navegador.');}catch(_){}
  if(current()){status.textContent=removed&&stopped?'Notificaciones desactivadas.':'No se pudo confirmar toda la desactivación. Reintenta o bloquea el permiso desde el navegador.';disable.hidden=removed&&stopped;if(removed&&stopped)pilot.hidden=true;}
  busy=false;updateButtons();
 };
 try{
  config=await bounded(adapter.config(),wait.config,'El servidor no respondió a tiempo. Pulsa «Volver a comprobar».');if(!current()){reset();return cleanup;}
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
   status.textContent=reason||'Las notificaciones aún no están habilitadas. Puedes seguir revisando el panel.';retry.hidden=false;
   // Do not delay the unavailable-service explanation for a browser lookup.
   try{subscription=await bounded(adapter.existing?.(),wait.existing,'Browser lookup unavailable')||null;if(current()&&subscription)disable.hidden=false;}catch(_){}
   updateButtons();return cleanup;
  }
  const reason=capability(env);if(reason){status.textContent=reason;retry.hidden=false;updateButtons();return cleanup;}
  try{keyBytes(config.publicKey);}catch(_){status.textContent='El servidor no devolvió una clave pública compatible. Vuelve a comprobar el servicio.';retry.hidden=false;updateButtons();return cleanup;}
  for(const [kind,label] of [['orders','Pedidos nuevos'],['suggestions','Mejoras nuevas'],['applications','Nuevas solicitudes de gestores']])if(config.allowedTopics?.includes(kind)){
   const wrap=node('label',''),input=node('input','');input.type='checkbox';input.value=kind;input.style.marginRight='10px';wrap.style.cssText='display:block;min-height:44px;padding:8px 0';wrap.append(input,doc.createTextNode(label));choices.append(wrap);controls.push(input);
  }
  if(!controls.length){status.textContent='Tu cuenta no tiene avisos disponibles.';retry.hidden=false;updateButtons();return cleanup;}
  setupStage='existing';choices.hidden=false;status.textContent='Servicio preparado. Comprobando este navegador…';
  subscription=await bounded(adapter.existing?.(),wait.existing,'El navegador no pudo comprobar las notificaciones. Cierra esta pestaña y vuelve a abrirla.')||null;if(!current()){reset();return cleanup;}
  if(subscription)disable.hidden=false;
  status.textContent='Elige los avisos y pulsa Activar. El navegador te pedirá permiso; tú decides si lo concedes.';
  // Read an existing registration only; never install/subscribe during mount.
  if(subscription){
   setupStage='status';const saved=await bounded(adapter.status(subscription.endpoint),wait.config,'El servidor no confirmó el estado del dispositivo. Pulsa «Volver a comprobar».');if(!current()){reset();return cleanup;}
   if(saved.active){controls.forEach(input=>input.checked=saved.topics.includes(input.value));pilot.hidden=false;status.textContent='Este dispositivo tiene avisos activados para tu sesión. Puedes cambiar los tipos o enviar una prueba.';}
   else status.textContent='Hay una suscripción anterior en este navegador. Desactívala aquí antes de volver a activar los avisos.';
  }
 }catch(error){
  if(!current()){reset();return cleanup;}enable.hidden=true;
  const failure={config:'No se pudo consultar el servidor. Revisa la conexión y pulsa «Volver a comprobar».',existing:'Este navegador no permitió comprobar las notificaciones. Revisa sus permisos o prueba otro navegador compatible.',status:'No se pudo confirmar el estado del dispositivo. Revisa la conexión y pulsa «Volver a comprobar».'};
  status.textContent=error.name==='PushTimeout'?error.message:failure[setupStage];retry.hidden=false;updateButtons();return cleanup;
 }
 enable.hidden=false;updateButtons();
 enable.onclick=async()=>{
  if(busy||!current())return;
  const topics=controls.filter(n=>n.checked).map(n=>n.value);if(!topics.length){status.textContent='Elige al menos un tipo de aviso.';return;}
  busy=true;updateButtons();let created=false,attemptActive=true,stage='permission';
  try{
   // First async operation is the user-initiated browser prompt. Never on mount.
   status.textContent='Responde al aviso de permiso del navegador.';
   const permission=await bounded(env.Notification.requestPermission(),wait.permission,'El permiso del navegador sigue pendiente. Responde al aviso y vuelve a intentarlo.');
   if(permission!=='granted'){status.textContent=permission==='denied'?'Permiso bloqueado. Puedes cambiarlo en los ajustes del navegador.':'No se activaron las notificaciones.';return;}
   if(!current())throw Error('session');
   stage='registration';status.textContent='Preparando las notificaciones de este navegador…';
   const registration=await bounded(adapter.registration(),wait.registration,'El navegador no terminó de preparar las notificaciones. Revisa la conexión y vuelve a intentarlo.');if(!current())throw Error('session');
   stage='subscription';status.textContent='Registrando este dispositivo…';
   subscription=await bounded(registration.pushManager.getSubscription(),wait.existing,'El navegador no respondió al comprobar el dispositivo. Vuelve a intentarlo.');
   if(!subscription){
    const pending=registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(config.publicKey)});
    pending.then(late=>{if(!attemptActive||!current())return late.unsubscribe();}).catch(()=>{});
    subscription=await bounded(pending,wait.subscription,'El navegador no terminó de registrar el dispositivo. Reintenta o revisa sus permisos.');created=true;
   }
   if(!current())throw Error('session');
   stage='save';status.textContent='Confirmando la activación en el servidor…';
   await bounded(adapter.save({subscription:subscription.toJSON(),topics}),wait.save,'No se confirmó el registro en el servidor. Revisa la conexión y vuelve a intentarlo.');
   if(!current())throw Error('session');
   status.textContent='Notificaciones activadas en este dispositivo para tu sesión actual.';disable.hidden=false;pilot.hidden=false;
  }catch(error){
   if(created&&subscription)await bounded(subscription.unsubscribe(),wait.cleanup,'Cleanup unavailable').catch(()=>{});
   const failure={permission:'No se completó la decisión de permiso. Revisa los permisos del navegador.',registration:'No se pudo preparar el navegador. Revisa la conexión y vuelve a intentarlo.',subscription:'El navegador no pudo registrar el dispositivo. Revisa sus permisos y vuelve a intentarlo.',save:'No se completó la activación en el servidor. Puedes volver a intentarlo.'};
   status.textContent=current()?(error.name==='PushTimeout'?error.message:failure[stage]):'La sesión cambió. No se confirmó la activación.';
  }finally{attemptActive=false;busy=false;updateButtons();}
 };
 pilot.onclick=async()=>{
  if(busy||!current()||!subscription)return;busy=true;updateButtons();status.textContent='Enviando el aviso de prueba…';
  try{await bounded(adapter.pilot(subscription.endpoint),wait.pilot,'El servicio no respondió a la prueba. Puedes volver a intentarlo.');if(current())status.textContent='Prueba enviada al servicio de notificaciones. Comprueba si aparece en tu dispositivo.';}
  catch(error){if(current())status.textContent=error.name==='PushTimeout'?error.message:'No se pudo enviar la prueba. Puedes volver a intentarlo.';}
  finally{busy=false;updateButtons();}
 };
 return cleanup;
}
