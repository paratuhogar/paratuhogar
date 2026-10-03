#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const PRODUCT_ROOT = join(ROOT, 'producto');
const CATEGORY_ROOT = join(ROOT, 'categoria');
const errors = [];
const canonicals = new Set();
const decodeEntities = value => String(value || '')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>');

const folders = (await readdir(PRODUCT_ROOT, { withFileTypes: true }))
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name);

for (const folder of folders) {
  const file = join(PRODUCT_ROOT, folder, 'index.html');
  const html = await readFile(file, 'utf8');
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim();
  const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
  const robots = html.match(/<meta name="robots" content="([^"]*)"/)?.[1] || '';
  const h1 = html.match(/<h1>([\s\S]*?)<\/h1>/)?.[1]?.trim();
  const jsonText = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];

  if (!canonical?.endsWith(`/producto/${folder}/`)) errors.push(`${folder}: canonical incorrecto`);
  if (canonical && canonicals.has(canonical)) errors.push(`${folder}: canonical duplicado`);
  if (canonical) canonicals.add(canonical);
  if (!title || title.length > 65) errors.push(`${folder}: title ausente o demasiado largo`);
  const decodedDescription = decodeEntities(description);
  if (!decodedDescription || decodedDescription.length < 45 || decodedDescription.length > 170) errors.push(`${folder}: description fuera de rango`);
  if (!h1) errors.push(`${folder}: falta H1`);
  if (!html.includes('property="og:image"')) errors.push(`${folder}: falta og:image`);
  if (!jsonText) {
    errors.push(`${folder}: falta JSON-LD`);
  } else {
    try {
      const data = JSON.parse(jsonText);
      const product = data['@graph']?.find(item => item['@type'] === 'Product');
      const breadcrumbs = data['@graph']?.find(item => item['@type'] === 'BreadcrumbList');
      if (product?.offers && (!product.offers.priceCurrency || !product.offers.availability)) errors.push(`${folder}: Offer incompleto`);
      if (!breadcrumbs?.itemListElement?.length) errors.push(`${folder}: breadcrumbs incompletos`);
      if (!product) errors.push(`${folder}: falta Product`);
      const offerPrice = Number(product?.offers?.price);
      if (!robots.includes('noindex') && (!Number.isFinite(offerPrice) || offerPrice <= 0)) {
        errors.push(`${folder}: ficha indexable sin precio válido`);
      }
    } catch (error) {
      errors.push(`${folder}: JSON-LD inválido`);
    }
  }
}

const sitemap = await readFile(join(ROOT, 'sitemap.xml'), 'utf8');
for (const canonical of canonicals) {
  const folder = canonical.match(/\/producto\/([^/]+)\/$/)?.[1];
  const html = folder ? await readFile(join(PRODUCT_ROOT, folder, 'index.html'), 'utf8') : '';
  const indexable = !/<meta name="robots" content="[^"]*noindex/i.test(html);
  if (indexable && !sitemap.includes(`<loc>${canonical}</loc>`)) errors.push(`${canonical}: página indexable ausente del sitemap`);
  if (!indexable && sitemap.includes(`<loc>${canonical}</loc>`)) errors.push(`${canonical}: página noindex presente en el sitemap`);
}

const categoryFolders = (await readdir(CATEGORY_ROOT, { withFileTypes: true }))
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name);
let guideCount=0;
for (const folder of categoryFolders) {
  const html = await readFile(join(CATEGORY_ROOT, folder, 'index.html'), 'utf8');
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (!canonical?.endsWith(`/categoria/${folder}/`)) errors.push(`${folder}: canonical de categoría incorrecto`);
  if (!html.includes('"@type":"ItemList"')) errors.push(`${folder}: falta ItemList`);
  if (!html.includes('<h1>')) errors.push(`${folder}: falta H1 de categoría`);
  if (canonical && !sitemap.includes(`<loc>${canonical}</loc>`)) errors.push(`${folder}: categoría ausente del sitemap`);
  if(canonical&&canonicals.has(canonical))errors.push(`${folder}: canonical duplicado`);
  if(canonical)canonicals.add(canonical);
  const guides=(await readdir(join(CATEGORY_ROOT,folder),{withFileTypes:true})).filter(entry=>entry.isDirectory());
  for(const guide of guides){
    guideCount++;
    const name=`${folder}/${guide.name}`;
    const guideHTML=await readFile(join(CATEGORY_ROOT,name,'index.html'),'utf8');
    const guideCanonical=guideHTML.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    const guideTitle=decodeEntities(guideHTML.match(/<title>([\s\S]*?)<\/title>/)?.[1]);
    const guideDescription=decodeEntities(guideHTML.match(/<meta name="description" content="([^"]*)"/)?.[1]);
    if(!guideCanonical?.endsWith(`/categoria/${name}/`))errors.push(`${name}: canonical de guía incorrecto`);
    if(guideCanonical&&canonicals.has(guideCanonical))errors.push(`${name}: canonical duplicado`);
    if(guideCanonical)canonicals.add(guideCanonical);
    if(!guideTitle||guideTitle.length>65)errors.push(`${name}: título de guía inválido`);
    if(guideDescription.length<45||guideDescription.length>170)errors.push(`${name}: descripción de guía inválida`);
    if(!guideHTML.includes('<h1>'))errors.push(`${name}: falta H1 de guía`);
    if(!guideHTML.includes('property="og:image"'))errors.push(`${name}: falta imagen social`);
    const indexable=!/<meta name="robots" content="[^"]*noindex/i.test(guideHTML);
    if(indexable&&!sitemap.includes(`<loc>${guideCanonical}</loc>`))errors.push(`${name}: guía indexable ausente del sitemap`);
    if(!indexable&&sitemap.includes(`<loc>${guideCanonical}</loc>`))errors.push(`${name}: guía noindex presente en el sitemap`);
    try{
      const schema=JSON.parse(guideHTML.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1]);
      const article=schema['@graph']?.find(item=>item['@type']==='Article');
      const crumbs=schema['@graph']?.find(item=>item['@type']==='BreadcrumbList');
      if(article?.url!==guideCanonical||!article?.headline)errors.push(`${name}: Article incompleto`);
      if(crumbs?.itemListElement?.length!==3)errors.push(`${name}: migas de pan incompletas`);
    }catch{errors.push(`${name}: JSON-LD de guía inválido`);}
    for(const href of [...guideHTML.matchAll(/href="(\/[^"#]*)"/g)].map(match=>decodeEntities(match[1]))){
      const path=new URL(href,'https://paratuhogar.org').pathname;
      if(!path.startsWith('/categoria/')&&!path.startsWith('/producto/'))continue;
      try{await readFile(join(ROOT,path,'index.html'),'utf8');}catch{errors.push(`${name}: enlace interno ausente ${path}`);}
    }
  }
}

if (errors.length) {
  console.error(`SEO inválido: ${errors.length} problemas`);
  errors.slice(0, 50).forEach(error => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`SEO válido: ${folders.length} fichas, ${categoryFolders.length} categorías, ${guideCount} guías, ${canonicals.size} canonicals únicos y sitemap completo.`);
}
