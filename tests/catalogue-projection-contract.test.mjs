import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateQuery} from '../supabase/functions/secure-data/handler.mjs';
const source=fs.readFileSync(new URL('../js/storefront.js',import.meta.url),'utf8');
test('catalogue and checkout projections use only supported fields and syntax',()=>{
 const load=source.slice(source.indexOf('async function loadProducts()'));
 const columns=load.match(/\.from\('productos'\)[\s\S]*?\.select\('([^']+)'\)/)?.[1];
 assert.ok(columns,'extract actual initial projection, not a copied fixture');
 for(const actor of [null,{id:'g',rol:'gestor'},{id:'s',parent_id:'g',rol:'gestor'},{id:'a',rol:'admin'}])assert.doesNotThrow(()=>validateQuery({table:'productos',columns,orders:[{column:'nombre',ascending:true}]},actor));
 assert.equal(columns,'*','retain current catalogue projection');
 const checkout=source.match(/\.select\('([^']*tamaño_envio[^']*)'\)/)?.[1];
 assert.ok(checkout,'extract actual checkout projection');
 assert.doesNotThrow(()=>validateQuery({table:'productos',columns:checkout},null));
 for(const fields of ['id,tamaño_envio()','id,tamaño_envio:precio','id,otra_ñ'])assert.throws(()=>validateQuery({table:'productos',columns:fields},null),/Selecciona únicamente/);
 assert.throws(()=>validateQuery({table:'pedidos',columns:'id,tamaño_envio'},null),/Selecciona únicamente/);
});
