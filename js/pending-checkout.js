/* Explicit local pending orders. Never credentials, API responses or Cache Storage. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PTHPendingCheckout=api;})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const AGE=7*86400000,LEASE=60000;
  const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const fail=(code)=>{throw Object.assign(Error(code),{code});};
  const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
  const fields=['nombre','ci','tel','municipio','localidad','dir','notas','moneda','vuelto'];
  const fingerprint=lines=>JSON.stringify(lines.map(p=>({id:p.id,qty:Number(p.qty)})).sort((a,b)=>String(a.id).localeCompare(String(b.id))));
  const logicalForm=value=>value.pickup?{...value,municipio:'',localidad:'',dir:''}:value;
  function clean(input){
    if(!input||!Array.isArray(input.lines)||!input.lines.length||input.lines.length>100)fail('INVALID');
    const ids=new Set(),lines=input.lines.map(p=>{
      if(typeof p.id!=='string'||!p.id||p.id.length>100||ids.has(p.id)||!Number.isInteger(Number(p.qty))||p.qty<1||p.qty>10000)fail('INVALID');
      ids.add(p.id);const price=Number(p.price);if(!Number.isFinite(price)||price<0)fail('INVALID');
      return {id:p.id,qty:Number(p.qty),price};
    });
    const form={};for(const field of fields){const value=String(input.form?.[field]??'').trim();if(value.length>(field==='dir'||field==='notas'?4000:200))fail('INVALID');form[field]=value;}
    form.pickup=input.form?.pickup===true;form.assisted=input.form?.assisted===true;
    if(!form.nombre||!form.tel||!form.pickup&&(!form.municipio||!form.localidad||!form.dir))fail('INVALID');
    if(!['USD (Efectivo)','EUR (Efectivo)','Zelle','CUP (Al cambio)'].includes(form.moneda))fail('INVALID');
    if(form.vuelto&&(!Number.isFinite(Number(form.vuelto))||Number(form.vuelto)<0))fail('INVALID');
    return {lines,form};
  }
  function indexedStore(idb){
    let opening;
    const open=()=>opening||(opening=new Promise((resolve,reject)=>{
      if(!idb){reject(Object.assign(Error('STORAGE'),{code:'STORAGE'}));return;}
      const request=idb.open('pth_pending_checkout_v1',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('orders',{keyPath:'owner'});
      request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();opening=null;};resolve(db);};
      request.onerror=()=>{opening=null;reject(Object.assign(Error('STORAGE'),{code:'STORAGE'}));};
      request.onblocked=()=>reject(Object.assign(Error('STORAGE'),{code:'STORAGE'}));
    }));
    return {async update(owner,mutate){
      const db=await open();return new Promise((resolve,reject)=>{
        let result,problem;const tx=db.transaction('orders','readwrite'),store=tx.objectStore('orders'),get=store.get(owner);
        get.onsuccess=()=>{try{const next=mutate(copy(get.result||null));result=copy(next);if(next==null)store.delete(owner);else store.put(next);}catch(error){problem=error;tx.abort();}};
        tx.oncomplete=()=>resolve(result);
        tx.onerror=tx.onabort=()=>reject(problem||Object.assign(Error('STORAGE'),{code:'STORAGE'}));
      });
    }};
  }
  function create(store,options={}){
    const now=options.now||Date.now,id=options.id||random;
    const update=(owner,mutate)=>{if(typeof owner!=='string'||!owner||owner.length>100)fail('ACCOUNT');return store.update(owner,mutate);};
    const matching=(row,revision)=>{if(!row||row.id!==revision)fail('CHANGED');return row;};
    const tombstone=(row,state,code)=>({version:1,owner:row.owner,id:row.id,intentId:row.intentId||row.id,createdAt:row.createdAt,state,code,attempt:row.outcome?.attempt||row.attempt||null,priorAttempts:row.priorAttempts||[],receipts:row.receipts||[],updatedAt:now()});
    const read=owner=>update(owner,row=>{
      if(row?.version!==1||row.owner!==owner)return null;
      if(row.form&&(!Number.isFinite(row.createdAt)||now()-row.createdAt<0||now()-row.createdAt>AGE))return tombstone(row,'expired','ATTEMPT_EXPIRED');
      return row;
    });
    return {
      read,
      async save(owner,input,intent){const data=clean(input);return update(owner,row=>{
        if(row?.form&&['queued','sending','uncertain','blocked','paused'].includes(row.state))fail('EXISTS');
        if(row?.attempt&&!row.receipts?.length)fail('RECEIPT_REQUIRED');
        const stamp=now(),reuseCancelled=row?.state==='paused'&&!row.attempt&&stamp-row.createdAt<AGE;
        let matchingDraft=false;try{matchingDraft=Array.isArray(intent?.lines)&&fingerprint(intent.lines)===fingerprint(data.lines);}catch(_){}
        const validDraft=matchingDraft&&/^[a-f0-9]{64}$/.test(intent?.intentId||'')&&stamp-intent.savedAt>=0&&stamp-intent.savedAt<AGE&&!(row?.state==='confirmed'&&intent.intentId===(row.intentId||row.id));
        if(row?.priorAttempts?.length>10)fail('RECEIPT_REQUIRED');
        const intentId=reuseCancelled?(row.intentId||row.id):validDraft?intent.intentId:id();
        // An absent receipt cannot prove that a disconnected server request
        // stopped. Keep its nonce/anchor when restarting after cancellation.
        return {version:1,owner,id:id(),intentId,createdAt:reuseCancelled?row.createdAt:intentId===intent?.intentId?intent.savedAt:stamp,updatedAt:stamp,state:'queued',...data,outcome:null,priorAttempts:reuseCancelled?row.priorAttempts||[]:[],lease:null};
      });},
      patch(owner,revision,values,lease){return update(owner,row=>{
        matching(row,revision);if(lease&&row.lease?.id!==lease)fail('CHANGED');if(!lease&&row.lease?.until>now())fail('BUSY');
        return {...row,...copy(values),updatedAt:now()};
      });},
      async cancel(owner,revision){return update(owner,row=>{
        matching(row,revision);if(row.lease?.until>now())fail('BUSY');
        return row.outcome?.attempt||row.priorAttempts?.length?tombstone(row,'paused','RECEIPT_REQUIRED'):null;
      });},
      async logout(owner){return update(owner,row=>row?.outcome?.attempt||row?.priorAttempts?.length?tombstone(row,'paused','RECEIPT_REQUIRED'):null);},
      async confirmed(owner,revision,receipts){return update(owner,row=>{
        matching(row,revision);return {...tombstone(row,'confirmed',null),attempt:null,priorAttempts:[],receipts:receipts.map(r=>({reference:String(r.reference||r.orden_dia||r.id||''),proveedor:String(r.proveedor||'')}))};
      });},
      async retry(owner,revision){return update(owner,row=>{matching(row,revision);if(!row.form)fail('RECEIPT_REQUIRED');if(row.lease?.until>now())fail('BUSY');return {...row,state:'queued',code:null,message:null};});},
      async revise(owner,revision,input){const data=clean(input);return update(owner,row=>{
        matching(row,revision);if(row.lease?.until>now())fail('BUSY');
        if(!row.form||row.state!=='blocked')fail('CHANGED');
        // Pickup display fields are canonicalized by the existing checkout.
        // A signed attempt still retains every original semantic input.
        if(row.outcome?.attempt){
          if(JSON.stringify(logicalForm(data.form))!==JSON.stringify(logicalForm(row.form))||fingerprint(data.lines)!==fingerprint(row.lines))fail('SIGNED_CHANGE');
          data.form=row.form;
        }
        return {...row,...data,state:'queued',code:null,message:null,lease:null,updatedAt:now()};
      });},
      async run(owner,handler){
        const lease=id();let row=await update(owner,row=>{
          if(!row||!row.form||!['queued','uncertain','sending'].includes(row.state)||row.lease?.until>now())return row;
          if(now()-row.createdAt>AGE)return tombstone(row,'expired','ATTEMPT_EXPIRED');
          return {...row,state:'sending',lease:{id:lease,until:now()+LEASE},updatedAt:now()};
        });
        if(row?.lease?.id!==lease)return false;
        const heartbeat=setInterval(()=>update(owner,current=>current?.id===row.id&&current.lease?.id===lease?{...current,lease:{id:lease,until:now()+LEASE}}:current).catch(()=>{}),10000);
        const context={row,save:async values=>{row=await this.patch(owner,row.id,values,lease);context.row=row;return row;},confirmed:async receipts=>{row=await this.confirmed(owner,row.id,receipts);context.row=row;}};
        try{
          await handler(context);
          if(row.state==='sending')await context.save({state:'blocked',code:'REVIEW',message:'Revisa el pedido antes de reintentar.',lease:null});
        }catch(error){
          try{
            const current=await read(owner);
            if(current?.id===row.id&&current.state!=='confirmed'&&current.lease?.id===lease){
              const retryable=['NETWORK_ERROR','ORDER_OUTCOME_UNKNOWN'].includes(error.code);
              await this.patch(owner,row.id,{state:retryable?(current.outcome?.attempt?'uncertain':'queued'):'blocked',code:error.code||'REVIEW',message:error.safeMessage||null,lease:null},lease);
            }
          }catch(_){}
        }finally{clearInterval(heartbeat);await update(owner,current=>current?.id===row.id&&current.lease?.id===lease?{...current,lease:null}:current).catch(()=>{});}
        return true;
      },
      clean
    };
  }
  function localOwner(storage){try{const profile=JSON.parse(storage.getItem('pth_session')||'null')?.data;return storage.getItem('pth_secure_token')&&typeof profile?.id==='string'?profile.id:null;}catch(_){return null;}}
  return {create,indexedStore,clean,localOwner,AGE};
});
