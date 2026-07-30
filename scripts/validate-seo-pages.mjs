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
      if (product?.offers?.availability === 'https://schema.org/OutOfStock' && !robots.includes('noindex')) {
        errors.push(`${folder}: producto agotado debe usar noindex`);
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
for (const folder of categoryFolders) {
  const html = await readFile(join(CATEGORY_ROOT, folder, 'index.html'), 'utf8');
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (!canonical?.endsWith(`/categoria/${folder}/`)) errors.push(`${folder}: canonical de categoría incorrecto`);
  if (!html.includes('"@type":"ItemList"')) errors.push(`${folder}: falta ItemList`);
  if (!html.includes('<h1>')) errors.push(`${folder}: falta H1 de categoría`);
  if (canonical && !sitemap.includes(`<loc>${canonical}</loc>`)) errors.push(`${folder}: categoría ausente del sitemap`);
}

if (errors.length) {
  console.error(`SEO inválido: ${errors.length} problemas`);
  errors.slice(0, 50).forEach(error => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`SEO válido: ${folders.length} fichas, ${categoryFolders.length} categorías, ${canonicals.size} canonicals únicos y sitemap completo.`);
}
