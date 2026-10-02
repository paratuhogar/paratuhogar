// Receives only generic, authorized server notifications; no submitted text or URLs.
(() => {
 const target=kind=>kind==='orders'?'/index.html?admin_alert=orders':kind==='suggestions'?'/index.html?admin_alert=suggestions':kind==='applications'?'/index.html?admin_alert=applications':null;
 self.addEventListener('push',event=>{
  let payload;try{payload=event.data?.json();}catch(_){return;}
  if(payload?.version!==1||!target(payload.kind))return;
  event.waitUntil(self.registration.showNotification('ParaTuHogar',{
   body:'Hay novedades en tu panel. Entra para revisarlas.',
   icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',
   tag:'pth-admin-'+payload.kind,data:{kind:payload.kind},
  }));
 });
 self.addEventListener('notificationclick',event=>{
  event.notification.close();const url=target(event.notification.data?.kind);if(!url)return;
  // Ignore arbitrary URLs, report text and identifiers in push payloads.
  event.waitUntil(self.clients.openWindow(new URL(url,self.location.origin).href));
 });
 self.addEventListener('message',event=>{
  if(event.data?.type!=='PTH_PUSH_LOGOUT')return;
  event.waitUntil((async()=>{
   const subscription=await self.registration.pushManager.getSubscription();
   if(subscription)await subscription.unsubscribe();
   const notifications=await self.registration.getNotifications();
   notifications.filter(n=>String(n.tag).startsWith('pth-admin-')).forEach(n=>n.close());
  })());
 });
})();
