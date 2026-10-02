/* Self-contained public reader: does not load the SDK or restore accounts. */
(() => {
  let storage;try{storage=localStorage;}catch(_){}
  const store=PTHLowConnectivity.create(storage);
  let cached=store.readPublic();
  window.PTHDataSaving={enabled:()=>true};
  const date=document.getElementById('catalog-date'),container=document.getElementById('offline-products');
  const search=document.getElementById('offline-search'),category=document.getElementById('offline-category');
  function updateCopy(){
    if(!cached){date.textContent='No hay una copia reciente en este dispositivo. Pulsa Actualizar copia pública cuando tengas conexión.';return;}
    date.textContent='Guardado el '+new Date(cached.savedAt).toLocaleString('es-CU',{timeZone:'America/Havana'})+'. '+(cached.stale?'Pendiente de actualizar.':'');
    const selected=category.value;category.replaceChildren();const all=document.createElement('option');all.value='';all.textContent='Todas';category.appendChild(all);
    for(const name of [...new Set(cached.products.map(p=>p.categoria).filter(Boolean))].sort()){const option=document.createElement('option');option.value=name;option.textContent=name;category.appendChild(option);}
    category.value=[...category.options].some(option=>option.value===selected)?selected:'';
  }
  const normalized=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function render(){
    if(!cached)return;
    const rows=cached.products.filter(p=>(!category.value||p.categoria===category.value)&&normalized(p.nombre).includes(normalized(search.value)));
    document.getElementById('offline-count').textContent=rows.length+' productos en la copia guardada';container.replaceChildren();
    for(const p of rows.slice(0,100)){
      const card=document.createElement('article'),name=document.createElement('h2'),price=document.createElement('strong'),state=document.createElement('p');
      name.textContent=p.nombre;price.textContent='$'+Number(p.precio).toFixed(2)+' USD';state.textContent=p.disponible==='SI'?'Disponible en la copia guardada':'No disponible en la copia guardada';card.append(name,price,state);
      const photo=document.createElement('div');photo.innerHTML=PTHProductImages.render(p.thumbnail,p.nombre,'offline-photo');card.appendChild(photo);container.appendChild(card);
    }
    if(rows.length>100){const note=document.createElement('p');note.textContent='Hay más resultados. Filtra por categoría o busca un modelo para encontrarlos.';container.appendChild(note);}
  }
  document.getElementById('offline-refresh').onclick=async function(){
    if(!navigator.onLine){date.textContent='Todavía no hay conexión. La copia guardada sigue disponible.';return;}
    this.disabled=true;this.textContent='Actualizando…';
    try{
      const rows=await PTHPublicCatalog.fetch(),savedAt=Date.now();
      const saved=store.savePublic(rows,savedAt);cached={products:PTHLowConnectivity.publicProducts(rows),savedAt,stale:false};updateCopy();render();
      if(!saved)date.textContent='Catálogo actualizado en esta pestaña. No hubo espacio para guardar la copia sin conexión.';
    }catch(_){date.textContent='No se pudo actualizar. Puedes seguir consultando la copia guardada y reintentar.';}
    finally{this.disabled=false;this.textContent='Actualizar copia pública';}
  };
  search.addEventListener('input',render);category.addEventListener('change',render);updateCopy();render();
})();
