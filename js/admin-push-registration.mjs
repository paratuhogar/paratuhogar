// Called only after the user clicks Activate and grants notification permission.
export async function adminPushRegistration(serviceWorker){
 const registration=await serviceWorker.register('/service-worker.js?v=20261001-push1',{scope:'/',updateViaCache:'none'});
 return new Promise((resolve,reject)=>{
  const watched=new Set();let finished=false;
  const finish=error=>{if(finished)return;finished=true;clearTimeout(timer);registration.removeEventListener('updatefound',check);for(const worker of watched)worker.removeEventListener('statechange',check);error?reject(error):resolve(registration);};
  const expected=worker=>worker&&new URL(worker.scriptURL).searchParams.get('v')==='20261001-push1';
  const check=()=>{
   if(finished)return;
   if(expected(registration.active)&&registration.active.state==='activated'){finish();return;}
   for(const worker of [registration.installing,registration.waiting])if(expected(worker)){
    if(!watched.has(worker)){watched.add(worker);worker.addEventListener('statechange',check);}
    if(worker.state==='installed')worker.postMessage({type:'SKIP_WAITING'});
    if(worker.state==='redundant'){finish(Error('Service worker installation failed'));return;}
   }
  };
  const timer=setTimeout(()=>finish(Error('Service worker unavailable')),20000);
  registration.addEventListener('updatefound',check);check();
 });
}
