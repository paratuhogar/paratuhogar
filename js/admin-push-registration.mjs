// Called only after the user clicks Activate and grants notification permission.
export function adminPushRegistration(serviceWorker,{timeoutMs=20000}={}){
 return new Promise((resolve,reject)=>{
  const watched=new Set();let finished=false,registration=null;
  const finish=error=>{if(finished)return;finished=true;clearTimeout(timer);registration?.removeEventListener('updatefound',check);for(const worker of watched)worker.removeEventListener('statechange',check);error?reject(error):resolve(registration);};
  const expected=worker=>worker&&new URL(worker.scriptURL).searchParams.get('v')==='20261006-ready1';
  const check=()=>{
   if(finished)return;
   if(expected(registration.active)&&registration.active.state==='activated'){finish();return;}
   for(const worker of [registration.installing,registration.waiting])if(expected(worker)){
    if(!watched.has(worker)){watched.add(worker);worker.addEventListener('statechange',check);}
    if(worker.state==='installed')worker.postMessage({type:'SKIP_WAITING'});
    if(worker.state==='redundant'){finish(Error('Service worker installation failed'));return;}
   }
  };
  // Covers register() itself, as well as installation/activation afterward.
  const timer=setTimeout(()=>finish(Error('Service worker unavailable')),timeoutMs);
  Promise.resolve().then(()=>serviceWorker.register('/service-worker.js?v=20261006-ready1',{scope:'/',updateViaCache:'none'})).then(value=>{
   if(finished)return;registration=value;registration.addEventListener('updatefound',check);check();
  }).catch(finish);
 });
}
