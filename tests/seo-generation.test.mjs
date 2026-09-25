import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const fixtures = [
  { id: '1', nombre: 'Batería disponible', categoria: 'ENERGIA', precio: 200, disponible: 'SI' },
  { id: '2', nombre: 'Batería temporalmente agotada', categoria: 'ENERGIA', precio: 300, disponible: 'NO' },
  { id: '3', nombre: 'Lavadora temporalmente agotada', categoria: 'LAVADORAS', precio: 400, disponible: 'NO' },
  { id: '4', nombre: 'Equipo sin precio', categoria: 'ENERGIA', precio: 0, disponible: 'SI' },
  { id: '5', nombre: 'Borrador nuevo', categoria: 'ENERGIA', precio: 500, disponible: 'NO' }
];

async function generate(t) {
  const dir = await mkdtemp(join(tmpdir(), 'pth-seo-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await cp(new URL('scripts', root), join(dir, 'scripts'), { recursive: true });
  await cp(new URL('templates', root), join(dir, 'templates'), { recursive: true });
  await writeFile(join(dir, 'index.html'), '<h1>Catálogo de prueba</h1>');
  await writeFile(join(dir, 'gestores.html'), '<h1>Gestores</h1>');
  // Primero estos modelos estuvieron a la venta; ahora 2 y 3 se agotaron.
  await writeFile(join(dir, 'products.json'), JSON.stringify(fixtures.map(product => (
    ['2', '3'].includes(product.id) ? { ...product, disponible: 'SI' } : product
  ))));
  runGenerator(dir);
  await writeFile(join(dir, 'products.json'), JSON.stringify(fixtures));
  runGenerator(dir);
  return dir;
}

function runGenerator(dir) {
  execFileSync(process.execPath, ['scripts/generate-product-pages.mjs', '--json=products.json'], {
    cwd: dir, env: { ...process.env, SITE_URL: 'https://paratuhogar.org' }
  });
}

const productSchema = html => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'].find(item => item['@type'] === 'Product');

test('agotado temporal conserva indexación y sitemap sin ofrecer una compra disponible', async t => {
  const dir = await generate(t);
  const html = await readFile(join(dir, 'producto/bateria-temporalmente-agotada/index.html'), 'utf8');
  const sitemap = await readFile(join(dir, 'sitemap.xml'), 'utf8');
  assert.match(html, /name="robots" content="index,follow/);
  assert.match(sitemap, /<loc>https:\/\/paratuhogar.org\/producto\/bateria-temporalmente-agotada\/<\/loc>/);
  assert.equal(productSchema(html).offers.availability, 'https://schema.org/OutOfStock');
  assert.match(html, /Temporalmente agotado/);
  assert.match(html, /class="btn disabled[^\"]*"[^>]*href="#"/);
  assert.match(html, /href="\/producto\/bateria-disponible\/"/);
});

test('categoría sin stock conserva una página con un estado vacío honesto', async t => {
  const dir = await generate(t);
  const sitemap = await readFile(join(dir, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /<loc>https:\/\/paratuhogar.org\/categoria\/lavadoras\/<\/loc>/);
  const html = await readFile(join(dir, 'categoria/lavadoras/index.html'), 'utf8');
  assert.match(html, /No hay equipos disponibles/);
  assert.doesNotMatch(html, /<article class="card">/);
});

test('producto sin precio queda fuera del sitemap y de las ofertas de categoría', async t => {
  const dir = await generate(t);
  const html = await readFile(join(dir, 'producto/equipo-sin-precio/index.html'), 'utf8');
  const category = await readFile(join(dir, 'categoria/energia/index.html'), 'utf8');
  assert.match(html, /name="robots" content="noindex,follow/);
  assert.doesNotMatch(await readFile(join(dir, 'sitemap.xml'), 'utf8'), /<loc>[^<]*\/producto\/equipo-sin-precio\//);
  assert.doesNotMatch(category, /\/producto\/equipo-sin-precio\//);
  assert.equal(productSchema(html).offers, undefined);
});

test('el validador acepta agotados indexables y detecta una ficha ausente del sitemap', async t => {
  const dir = await generate(t);
  const file = join(dir, 'producto/bateria-temporalmente-agotada/index.html');
  await writeFile(file, (await readFile(file, 'utf8')).replace('content="noindex,follow', 'content="index,follow'));
  const entry = '<url><loc>https://paratuhogar.org/producto/bateria-temporalmente-agotada/</loc></url>';
  let sitemap = await readFile(join(dir, 'sitemap.xml'), 'utf8');
  if (!sitemap.includes('<loc>https://paratuhogar.org/producto/bateria-temporalmente-agotada/</loc>')) {
    sitemap = sitemap.replace('</urlset>', `${entry}</urlset>`);
  }
  await writeFile(join(dir, 'sitemap.xml'), sitemap);
  const valid = spawnSync(process.execPath, ['scripts/validate-seo-pages.mjs'], { cwd: dir, encoding: 'utf8' });
  assert.equal(valid.status, 0, valid.stderr);
  await writeFile(join(dir, 'sitemap.xml'), sitemap.replace(/<url><loc>https:\/\/paratuhogar.org\/producto\/bateria-temporalmente-agotada\/<\/loc>[\s\S]*?<\/url>/, ''));
  const invalid = spawnSync(process.execPath, ['scripts/validate-seo-pages.mjs'], { cwd: dir, encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /página indexable ausente del sitemap/);
});

test('un borrador queda fuera de Google hasta publicarse, y conserva indexación si después se agota', async t => {
  const dir = await generate(t);
  const file = join(dir, 'producto/borrador-nuevo/index.html');
  assert.match((await readFile(file, 'utf8')).match(/<meta name="robots"[^>]*>/)[0], /content="noindex,follow/);
  assert.doesNotMatch(await readFile(join(dir, 'sitemap.xml'), 'utf8'), /\/producto\/borrador-nuevo\//);
  await writeFile(join(dir, 'products.json'), JSON.stringify(fixtures.map(product => (
    product.id === '5' ? { ...product, disponible: 'SI' } : product
  ))));
  runGenerator(dir);
  assert.match((await readFile(file, 'utf8')).match(/<meta name="robots"[^>]*>/)[0], /content="index,follow/);
  await writeFile(join(dir, 'products.json'), JSON.stringify(fixtures));
  runGenerator(dir);
  assert.match((await readFile(file, 'utf8')).match(/<meta name="robots"[^>]*>/)[0], /content="index,follow/);
  assert.match(await readFile(join(dir, 'sitemap.xml'), 'utf8'), /\/producto\/borrador-nuevo\//);
});
