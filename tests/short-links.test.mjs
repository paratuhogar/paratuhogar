import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const child='22222222-2222-4222-a222-222222222222',parent='11111111-1111-4111-a111-111111111111';
const long='https://paratuhogar.org/?ref='+child;
function fixture(rows=[], failure=null) {
 const state={rows:[...rows],reads:0,inserts:0,collisions:0};
 const client={from(table){assert.equal(table,'short_links');return {filters:{},select(){return this;},eq(k,v){this.filters[k]=v;return this;},limit(){return this;},maybeSingle(){return this;},abortSignal(){return this;},insert(values){this.values=values;return this;},then(ok,bad){return Promise.resolve().then(()=>{if(failure)throw Error(failure);if(this.values){state.inserts++;if(state.collisions-- >0)return{error:{code:'23505'}};state.rows.push(...this.values);return{error:null};}state.reads++;return{data:state.rows.find(r=>Object.entries(this.filters).every(([k,v])=>r[k]===v))||null,error:null};}).then(ok,bad);}};}};
 const root={location:{origin:'https://paratuhogar.org'},crypto:globalThis.crypto,setTimeout,clearTimeout};
 const context=vm.createContext({window:root,URL,URLSearchParams,AbortController,Uint32Array,console});
 vm.runInContext(fs.readFileSync(new URL('../js/short-links.js',import.meta.url),'utf8'),context);
 root.PTHShortLinks.configure(client);return{S:root.PTHShortLinks,state};
}
test('new personal URL is short, own-domain, reusable and bound only to the child UUID',async()=>{
 const {S,state}=fixture();const [a,b]=await Promise.all([S.shorten(long,{gestor:'Child',expectedRef:child}),S.shorten(long,{gestor:'Child',expectedRef:child})]);
 assert.equal(a,b);assert.match(a,/^https:\/\/paratuhogar.org\/\?s=[a-z0-9]{7}$/);assert.equal(state.inserts,1);
 assert.equal(new URL(state.rows[0].original_url).searchParams.get('ref'),child);assert.doesNotMatch(a,/ref=|contact=|Child/);
 assert.equal(await S.shorten(a,{expectedRef:child}),a);await assert.rejects(S.shorten(a,{expectedRef:parent}),/cuenta|enlace/i);
});
test('existing slug is verified before reuse; unknown codes never pass through',async()=>{
 const {S,state}=fixture([{slug:'oldcode',original_url:long,gestor:'Child'}]);
 assert.equal(await S.shorten(long,{gestor:'Child',expectedRef:child}),'https://paratuhogar.org/?s=oldcode');assert.equal(state.inserts,0);
 await assert.rejects(S.shorten('https://paratuhogar.org/?s=missing',{expectedRef:child}));
 await assert.rejects(S.shorten('https://paratuhogar.org/?s='));
});
test('network failures reject and never return opaque or long fallback',async()=>{
 const {S}=fixture([],'offline');await assert.rejects(S.shorten(long,{gestor:'Child',expectedRef:child}));
});
test('slug collisions retry without changing the destination',async()=>{
 const {S,state}=fixture();state.collisions=2;assert.match(await S.shorten(long,{gestor:'Child'}),/\?s=/);assert.equal(state.inserts,3);assert.equal(state.rows[0].original_url,long);
});
test('legacy store host normalizes to current domain, preserving selected product and referral',async()=>{
 const {S}=fixture([{slug:'legacy1',original_url:'https://paratuhogar.github.io/paratuhogar/?ref='+child+'&search=Equipo',gestor:'Wrong label'}]);
 const result=await S.resolve('legacy1');const url=new URL(result.url);assert.equal(url.origin,'https://paratuhogar.org');assert.equal(url.pathname,'/');assert.equal(url.searchParams.get('ref'),child);assert.equal(url.searchParams.get('search'),'Equipo');
});
test('untrusted, local, protocol-relative external and circular destinations are refused',async()=>{
 const {S}=fixture([{slug:'circle1',original_url:'https://paratuhogar.org/?s=circle1',gestor:'Child'}]);
 for(const value of ['javascript:alert(1)','http://127.0.0.1:8765/?ref='+child,'https://evil.test/?ref='+child,'https://evil.test/fake.pdf','https://raw.githubusercontent.com/attacker/fake/main/file.pdf','https://user:password@paratuhogar.org/?ref='+child,'//evil.test/'])assert.throws(()=>S.target(value));
 assert.equal(S.target('https://raw.githubusercontent.com/paratuhogar/paratuhogar-fotos/main/ficha.pdf').hostname,'raw.githubusercontent.com');
 await assert.rejects(S.resolve('circle1'));await assert.rejects(S.resolve('../invalid'));
});
