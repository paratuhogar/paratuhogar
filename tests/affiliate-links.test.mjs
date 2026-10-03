import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const id='12345678-1234-4234-8234-123456789abc', other='12345678-1234-4234-8234-123456789abd';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
function fixture(initial={}) {
 const values=new Map(Object.entries(initial));
 const root={localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},location:{origin:'https://paratuhogar.org',search:''},atob};
 const context=vm.createContext({window:root,URL,URLSearchParams,Date,TextDecoder,Uint8Array,console});
 vm.runInContext(read('js/affiliate-links.js'),context);return{root,values,context,A:root.PTHAffiliate};
}
test('public alias or first name is display only; new links use unique account ID and preserve filters',()=>{
 const {A}=fixture(),profile={id,nombre:'Alina Rodríguez',nombre_publico:'Mi tienda de Alina',telefono:'+53 50000000'};
 assert.equal(A.publicName(profile),'Mi tienda de Alina');assert.equal(A.publicName({...profile,nombre_publico:null}),'Alina');
 const url=new URL(A.link('https://paratuhogar.org/producto/equipo/?catalog_q=moto&search=Equipo&ref=old',profile));
 assert.equal(url.searchParams.get('ref'),id);assert.equal(url.searchParams.get('catalog_q'),'moto');assert.equal(url.searchParams.get('search'),'Equipo');
 assert.doesNotMatch(url.href,/Alina|Rodríguez|tienda/);
 assert.equal(A.reference({...profile,id:other}),other,'same alias never collapses two accounts');
});
test('old name and gestor links, UUID links and bounded opaque fallbacks remain data-compatible',()=>{
 const {A}=fixture();
 for(const search of ['?ref=Alina%20Rodr%C3%ADguez&contact=5350000000','?gestor=Alina%20Rodr%C3%ADguez&tel=5350000000']){const data=A.incoming(search);assert.equal(data.nombre,'Alina Rodríguez');assert.equal(data.telefono,'5350000000');}
 assert.equal(A.incoming('?ref='+id).id,id);
 const token=Buffer.from(JSON.stringify({n:'Alina Rodríguez',t:'5350000000'})).toString('base64url');
 assert.equal(A.incoming('?r='+token).nombre,'Alina Rodríguez');assert.equal(A.incoming('?r=invalid-json'),null);
 assert.equal(A.incoming('?r='+token+'&ref='+id).nombre,id,'explicit last link reference wins');
 assert.equal(A.incoming('?r='+'A'.repeat(3000)),null);
});
test('valid old memory extends without artificial TTL; expired memory and malformed data are never revived',()=>{
 for(const expiresAt of [1001,undefined]){const f=fixture({pth_referrer_smart:JSON.stringify({nombre:'Alina Rodríguez',timestamp:50,expiresAt})});const record=f.A.read(1000);assert.equal(record.expiresAt,null);assert.equal(record.timestamp,50);assert.equal(f.A.read(9999999999999).nombre,'Alina Rodríguez');}
 for(const expired of [{nombre:'Alina',expiresAt:999},{nombre:'Alina',expiresAt:'invalid'},null]){const f=fixture({pth_referrer_smart:JSON.stringify(expired),pth_referrer:JSON.stringify({nombre:'old fallback'})});assert.equal(f.A.read(1000),null);assert.equal(f.values.size,0);}
 const broken=fixture({pth_referrer:'not JSON'});assert.equal(broken.A.read(),null);
});
test('last-click memory changes only for explicit referrals and survives a fresh page; clearing storage releases it',()=>{
 const f=fixture();f.A.remember({id,nombre:'First Internal',nombre_publico:'Public',telefono:'5350000000'},1);f.A.remember({id:other,nombre:'Second Internal'},2);
 assert.equal(f.A.read(100).id,other);assert.equal(f.A.read().nombre,'Second Internal');
 const refreshed=fixture(Object.fromEntries(f.values));assert.equal(refreshed.A.read().id,other);refreshed.A.clear();assert.equal(refreshed.A.read(),null);
});
test('disabled storage and untrusted display text cannot crash initialization or execute markup',()=>{
 const f=fixture();f.root.localStorage={getItem(){throw Error('blocked');},setItem(){throw Error('full');},removeItem(){throw Error('blocked');}};
 assert.equal(f.A.read(),null);assert.equal(f.A.remember({nombre:'First Internal'}).nombre,'First Internal');
 assert.equal(f.A.publicName({nombre_publico:'<img onerror=run()>\u202e'}),'img onerror=run()');
});
test('Story and Magic Studio copy uses stable IDs and never shares the internal name or financial fields',()=>{
 const f=fixture();f.root.PTHSecureData={token:()=> 'synthetic'};
 for(const file of ['js/studio-designs.js','js/studio-jobs.js'])vm.runInContext(read(file),f.context);
 const text=f.root.PTHStudioJobs.copy([{id:'p',nombre:'Equipo',precio:100,comision:99,cliente:'PRIVATE_SENTINEL'}],{gestorId:id,gestorName:'Alina Rodríguez',gestorPhone:'5350000000',mode:'single'});
 assert.match(text,new RegExp(id));assert.doesNotMatch(text,/Alina|Rodríguez|PRIVATE_SENTINEL|comisi[oó]n/);
});
test('UUID hierarchy disambiguates identical historical names and keeps parent pricing; aliases are not lookup keys',async()=>{
 const f=fixture(),rows=[{id,nombre:'Same Internal',nombre_publico:'Same Alias',parent_id:null},{id:other,nombre:'Same Internal',nombre_publico:'Same Alias',parent_id:id}];let filters=[];
 f.root.PTHSecureData={token:()=>null,cacheSuffix:()=>':public'};
 f.context.supabaseClient={from:()=>({select(){return this;},eq(key,value){this.filter={key,value};return this;},maybeSingle(){this.single=true;return this;},then(ok){filters.push(this.filter);const matches=rows.filter(row=>row[this.filter.key]===this.filter.value);return Promise.resolve(matches.length>1&&this.single?{error:{code:'PGRST116',message:'ambiguous'}}:{data:this.single?matches[0]:matches}).then(ok);}})};
 const source=read('js/storefront.js'),start=source.indexOf('const salesHierarchyCache = new Map();');vm.runInContext(source.slice(start,source.indexOf('// Description hydration',start)),f.context);
 const hierarchy=await f.context.resolveSalesHierarchy(other);assert.equal(hierarchy.agent.id,other);assert.equal(hierarchy.parent.id,id);assert.equal(hierarchy.pricingOwnerName,'Same Internal');
 await assert.rejects(f.context.resolveSalesHierarchy('Same Internal'),error=>error.code==='SELLER_IDENTITY_AMBIGUOUS');
 await assert.rejects(f.context.resolveSalesHierarchy('Same Alias'),error=>error.code==='SELLER_NOT_FOUND');assert.ok(filters.every(q=>q.key==='id'||q.key==='nombre'));
});
