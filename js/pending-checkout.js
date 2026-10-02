/* Explicit local pending orders. Never credentials, API responses or Cache Storage. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PTHPendingCheckout=api;})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const AGE=7*86400000,LEASE=60000,MAX_PENDING=25,MAX_HISTORY=100;
  const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const fail=(code)=>{throw Object.assign(Error(code),{code});};
  const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
  const fields=['nombre','ci','tel','municipio','localidad','dir','notas','moneda','vuelto'];
  const fingerprint=lines=>JSON.stringify(lines.map(p=>({id:p.id,qty:Number(p.qty)})).sort((a,b)=>String(a.id).localeCompare(String(b.id))));
  const logicalForm=value=>value.pickup?{...value,municipio:'',localidad:'',dir:''}:value;
  function amount(value){if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e12)fail('INVALID');return value;}
  function estimate(value,equipment){
    if(!value||typeof value!=='object'||Array.isArray(value))fail('INVALID');
    const derived=equipment!==undefined,equip=amount(derived?equipment:value.equipment),shipping=value.shipping==null?null:amount(value.shipping);
    if(derived&&value.equipment!==undefined&&Math.abs(amount(value.equipment)-equip)>.001)fail('INVALID');
    const total=shipping===null?null:amount(equip+shipping);
    if(value.total!==undefined&&(value.total===null?total!==null:total===null||Math.abs(amount(value.total)-total)>.001))fail('INVALID');
    return {equipment:equip,shipping,total};
  }
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
    const equipment=lines.reduce((sum,p)=>sum+p.price*p.qty,0);
    return {lines,form,estimate:estimate(input.estimate||{shipping:form.pickup?0:null},equipment)};
  }
  function indexedStore(idb){
    const connections=new Map();
    const open=(name,table)=>{
      if(connections.has(name))return connections.get(name);
      const promise=new Promise((resolve,reject)=>{
        if(!idb){reject(Object.assign(Error('STORAGE'),{code:'STORAGE'}));return;}
        const request=idb.open(name,1);
        request.onupgradeneeded=()=>request.result.createObjectStore(table,{keyPath:'owner'});
        request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();connections.delete(name);};resolve(db);};
        request.onerror=request.onblocked=()=>{connections.delete(name);reject(Object.assign(Error('STORAGE'),{code:'STORAGE'}));};
      });connections.set(name,promise);return promise;
    };
    const transaction=(db,table,owner,mutate,mode='readwrite')=>new Promise((resolve,reject)=>{
      let result,problem;const tx=db.transaction(table,mode),store=tx.objectStore(table),get=store.get(owner);
      get.onsuccess=()=>{try{const current=copy(get.result||null),next=mutate(current);result=copy(next);if(mode==='readwrite'){if(next==null)store.delete(owner);else store.put(next);}}catch(error){problem=error;tx.abort();}};
      tx.oncomplete=()=>resolve(result);
      tx.onerror=tx.onabort=()=>reject(problem||Object.assign(Error('STORAGE'),{code:'STORAGE'}));
    });
    return {async update(owner,mutate){
      const legacy=await open('pth_pending_checkout_v1','orders');
      const candidate=await transaction(legacy,'orders',owner,row=>row,'readonly');
      const db=await open('pth_pending_checkout_v2','queues');
      const imported=candidate?.version===1&&candidate.owner===owner&&candidate.id&&candidate.code!=='MIGRATED_TO_QUEUE';
      const result=await transaction(db,'queues',owner,current=>{
        let bucket=current||{version:2,owner,orders:[],importedIds:[]};
        if(imported&&!bucket.importedIds?.includes(candidate.id)){
          if(!bucket.orders.some(row=>row.id===candidate.id))bucket.orders.push(copy(candidate));
          bucket.importedIds=[...(bucket.importedIds||[]),candidate.id];
        }
        return mutate(bucket);
      });
      // Commit the new namespace first. If it fails, v1 remains intact. A
      // repeat after interruption sees importedIds and never imports twice.
      // The old store receives only a paused v1 pointer, never a v2 bucket.
      if(imported)await transaction(legacy,'orders',owner,current=>current?.id===candidate.id?{
        version:1,owner,id:candidate.id,intentId:candidate.intentId||candidate.id,
        createdAt:candidate.createdAt,updatedAt:Date.now(),state:'paused',code:'MIGRATED_TO_QUEUE',
        attempt:null,priorAttempts:[],receipts:[],migratedTo:'pth_pending_checkout_v2'
      }:current);
      return result;
    }};
  }
  function create(store,options={}){
    const now=options.now||Date.now,id=options.id||random;
    const order=(a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0)||String(a.id).localeCompare(String(b.id));
    const pending=row=>Boolean(row.form||row.attempt||row.priorAttempts?.length);
    const tombstone=(row,state,code)=>({version:1,owner:row.owner,id:row.id,intentId:row.intentId||row.id,createdAt:row.createdAt,state,code,attempt:row.outcome?.attempt||row.attempt||null,priorAttempts:row.priorAttempts||[],receipts:row.receipts||[],updatedAt:now()});
    const change=async(owner,mutate)=>{
      if(typeof owner!=='string'||!owner||owner.length>100)fail('ACCOUNT');
      let result;await store.update(owner,current=>{
        if(current&&!(current.version===2&&current.owner===owner&&Array.isArray(current.orders))&&!(current.version===1&&current.owner===owner))fail('STORAGE');
        const bucket=current?.version===2?copy(current):{version:2,owner,orders:current?[copy(current)]:[],importedIds:[]};
        bucket.orders=bucket.orders.map(row=>row.form&&(!Number.isFinite(row.createdAt)||now()-row.createdAt<0||now()-row.createdAt>AGE)?tombstone(row,'expired','ATTEMPT_EXPIRED'):row).sort(order);
        result=mutate(bucket.orders,bucket);
        const history=bucket.orders.filter(row=>!pending(row)).sort((a,b)=>order(b,a)).slice(0,MAX_HISTORY);
        const retained=new Set(history.map(row=>row.id));bucket.orders=bucket.orders.filter(row=>pending(row)||retained.has(row.id)).sort(order);
        return bucket.orders.length||bucket.importedIds?.length?bucket:null;
      });return copy(result);
    };
    const list=owner=>change(owner,rows=>rows);
    const read=(owner,revision)=>change(owner,rows=>revision?rows.find(row=>row.id===revision)||null:rows.find(row=>row.form)||rows.find(row=>row.state!=='confirmed')||rows.at(-1)||null);
    const position=(rows,revision)=>{const index=rows.findIndex(row=>row.id===revision);if(index<0)fail('CHANGED');return index;};
    const modify=(owner,revision,mutate)=>change(owner,rows=>{const index=position(rows,revision),next=mutate(rows[index]);if(next===null)rows.splice(index,1);else rows[index]=next;return next;});
    return {
      read,list,
      async save(owner,input,intent){const data=clean(input);return change(owner,rows=>{
        const stamp=now(),explicit=Boolean(intent?.intentId&&!Array.isArray(intent.lines));
        let matchingDraft=false;try{matchingDraft=Array.isArray(intent?.lines)&&fingerprint(intent.lines)===fingerprint(data.lines);}catch(_){}
        if(explicit&&(!/^[a-f0-9]{64}$/.test(intent.intentId)||!Number.isFinite(intent.savedAt)||stamp-intent.savedAt<0||stamp-intent.savedAt>=AGE))fail('INVALID_INTENT');
        const validDraft=matchingDraft&&/^[a-f0-9]{64}$/.test(intent?.intentId||'')&&stamp-intent.savedAt>=0&&stamp-intent.savedAt<AGE&&!rows.some(row=>row.state==='confirmed'&&intent.intentId===(row.intentId||row.id));
        const intentId=explicit||validDraft?intent.intentId:id(),existing=rows.find(row=>(row.intentId||row.id)===intentId);
        if(existing){
          if(existing.form&&(JSON.stringify(logicalForm(existing.form))!==JSON.stringify(logicalForm(data.form))||fingerprint(existing.lines)!==fingerprint(data.lines)))fail('INTENT_CONFLICT');
          return existing;
        }
        if(rows.filter(pending).length>=MAX_PENDING)fail('LIMIT');
        const row={version:1,owner,id:id(),intentId,createdAt:explicit||validDraft?intent.savedAt:stamp,updatedAt:stamp,state:'queued',...data,outcome:null,priorAttempts:[],lease:null};
        rows.push(row);return row;
      });},
      patch(owner,revision,values,lease){return modify(owner,revision,row=>{
        if(lease&&row.lease?.id!==lease)fail('CHANGED');if(!lease&&row.lease?.until>now())fail('BUSY');
        if(['owner','id','intentId','version','createdAt'].some(key=>Object.hasOwn(values,key)))fail('INVALID');
        const next={...row,...copy(values),updatedAt:now()};
        if(Object.hasOwn(values,'estimate'))next.estimate=estimate(values.estimate,next.lines.reduce((sum,p)=>sum+p.price*p.qty,0));
        else if(Object.hasOwn(values,'lines')&&next.estimate)next.estimate=estimate({shipping:next.estimate.shipping},next.lines.reduce((sum,p)=>sum+p.price*p.qty,0));
        if(Object.hasOwn(values,'reviewEstimate'))next.reviewEstimate=values.reviewEstimate===null?null:estimate(values.reviewEstimate);
        return next;
      });},
      async cancel(owner,revision){return modify(owner,revision,row=>{
        if(row.lease?.until>now())fail('BUSY');
        return row.outcome?.attempt||row.attempt||row.priorAttempts?.length?tombstone(row,'paused','RECEIPT_REQUIRED'):null;
      });},
      async logout(owner){return change(owner,rows=>{for(let i=rows.length-1;i>=0;i--){const row=rows[i];if(row.outcome?.attempt||row.attempt||row.priorAttempts?.length)rows[i]=tombstone(row,'paused','RECEIPT_REQUIRED');else if(row.state!=='confirmed')rows.splice(i,1);}return rows;});},
      async confirmed(owner,revision,receipts){return modify(owner,revision,row=>{
        return {...tombstone(row,'confirmed',null),attempt:null,priorAttempts:[],receipts:receipts.map(r=>({reference:String(r.reference||r.orden_dia||r.id||'').slice(0,200),proveedor:String(r.proveedor||'').slice(0,200)}))};
      });},
      async retry(owner,revision){return modify(owner,revision,row=>{if(!row.form)fail('RECEIPT_REQUIRED');if(row.lease?.until>now())fail('BUSY');return {...row,state:'queued',code:null,message:null};});},
      async revise(owner,revision,input){const data=clean(input);return modify(owner,revision,row=>{
        if(row.lease?.until>now())fail('BUSY');
        if(!row.form||row.state!=='blocked')fail('CHANGED');
        // Pickup display fields are canonicalized by the existing checkout.
        // A signed attempt still retains every original semantic input.
        if(row.outcome?.attempt){
          if(JSON.stringify(logicalForm(data.form))!==JSON.stringify(logicalForm(row.form))||fingerprint(data.lines)!==fingerprint(row.lines))fail('SIGNED_CHANGE');
          data.form=row.form;
        }
        const {reviewEstimate:discarded,...previous}=row;
        return {...previous,...data,state:'queued',code:null,message:null,lease:null,updatedAt:now()};
      });},
      async run(owner,handler,revision){
        const lease=id();let row=await change(owner,rows=>{
          if(rows.some(row=>row.lease?.until>now()))return null;
          const index=rows.findIndex(row=>(!revision||row.id===revision)&&row.form&&['queued','uncertain','sending'].includes(row.state));
          if(index<0)return null;
          rows[index]={...rows[index],state:'sending',lease:{id:lease,until:now()+LEASE},updatedAt:now()};return rows[index];
        });
        if(row?.lease?.id!==lease)return false;
        const heartbeat=setInterval(()=>modify(owner,row.id,current=>current.lease?.id===lease?{...current,lease:{id:lease,until:now()+LEASE}}:current).catch(()=>{}),10000);
        const context={row,save:async values=>{row=await this.patch(owner,row.id,values,lease);context.row=row;return row;},confirmed:async receipts=>{row=await this.confirmed(owner,row.id,receipts);context.row=row;}};
        try{
          await handler(context);
          if(row.state==='sending')await context.save({state:'blocked',code:'REVIEW',message:'Revisa el pedido antes de reintentar.',lease:null});
        }catch(error){
          try{
            const current=await read(owner,row.id);
            if(current?.id===row.id&&current.state!=='confirmed'&&current.lease?.id===lease){
              const retryable=['NETWORK_ERROR','ORDER_OUTCOME_UNKNOWN'].includes(error.code);
              await this.patch(owner,row.id,{state:retryable?(current.outcome?.attempt?'uncertain':'queued'):'blocked',code:error.code||'REVIEW',message:error.safeMessage||null,lease:null},lease);
            }
          }catch(_){}
        }finally{clearInterval(heartbeat);await modify(owner,row.id,current=>current.lease?.id===lease?{...current,lease:null}:current).catch(()=>{});}
        return true;
      },
      clean
    };
  }
  function localOwner(storage){try{const profile=JSON.parse(storage.getItem('pth_session')||'null')?.data;return storage.getItem('pth_secure_token')&&typeof profile?.id==='string'?profile.id:null;}catch(_){return null;}}
  return {create,indexedStore,clean,localOwner,AGE,MAX_PENDING};
});
