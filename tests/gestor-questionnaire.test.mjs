import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {projectRow} from '../supabase/functions/secure-data/policy.mjs';
import {validateQuery} from '../supabase/functions/secure-data/handler.mjs';
const context=vm.createContext({});
const path=new URL('../js/gestor-questionnaire.js',import.meta.url);
if(fs.existsSync(path))vm.runInContext(fs.readFileSync(path,'utf8'),context);
const valid={source:'recomendacion',referrer:'',referrerGestor:'no_se',experience:'no',platforms:[],clients:'0',loyalty:'',channels:'no',storesCount:0};
test('novices without an identified referrer or other stores can apply',()=>{
 assert.equal(typeof context.PTHQuestionnaire?.validate,'function');
 const result=context.PTHQuestionnaire.validate(valid);assert.equal(result.referrer,'');assert.equal(result.experienceMonths,null);
});
test('conditional fields normalize stale answers and reject incomplete visible fields',()=>{
 const q=context.PTHQuestionnaire;assert.ok(q);
 assert.throws(()=>q.validate({...valid,source:'otro'}));
 assert.throws(()=>q.validate({...valid,experience:'si',experienceMonths:-1}));
 assert.throws(()=>q.validate({...valid,channels:'si',channelSize:''}));
 assert.throws(()=>q.validate({...valid,storesCount:2,storeNames:''}));
 const result=q.validate({...valid,source:'facebook',referrer:'hidden',experienceMonths:9,channelSize:'hidden',storeNames:'hidden'});
 assert.equal(result.referrer,'');assert.equal(result.channelSize,'');assert.equal(result.storeNames,'');
 assert.equal(q.validate({...valid,storesCount:2,storeNames:'Tienda Demo, Otra Demo'}).storesCount,2);
});
test('answers are private to administrators, including own profile and parent views',()=>{
 const row={id:'applicant',parent_id:'parent',questionnaire:{referrer:'private'},application_token:'private'};
 for(const actor of [null,{id:'applicant',rol:'gestor'},{id:'parent',rol:'gestor'},{id:'messenger',rol:'mensajero'}]) {
 const projected=projectRow('gestores',row,actor);assert.equal(projected.questionnaire,undefined);assert.equal(projected.application_token,undefined);
 }
 assert.deepEqual(projectRow('gestores',row,{id:'admin',rol:'admin'}).questionnaire,row.questionnaire);
});
test('private answers and idempotency keys cannot be probed by filters or ordering',()=>{
 for(const column of ['questionnaire','application_token'])for(const actor of [null,{id:'g',rol:'gestor'},{id:'s',parent_id:'p'}]){
 assert.throws(()=>validateQuery({table:'gestores',filters:[{method:'eq',column,value:'probe'}]},actor));
 assert.throws(()=>validateQuery({table:'gestores',orders:[{column}]},actor));
 }
});
test('validation messages use visible Spanish questions instead of storage keys',()=>{
 assert.throws(()=>context.PTHQuestionnaire.validate({...valid,source:''}),/cómo conociste ParaTuHogar/);
 assert.throws(()=>context.PTHQuestionnaire.validate({...valid,storesCount:2,storeNames:''}),/nombres de las tiendas/);
});
