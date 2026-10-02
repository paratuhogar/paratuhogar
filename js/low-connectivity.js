/* Public catalogue and NEW cart lines only. No auth, orders or customer fields. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PTHLowConnectivity=api;
})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const CATALOG_KEY='pth_offline_public_catalog_v1';
  const MAX_AGE=7*24*60*60*1000, FRESH_AGE=2*60*60*1000;
  const fields=['id','nombre','precio','categoria','disponible','thumbnail','garantia','mensajeria','proveedor','precio_flexible','created_at','updated_at'];
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function safeGet(storage,key){try{return storage?.getItem(key)||null;}catch(_){return null;}}
  function safeRemove(storage,key){try{storage?.removeItem(key);}catch(_){}}
  function safeSet(storage,key,value){try{storage.setItem(key,JSON.stringify(value));return true;}catch(_){return false;}}
  function publicProducts(rows){
    if(!Array.isArray(rows)||rows.length>5000)throw Error('Invalid public catalogue');
    return rows.map(row=>{
      if(!row||typeof row.id!=='string'||!row.id||row.id.length>100||typeof row.nombre!=='string'||!row.nombre||row.nombre.length>500||!Number.isFinite(Number(row.precio))||Number(row.precio)<0)throw Error('Invalid public product');
      const result={};
      for(const field of fields){const value=row[field];if(typeof value==='string'&&value.length<=2000||typeof value==='number'&&Number.isFinite(value))result[field]=value;}
      result.precio=Number(row.precio);return result;
    });
  }
  function lines(rows){
    if(!Array.isArray(rows)||rows.length>100)throw Error('Invalid cart');
    const ids=new Set();
    return rows.map(row=>{const id=String(row.id??'');const qty=Number(row.qty);if(!id||id.length>100||ids.has(id)||!Number.isInteger(qty)||qty<1||qty>10000)throw Error('Invalid cart line');ids.add(id);return {id,qty};});
  }
  const fingerprint=rows=>JSON.stringify(lines(rows).sort((a,b)=>a.id.localeCompare(b.id)));
  function create(storage,now=Date.now){
    const read=(key)=>{try{const raw=safeGet(storage,key);if(!raw)return null;if(raw.length>2000000)throw Error('Too large');const value=JSON.parse(raw);const age=now()-value.savedAt;if(value.version!==1||!Number.isFinite(age)||age<0||age>MAX_AGE)throw Error('Expired');return value;}catch(_){safeRemove(storage,key);return null;}};
    const draftKey=owner=>'pth_new_cart_v1:'+encodeURIComponent(owner||'visitor');
    return {
      savePublic(rows,savedAt=now()){const value={version:1,savedAt,products:publicProducts(rows)};if(!Number.isFinite(savedAt)||now()-savedAt<0||now()-savedAt>MAX_AGE||JSON.stringify(value).length>2000000)return false;return safeSet(storage,CATALOG_KEY,value);},
      readPublic(){const value=read(CATALOG_KEY);if(!value)return null;try{return {...value,products:publicProducts(value.products),stale:now()-value.savedAt>FRESH_AGE};}catch(_){safeRemove(storage,CATALOG_KEY);return null;}},
      saveDraft(owner,rows){let value;try{value=lines(rows);}catch(_){return false;}if(!value.length){safeRemove(storage,draftKey(owner));return true;}const old=read(draftKey(owner));try{if(old&&fingerprint(old.lines)===fingerprint(value)&&/^[a-f0-9]{64}$/.test(old.intentId||''))return true;}catch(_){safeRemove(storage,draftKey(owner));}let intentId;try{intentId=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');}catch(_){return false;}return safeSet(storage,draftKey(owner),{version:1,savedAt:now(),intentId,lines:value});},
      readDraft(owner){const value=read(draftKey(owner));if(!value)return null;try{return {...value,lines:lines(value.lines)};}catch(_){safeRemove(storage,draftKey(owner));return null;}},
      clearDraft(owner){safeRemove(storage,draftKey(owner));},
      markSent(owner,revision){if(revision)return safeSet(storage,'pth_new_cart_sent_v1:'+encodeURIComponent(owner||'visitor'),{version:1,savedAt:now(),revision});return false;},
      wasSent(owner,revision){return Boolean(revision&&read('pth_new_cart_sent_v1:'+encodeURIComponent(owner||'visitor'))?.revision===revision);},
      saving(connection){const manual=safeGet(storage,'pth_data_saving_v1');return manual==='on'||manual!=='off'&&(connection?.saveData||['slow-2g','2g'].includes(connection?.effectiveType)||connection?.downlink>0&&connection.downlink<=0.15);},
      setSaving(enabled){try{storage.setItem('pth_data_saving_v1',enabled?'on':'off');}catch(_){}},
      draftKey
    };
  }
  return {create,publicProducts,lines,fingerprint,escape,CATALOG_KEY,MAX_AGE,FRESH_AGE};
});
