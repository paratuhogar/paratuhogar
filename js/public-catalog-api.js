/* The same existing public projection, always anonymous; no session restoration. */
(function(root){
  'use strict';
  let pending=null;
  async function download(){
    const rows=[];
    for(let from=0;from<5000;from+=1000){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
      let result;
      try{
        const response=await root.fetch('https://ljqwaovevfatkiigirhf.supabase.co/functions/v1/secure-data',{
          method:'POST',credentials:'omit',cache:'no-store',signal:controller.signal,
          headers:{apikey:'sb_publishable_DAuFcu0JjUo15yLDAev3MQ_9x5GIVXt','Content-Type':'application/json'},
          body:JSON.stringify({action:'query',table:'productos',op:'select',columns:'id,nombre,precio,categoria,disponible,thumbnail,garantia,mensajeria,proveedor,precio_flexible,created_at,updated_at',orders:[{column:'nombre',ascending:true}],range:[from,from+999]})
        });
        result=await response.json();
        if(!response.ok||result.error||!Array.isArray(result.data))throw Error('No se pudo actualizar la copia pública. Inténtalo de nuevo.');
      }finally{clearTimeout(timer);}
      rows.push(...result.data);
      if(result.data.length<1000)return rows;
    }
    throw Error('El catálogo supera el límite de esta copia. Consulta la tienda con conexión.');
  }
  root.PTHPublicCatalog={fetch:()=>{if(!pending)pending=download().finally(()=>{pending=null;});return pending;}};
})(typeof window==='undefined'?globalThis:window);
