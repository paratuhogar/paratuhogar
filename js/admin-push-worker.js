// DRAFT: not imported by service-worker.js until sender/subscriptions are approved.
(() => {
 const target=kind=>kind==='orders'?'/index.html?admin_alert=orders':kind==='suggestions'?'/index.html?admin_alert=suggestions':null;
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
})();
