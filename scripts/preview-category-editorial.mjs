#!/usr/bin/env node
// Local editorial proposal only. Never fetch inventory or regenerate commercial pages.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {categoryEditorial, GUIDE_DRAFTS, guideBody} from './seo-category-editorial.mjs';

const root=resolve(dirname(new URL(import.meta.url).pathname),'..');
const source=process.argv.find(arg=>arg.startsWith('--json='))?.slice(7);
const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const labels={energia:'Energía','mundo-frio':'Mundo frío'};
const navPattern=/<!-- PTH_AFFILIATE_NAVIGATION_START -->[\s\S]*?<!-- PTH_AFFILIATE_NAVIGATION_END -->/;
const blocks={
 css:/\s*\/\* PTH_EDITORIAL_DRAFT_CSS_START \*\/[\s\S]*?\/\* PTH_EDITORIAL_DRAFT_CSS_END \*\//,
 intro:/\s*<!-- PTH_EDITORIAL_DRAFT_INTRO_START -->[\s\S]*?<!-- PTH_EDITORIAL_DRAFT_INTRO_END -->/,
 guide:/<!-- PTH_EDITORIAL_DRAFT_GUIDE_START -->[\s\S]*?<!-- PTH_EDITORIAL_DRAFT_GUIDE_END -->/
};

async function main(){
 if(!source)throw new Error('Indica --json con el snapshot público de fichas revisadas.');
 const [products,manifest,template]=await Promise.all([
  readFile(resolve(source),'utf8').then(JSON.parse),
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
  const category=guide.slug.split('/')[0];
  const values={SEO_TITLE:escape(guide.title+' | ParaTuHogar'),SEO_DESCRIPTION:escape(guide.description),CANONICAL_URL:'https://paratuhogar.org/categoria/'+guide.slug+'/',AFFILIATE_NAVIGATION:navigation,CATEGORY_URL:'/categoria/'+category+'/',CATEGORY_LABEL:escape(labels[category]),TITLE:escape(guide.title),INTRO:escape(guide.intro),ARTICLE_BODY:guideBody(guide)};
  const html=template.replace(/\{\{([A-Z_]+)\}\}/g,(_,key)=>{
   if(!(key in values))throw new Error(`Falta valor de plantilla: ${key}.`);
   return values[key];
  });
  updates.push([join(root,'categoria',guide.slug,'index.html'),html]);
 }
 // Validate all existing anchors before touching the five local proposal pages.
 for(const [path,html] of updates){await mkdir(dirname(path),{recursive:true});await writeFile(path,html,'utf8');}
 console.log('Propuesta local: 2 categorías y 3 guías noindex. Fichas, precios, inventario, sitemap y atribución conservados. No publicada.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
