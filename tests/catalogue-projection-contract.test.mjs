import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateQuery} from '../supabase/functions/secure-data/handler.mjs';
const source=fs.readFileSync(new URL('../js/storefront.js',import.meta.url),'utf8');
test('actual initial catalogue projection is accepted by the deployed v7 parser for every catalogue role',()=>{
 const load=source.slice(source.indexOf('async function loadProducts()'));
 const columns=load.match(/\.from\('productos'\)[\s\S]*?\.select\('([^']+)'\)/)?.[1];
 assert.ok(columns,'extract actual initial projection, not a copied fixture');
 for(const actor of [null,{id:'g',rol:'gestor'},{id:'s',parent_id:'g',rol:'gestor'},{id:'a',rol:'admin'}])assert.doesNotThrow(()=>validateQuery({table:'productos',columns,orders:[{column:'nombre',ascending:true}]},actor));
 assert.equal(columns,'*','retain non-ASCII shipping field without weakening parser');
 assert.throws(()=>validateQuery({table:'productos',columns:'id,nombre,tamaño_envio'},null),/Selecciona únicamente/);
});
