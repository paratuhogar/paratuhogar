import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {createHandler} from '../supabase/functions/secure-data/handler.mjs';
const source=fs.readFileSync(new URL('../js/storefront.js',import.meta.url),'utf8');
const start=source.indexOf('let registrationBusy=false;');const end=source.indexOf('\nasync function ',source.indexOf('async function processRegister()',start)+40);
const valid={source:'recomendacion',referrer:'',referrerGestor:'no_se',experience:'no',platforms:[],clients:'0',loyalty:'',channels:'no',storesCount:0};
function fixture(){
 const fields=new Map(Object.entries({'reg-submit':{disabled:false,innerText:'Enviar'},'reg-status':{textContent:''},'reg-name':{value:'Solicitud Demo'},'reg-email':{value:'demo@example.test'},'reg-tel':{value:'demo-phone'},'reg-pass':{value:'fixture-only'}}));
 let reads=0,inserts=0,mode=null,release;
 const context=vm.createContext({document:{getElementById:id=>fields.get(id)},localStorage:{getItem:()=>null},crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},PTHQuestionnaire:{read:()=>valid},alert:message=>{fields.get('reg-status').textContent=message},toggleLoginMode:value=>{mode=value},supabaseClient:{from(){return{select(){return this},eq(){return this},maybeSingle:async()=>{reads++;return {data:inserts?{id:'saved',estado:'pendiente'}:null,error:null}},insert:async()=>{inserts++;if(inserts===1){await new Promise(resolve=>release=resolve);return {error:{message:'response lost'}}}return {error:null}}}}}});
 vm.runInContext(source.slice(start,end),context);
 return {fields,run:()=>vm.runInContext('processRegister()',context),release:()=>release(),count:()=>inserts,mode:()=>mode};
}
test('double click is blocked and lost response retains answers and can retry a saved pending request',async()=>{
 const f=fixture();const first=f.run();await new Promise(resolve=>setImmediate(resolve));await f.run();assert.equal(f.count(),1);f.release();await first;
 assert.equal(f.fields.get('reg-submit').disabled,false);assert.match(f.fields.get('reg-status').textContent,/vuelve a intentar/);assert.equal(f.fields.get('reg-name').value,'Solicitud Demo');
 await f.run();assert.equal(f.count(),2);assert.equal(f.mode(),'login');
});
test('store count input is wired and revealing/hiding names disables hidden fields',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/id="q-storesCount" oninput="PTHQuestionnaire.sync\(document\)"/);
 const c=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../js/gestor-questionnaire.js',import.meta.url),'utf8'),c);
 const nodes={};for(const key of ['source','experience','channels','storesCount'])nodes['q-'+key]={value:key==='storesCount'?'2':'no'};
 for(const key of ['referral','other','time','channels','stores'])nodes['q-block-'+key]={hidden:true,fields:[{disabled:true}],querySelectorAll(){return this.fields}};
 const doc={getElementById:id=>nodes[id]};c.PTHQuestionnaire.sync(doc);assert.equal(nodes['q-block-stores'].hidden,false);assert.equal(nodes['q-block-stores'].fields[0].disabled,false);
 nodes['q-storesCount'].value='0';c.PTHQuestionnaire.sync(doc);assert.equal(nodes['q-block-stores'].hidden,true);assert.equal(nodes['q-block-stores'].fields[0].disabled,true);
});
function serverFixture(){
 const rows=[];let failed=false;
 const db={from(table){assert.equal(table,'gestores');let op='select',values,filters=[];const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},limit(){return q},order(){return q},insert(v){op='insert';values=v;return q},maybeSingle(){q.single=true;return q},then(resolve,reject){return Promise.resolve().then(()=>{if(op==='insert'){rows.push(...values);if(!failed){failed=true;return {data:null,error:{message:'simulated lost response'}}}}const data=rows.filter(r=>filters.every(f=>f(r)));return {data:q.single?data[0]||null:data,error:null}}).then(resolve,reject)}};return q}};
 const handler=createHandler({db});const request=async values=>{const response=await handler(new Request('https://example.test',{method:'POST',body:JSON.stringify({action:'query',table:'gestores',op:'insert',values:[values]})}));return await response.json()};
 return {rows,request};
}
test('server stores validated answers atomically and retry with same token does not create another applicant',async()=>{
 const f=serverFixture();const application={nombre:'Demo',telefono:'fixture-phone',password:'fixture-only',questionnaire:valid,application_token:'00000000-0000-4000-8000-000000000001',rol:'admin',estado:'activo'};
 const first=await f.request(application);assert.ok(first.error);assert.equal(f.rows.length,1);assert.equal(f.rows[0].rol,'gestor');assert.equal(f.rows[0].estado,'pendiente');assert.equal(f.rows[0].questionnaire.version,1);
 const retry=await f.request(application);assert.equal(retry.error,null);assert.equal(f.rows.length,1);
 const other=await f.request({...application,application_token:'00000000-0000-4000-8000-000000000002'});assert.ok(other.error);assert.equal(f.rows.length,1);
});
test('invalid visible answers stop registration before insertion',async()=>{
 const f=serverFixture();const result=await f.request({nombre:'Demo',telefono:'fixture-phone',password:'fixture-only',questionnaire:{...valid,storesCount:3},application_token:'00000000-0000-4000-8000-000000000001'});assert.ok(result.error);assert.equal(f.rows.length,0);
});
test('administrative renderer labels old requests and treats every answer as untrusted text',()=>{
 class Element{constructor(tag){this.tag=tag;this.children=[];this.textContent=''}append(...items){this.children.push(...items)}}
 const document={createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text})};
 const c=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../js/gestor-questionnaire.js',import.meta.url),'utf8'),c);
 const old=c.PTHQuestionnaire.render(document,null);assert.equal(old.children[0].textContent,'Solicitud anterior al cuestionario');
 const answers=c.PTHQuestionnaire.render(document,{...valid,referrer:'<img src=x onerror=alert(1)>'});
 assert.equal(answers.children[0].textContent,'Respuestas del cuestionario');assert.equal(answers.children.length,8);
 assert.equal(answers.children[2].children[1].textContent,'<img src=x onerror=alert(1)> · ¿Es gestor? No sé');
});
test('browser and edge validator copies stay identical',()=>{
 assert.equal(fs.readFileSync(new URL('../js/gestor-questionnaire.js',import.meta.url),'utf8'),fs.readFileSync(new URL('../supabase/functions/secure-data/questionnaire-validation.js',import.meta.url),'utf8'));
});
