import test from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {categoryEditorial,GUIDE_DRAFTS,guideBody} from '../scripts/seo-category-editorial.mjs';

const root=new URL('../',import.meta.url);
const grid=html=>html.match(/<section class="grid"[\s\S]*?<\/section>/)[0];
const nav=html=>html.match(/<!-- PTH_AFFILIATE_NAVIGATION_START -->[\s\S]*?<!-- PTH_AFFILIATE_NAVIGATION_END -->/)[0];
const candidate={slug:'bateria-15kwh-must',nombre:'Batería <script>alert(1)</script>',garantia:'15 días <img onerror="boom">',mensajeria:'Mensajería por costo adicional',disponible:'SI'};

test('la selección escapa los datos y conserva el plazo informado de la unidad',()=>{
 const result=categoryEditorial('energia',[candidate],new Map([[candidate,candidate.slug]]));
 assert.match(result.guideHTML,/15 días &lt;img onerror=&quot;boom&quot;&gt;/);
 assert.match(result.guideHTML,/Batería &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
 assert.doesNotMatch(result.guideHTML,/<script|<img|1 mes|\$|onclick=/);
 assert.match(result.guideHTML,/Mensajería por costo adicional/);
 assert.equal(categoryEditorial('cocina',[],new Map()).html,'');
});

test('las tres guías originales piden verificar datos pendientes y no afirman autonomía ni entrega incluida',()=>{
 assert.equal(GUIDE_DRAFTS.length,3);
 const all=GUIDE_DRAFTS.map(guideBody).join('');
 assert.match(all,/manual del modelo exacto/);
 assert.match(all,/coste adicional/);
 assert.match(all,/Preparar el carrito no envía el pedido/);
 assert.doesNotMatch(all,/gestor|subgestor|\$\d|entrega gratis|horas garantizadas|onclick=/i);
 const malicious={sections:[['<h2>','<script>']],links:[['/','<img>']]};
 assert.doesNotMatch(guideBody(malicious),/<script>|<img>/);
});

async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'pth-editorial-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 await cp(new URL('scripts',root),join(dir,'scripts'),{recursive:true});
 await cp(new URL('templates',root),join(dir,'templates'),{recursive:true});
 await mkdir(join(dir,'producto'),{recursive:true});
 await cp(new URL('producto/manifest.json',root),join(dir,'producto/manifest.json'));
 const pages={};
 for(const slug of ['energia','mundo-frio']){
  await mkdir(join(dir,'categoria',slug),{recursive:true});
  pages[slug]=await readFile(new URL(`categoria/${slug}/index.html`,root),'utf8');
  await writeFile(join(dir,'categoria',slug,'index.html'),pages[slug]);
 }
 const unavailable={...candidate,slug:'estacion-de-energia-800w-gnercell',nombre:'NO OFRECER ESTA UNIDAD',disponible:'NO'};
 await writeFile(join(dir,'snapshot.json'),JSON.stringify([candidate,unavailable]));
 return {dir,pages};
}
const run=dir=>execFileSync(process.execPath,['scripts/preview-category-editorial.mjs','--json=snapshot.json'],{cwd:dir,encoding:'utf8'});

test('el preview conserva precios, grillas y atribución, descarta agotados y es idempotente',async t=>{
 const {dir,pages}=await fixture(t);
 const manifest=await readFile(join(dir,'producto/manifest.json'),'utf8');
 run(dir);
 const first=[];
 for(const slug of Object.keys(pages)){
  const html=await readFile(join(dir,'categoria',slug,'index.html'),'utf8');
  assert.equal(grid(html),grid(pages[slug]));
  assert.equal(nav(html),nav(pages[slug]));
  for(const pattern of [/<title>[\s\S]*?<\/title>/,/<link rel="canonical"[^>]*>/,/<script type="application\/ld\+json">[\s\S]*?<\/script>/])assert.equal(html.match(pattern)[0],pages[slug].match(pattern)[0]);
  assert.doesNotMatch(html,/NO OFRECER ESTA UNIDAD/);
  first.push(html);
 }
 assert.equal(await readFile(join(dir,'producto/manifest.json'),'utf8'),manifest);
 for(const guide of GUIDE_DRAFTS){
  const html=await readFile(join(dir,'categoria',guide.slug,'index.html'),'utf8');
  assert.match(html,/name="robots" content="noindex,follow"/);
  assert.equal(nav(html),nav(pages.energia));
  assert.doesNotMatch(html,/google-measurement|\{\{[A-Z_]+\}\}/);
 }
 run(dir);
 for(const [i,slug] of Object.keys(pages).entries())assert.equal(await readFile(join(dir,'categoria',slug,'index.html'),'utf8'),first[i]);
});

test('una plantilla de categoría inesperada detiene el preview antes de escribir otras páginas',async t=>{
 const {dir,pages}=await fixture(t);
 await writeFile(join(dir,'categoria/mundo-frio/index.html'),pages['mundo-frio'].replace('class="grid"','class="unexpected-grid"'));
 const result=spawnSync(process.execPath,['scripts/preview-category-editorial.mjs','--json=snapshot.json'],{cwd:dir,encoding:'utf8'});
 assert.equal(result.status,1);
 assert.match(result.stderr,/Falta ancla/);
 assert.equal(await readFile(join(dir,'categoria/energia/index.html'),'utf8'),pages.energia);
});
