/* Offline display uses an explicitly saved copy. Every server action stays live. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PTHOfflineStorefrontAdapter=api;})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const identity=profile=>JSON.stringify([profile?.id,profile?.nombre,profile?.rol,profile?.parent_id]);
  const networkFailure=error=>['NETWORK_ERROR','SESSION_UNAVAILABLE'].includes(error?.code)||error?.name==='TypeError'||error?.name==='AbortError';
  function create({root=globalThis,secureData=root.PTHSecureData,copies=root.PTHOfflineCheckoutCopy?.create(root.indexedDB),publicCopy,now=Date.now,onClear=()=>{}}={}){
    let active=null,generation=0,reconnecting=false;
    function valid(){
      if(!active)return false;
      if(active.owner){const profile=secureData.offlineProfile?.();if(secureData.token()!==active.token||identity(profile)!==active.identity||secureData.expiresAt?.()<=now()||active.expiresAt<=now()){clear();return false;}}
      return true;
    }
    function clear(){const previous=active;active=null;generation++;root.document?.getElementById('pth-offline-storefront-status')?.remove();if(previous)onClear(previous);}
    function status(note=''){
      if(!valid()||!root.document)return;
      const doc=root.document;let node=doc.getElementById('pth-offline-storefront-status');
      if(!node){node=doc.createElement('aside');node.id='pth-offline-storefront-status';node.className='pth-offline-storefront-status';node.setAttribute('role','status');node.setAttribute('aria-live','polite');doc.getElementById('sec-catalogo')?.before(node);}
      const stamp=new Date(active.savedAt).toLocaleString('es-CU',{timeZone:'America/Havana',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
      node.textContent='Sin conexión con la tienda · Datos guardados el '+stamp+'. '+(active.owner?'Puedes preparar pedidos aquí. La tienda comprobará precios y disponibilidad al conectar.':'Puedes consultar este catálogo. Conecta antes de confirmar un pedido.')+(note?' '+note:'');
    }
    async function fallback(error={code:'NETWORK_ERROR'}){
      if(error?.status===401||error?.status===403||['SESSION_INVALID','SESSION_EXPIRED','SESSION_CHANGED','FORBIDDEN'].includes(error?.code)){
        const owner=active?.owner;clear();if(owner)void copies?.clear?.(owner)?.catch(()=>{});return null;
      }
      if(root.navigator?.onLine!==false&&!networkFailure(error))return null;
      const epoch=++generation,token=secureData.token(),profile=secureData.offlineProfile?.();
      if(token){
        if(!profile||!copies)return null;
        let copy;try{copy=await copies.read(profile.id,{profile});}catch(_){return null;}
        if(epoch!==generation||!copy||token!==secureData.token()||identity(profile)!==identity(secureData.offlineProfile?.())||copy.expiresAt<=now())return null;
        const adopted=secureData.adoptOfflineProfile?.();if(identity(adopted)!==identity(profile))return null;
        active={...copy,owner:profile.id,token,profile:adopted,identity:identity(adopted)};
      }else{
        // A signed-in device never falls through to someone else's/public copy.
        if(secureData.offlineProfile?.())return null;
        const copy=publicCopy?.();if(epoch!==generation||!copy?.products?.length||secureData.token())return null;
        active={...copy,owner:null,clients:[],tariffs:[]};
      }
      status();return active;
    }
    function live(){active=null;generation++;root.document?.getElementById('pth-offline-storefront-status')?.remove();}
    async function reconnect(reload){
      if(reconnecting||!valid()||root.navigator?.onLine===false)return false;
      reconnecting=true;const token=secureData.token(),epoch=generation;
      try{if(token)await secureData.refresh();if(epoch!==generation||token!==secureData.token())return false;await reload();return !active;}
      catch(_){status();return false;}finally{reconnecting=false;}
    }
    root.addEventListener?.('pth:session-changed',clear);
    root.addEventListener?.('storage',event=>{if(['pth_session','pth_secure_token','pth_secure_token_expires_at'].includes(event.key)||event.key===null){if(active&&!valid())clear();}});
    return {fallback,current:()=>valid()?active:null,usingCopy:()=>valid(),live,clear,status,reconnect};
  }
  return {create,identity,networkFailure};
});
