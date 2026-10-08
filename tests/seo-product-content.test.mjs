import test from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {metaDescription,reviewedProductCopy,relatedProducts,isSolarPanel} from '../scripts/seo-product-content.mjs';

const root=new URL('../',import.meta.url);
const panel={id:'e591c61c-7495-4e56-8d77-8f492a7a5df6',nombre:'Panel 30V 400W',categoria:'ENERGIA',precio:220,disponible:'NO',descripcion:'JCN-M400 Panel Solar Monocristalino 400W. Voltaje a máxima potencia: 30.78 V.'};
const available=p=>p.disponible==='SI';
const priced=p=>Number.isFinite(Number(p.precio))&&Number(p.precio)>0;

test('long descriptions keep decimal values and the opening sentence',()=>{
 const first='Panel solar monocristalino JCN-M400 de 400 W con voltaje a máxima potencia de 30.78 V.';
 assert.equal(metaDescription(first+' '+('Detalles adicionales. '.repeat(15)),'Fallback'),first+' Detalles adicionales. Detalles adicionales. Detalles adicionales.');
 const long='Modelo '+('extenso '.repeat(30))+'. Frase corta posterior con suficientes caracteres para superar el mínimo de longitud requerido.';
 assert.equal(metaDescription(long,'Resumen de reserva del modelo correcto sin fragmentos intermedios.'),'Resumen de reserva del modelo correcto sin fragmentos intermedios.');
});

test('reviewed copy requires the same identity and model facts; never promises stock',()=>{
 const copy=reviewedProductCopy(panel);
 assert.match(copy.title,/Panel solar 400 W JCN-M400/);
 assert.match(copy.description,/disponibilidad/);
 assert.doesNotMatch(copy.description,/disponible ahora|entrega inmediata/i);
 for(const changed of [{id:'new'},{nombre:'Otro modelo'},{descripcion:'Nuevo modelo sin datos revisados'}]){
  assert.deepEqual(reviewedProductCopy({...panel,...changed}),{});
 }
});

test('panel alternatives prefer panels and exclude out-of-stock and invalid prices',()=>{
 const solar={id:'solar',nombre:'Panel Solar SUN 630W',categoria:'ENERGIA',precio:180,disponible:'SI'};
 const portable={id:'portable',nombre:'Panel 400W plegable',categoria:'ENERGIA',precio:500,disponible:'SI'};
 const backup={id:'backup',nombre:'Backup 900W',categoria:'ENERGIA',precio:220,disponible:'SI'};
 const list=relatedProducts(panel,[panel,backup,solar,portable,{...solar,id:'empty',precio:0},{...solar,id:'sold',disponible:'NO'}],available,priced);
 assert.deepEqual(list.map(p=>p.id),['solar','portable','backup']);
 assert.equal(isSolarPanel({...solar,categoria:'TECNOLOGIA'}),false);
});

test('generation links published exhausted panels without exposing drafts or changing buying state',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'pth-panel-seo-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 for(const name of ['scripts','templates'])await cp(new URL(name,root),join(dir,name),{recursive:true});
 await mkdir(join(dir,'producto'));await writeFile(join(dir,'producto/publicados.json'),JSON.stringify(['id:'+panel.id]));
 for(const name of ['index.html','gestores.html'])await writeFile(join(dir,name),'<h1>Fixture</h1>');
 const products=[panel,{...panel,id:'draft',nombre:'Panel Solar borrador',descripcion:'',slug:'panel-draft'},
  {...panel,id:'noprice',nombre:'Panel solar sin precio',precio:0,disponible:'SI'},
  {...panel,id:'available',nombre:'Panel Solar SUN 630W',descripcion:'Modelo disponible',precio:180,disponible:'SI'}];
 await writeFile(join(dir,'products.json'),JSON.stringify(products));
 const run=()=>execFileSync(process.execPath,['scripts/generate-product-pages.mjs','--json=products.json'],{cwd:dir});run();
 const html=await readFile(join(dir,'producto/panel-30v-400w/index.html'),'utf8');
 const schema=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'][0];
 assert.match(html,/<title>Panel solar 400 W JCN-M400/);assert.match(html,/class="hero energy-panel"/);
 assert.equal(schema.offers.price,'220.00');assert.equal(schema.offers.availability,'https://schema.org/OutOfStock');
 assert.equal(schema.name,panel.nombre);assert.match(html,/class="btn disabled[^\"]*"[^>]*href="#"/);
 assert.match(html,/name="robots" content="index,follow/);
 const category=await readFile(join(dir,'categoria/energia/index.html'),'utf8');
 const archive=category.match(/<section class="guide panel-archive"[\s\S]*?<\/section>/)[0];
 assert.match(archive,/temporalmente agotados/);assert.match(archive,/href="\/producto\/panel-30v-400w\/"/);
 assert.doesNotMatch(archive,/panel-draft|sin-precio|sun-630w/);
 assert.match(category.match(/<section class="grid"[\s\S]*?<\/section>/)[0],/sun-630w/);
 // Catalogue-authored overrides remain authoritative on the next regeneration.
 products[0].seo_title='Título propio del catálogo';products[0].seo_description='Descripción editorial propia del catálogo con datos confirmados del modelo.';
 await writeFile(join(dir,'products.json'),JSON.stringify(products));run();
 const next=await readFile(join(dir,'producto/panel-30v-400w/index.html'),'utf8');
 assert.match(next,/<title>Título propio del catálogo<\/title>/);assert.match(next,/content="Descripción editorial propia/);
});
