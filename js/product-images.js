/* Public card thumbnails only. Details/downloads retain the original image URL. */
(function(root){
 'use strict';
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function key(url){try{return decodeURIComponent(String(url).split('/').pop().split('?')[0]).replace(/[\s'"]/g,'');}catch(_){return '';}}
 const safePath=path=>/^\/img_productos\/optimized\/[a-f0-9]{16}-(360|720)\.(avif|webp)$/.test(path||'');
 function candidates(row,type){
  const seen=new Set();return [360,720].flatMap(size=>{
   const width=row['width'+size],url=row[type+size];
   if(!Number.isInteger(width)||width<1||seen.has(width)||!safePath(url))return [];
   seen.add(width);return [`${url} ${width}w`];
  }).join(', ');
 }
 function render(original,alt,classes,mode='grid'){
  const row=root.PTH_IMAGE_VARIANTS?.[key(original)];
  const base=`loading="lazy" decoding="async" alt="${escape(alt)}" class="${escape(classes)}" data-original="${escape(original)}" onerror="PTHProductImages.fallback(this)"`;
  if(!row||!safePath(row.webp360)||!candidates(row,'webp'))return `<img src="${escape(original)}" data-original-attempt="1" ${base}>`;
  const sizes=mode==='list'?'(min-width: 768px) 150px, calc(100vw - 64px)':'(min-width: 1024px) 260px, (min-width: 768px) 30vw, calc(50vw - 48px)';
  return `<picture class="block h-full w-full"><source type="image/avif" srcset="${candidates(row,'avif')}" sizes="${sizes}"><source type="image/webp" srcset="${candidates(row,'webp')}" sizes="${sizes}"><img src="${row.webp360}" srcset="${candidates(row,'webp')}" sizes="${sizes}" width="${row.width720}" height="${row.height720}" ${base}></picture>`;
 }
 function fallback(img){
  img.closest('picture')?.querySelectorAll('source').forEach(source=>source.remove());
  img.removeAttribute('srcset');img.removeAttribute('sizes');
  if(img.dataset.originalAttempt){img.removeAttribute('onerror');img.src='/icons/product-placeholder.svg';return;}
  img.dataset.originalAttempt='1';img.src=img.dataset.original;
 }
 root.PTHProductImages={render,fallback};
})(window);
