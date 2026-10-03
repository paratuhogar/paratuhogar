#!/usr/bin/env node
// Local editorial proposal only. Never fetch inventory or regenerate commercial pages.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {categoryEditorial, GUIDE_DRAFTS, renderGuidePage,EDITORIAL_UPDATED} from './seo-category-editorial.mjs';

const root=resolve(dirname(new URL(import.meta.url).pathname),'..');
const source=process.argv.find(arg=>arg.startsWith('--json='))?.slice(7);
const labels={energia:'Energía','mundo-frio':'Mundo frío'};
const navPattern=/<!-- PTH_AFFILIATE_NAVIGATION_START -->[\s\S]*?<!-- PTH_AFFILIATE_NAVIGATION_END -->/;
const blocks={
 css:/\s*\/\* PTH_EDITORIAL_DRAFT_CSS_START \*\/[\s\S]*?\/\* PTH_EDITORIAL_DRAFT_CSS_END \*\//,
 intro:/\s*<!-- PTH_EDITORIAL_DRAFT_INTRO_START -->[\s\S]*?<!-- PTH_EDITORIAL_DRAFT_INTRO_END -->/,
 guide:/<!-- PTH_EDITORIAL_DRAFT_GUIDE_START -->[\s\S]*?<!-- PTH_EDITORIAL_DRAFT_GUIDE_END -->/
};

export async function refreshCategoryEditorial(sourcePath=source,siteURL='https://paratuhogar.org'){
 if(!sourcePath)throw new Error('Indica --json con el snapshot público de fichas revisadas.');
 const [products,manifest,template]=await Promise.all([
  readFile(resolve(sourcePath),'utf8').then(JSON.parse),
  readFile(join(root,'producto/manifest.json'),'utf8').then(JSON.parse),
  readFile(join(root,'templates/seo-guide-page.html'),'utf8')
 ]);
 if(!Array.isArray(products)||!Array.isArray(manifest))throw new Error('La fuente y el manifiesto deben ser listas.');
 const slugMap=new Map(products.map(p=>[p,String(p.slug||'')]));
 const available=new Set(manifest.filter(p=>p.disponible===true).map(p=>p.slug));
 const updates=[];
 let navigation;
 for(const slug of Object.keys(labels)){
  const path=join(root,'categoria',slug,'index.html');
  const original=await readFile(path,'utf8');
  navigation ||= original.match(navPattern)?.[0];
  if(!navigation)throw new Error(`Falta navegación de atribución en ${slug}.`);
  const grid=original.match(/<section class="grid"[\s\S]*?<\/section>/)?.[0];
  if(!grid||!original.includes('</style>'))throw new Error(`Falta ancla de categoría en ${slug}.`);
  const selected=products.filter(p=>String(p.disponible||'').trim().toUpperCase()==='SI'&&available.has(p.slug)&&grid.includes(`/producto/${p.slug}/`));
  const editorial=categoryEditorial(slug,selected,slugMap);
  let html=original.replace(blocks.css,'').replace(blocks.intro,'');
  const guide=blocks.guide.test(html)?blocks.guide:/<section class="guide"[\s\S]*?<\/section>/;
  if(!guide.test(html))throw new Error(`Falta guía de categoría en ${slug}.`);
  html=html.replace('</style>',`/* PTH_EDITORIAL_DRAFT_CSS_START */\n${editorial.css}\n/* PTH_EDITORIAL_DRAFT_CSS_END */\n  </style>`);
  html=html.replace(grid,`<!-- PTH_EDITORIAL_DRAFT_INTRO_START -->\n${editorial.html}\n<!-- PTH_EDITORIAL_DRAFT_INTRO_END -->\n    ${grid}`);
  html=html.replace(guide,`<!-- PTH_EDITORIAL_DRAFT_GUIDE_START -->\n${editorial.guideHTML}\n<!-- PTH_EDITORIAL_DRAFT_GUIDE_END -->`);
  updates.push([path,html]);
 }
 for(const guide of GUIDE_DRAFTS){
  const {html}=renderGuidePage(template,guide,{siteURL,navigation});
  updates.push([join(root,'categoria',guide.slug,'index.html'),html]);
 }
 const sitemapPath=join(root,'sitemap.xml');
 let sitemap=await readFile(sitemapPath,'utf8');
 if(!sitemap.includes('</urlset>'))throw new Error('Falta ancla del sitemap.');
 for(const guide of GUIDE_DRAFTS){
  const {canonical}=renderGuidePage(template,guide,{siteURL,navigation});
  const entry=`  <url><loc>${canonical}</loc><lastmod>${EDITORIAL_UPDATED}</lastmod></url>`;
  if(!sitemap.includes(`<loc>${canonical}</loc>`))sitemap=sitemap.replace('</urlset>',entry+'\n</urlset>');
 }
 updates.push([sitemapPath,sitemap]);
 // Validate all existing anchors before touching the five local proposal pages.
 for(const [path,html] of updates){await mkdir(dirname(path),{recursive:true});await writeFile(path,html,'utf8');}
 console.log('Propuesta local: 2 categorías y 3 guías indexables añadidas al sitemap. Fichas, precios, inventario, URLs anteriores y atribución conservados. No publicada.');
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)refreshCategoryEditorial().catch(error=>{console.error(error.message);process.exitCode=1;});
