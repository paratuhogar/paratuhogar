import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../js/storefront-extras.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('let pendingGestoresCache'),source.indexOf('// 2. RENDERIZADO DE TABLA'));
function fixture(){
 const events={},reads=[];
 const context=vm.createContext({Date,console,Set,document:{getElementById:()=>null},window:{addEventListener:(name,fn)=>events[name]=fn},
  PTHAdminData:{pages:()=>new Promise((resolve,reject)=>reads.push({resolve,reject}))},
  supabaseClient:{from(){const q={select:()=>q,order:()=>q,limit:()=>q,then:(ok,no)=>Promise.resolve({data:[]}).then(ok,no)};return q;}},globalAgentsList:[],renderAgentTeamTable(){}});
 vm.runInContext(code,context);
 return {context,events,reads,run:s=>vm.runInContext(s,context)};
}
const row=id=>({id,nombre:'Prueba',estado:'pendiente',created_at:'2026-10-01T23:00:00Z'});
test('repeated refreshes share one roster read until completion',async()=>{
 const f=fixture(),first=f.run('loadPendingGestores()');
 await f.run('loadPendingGestores()');assert.equal(f.reads.length,1);
 f.reads[0].resolve([row('first')]);await first;
 assert.equal(f.run('pendingGestoresLoading'),false);assert.equal(f.run('pendingGestoresCache[0].id'),'first');
});
test('an interrupted old account load cannot restore records or unlock a newer load',async()=>{
 const f=fixture(),old=f.run('loadPendingGestores()');
 f.events['pth:session-changed']();const fresh=f.run('loadPendingGestores()');assert.equal(f.reads.length,2);
 f.reads[0].resolve([row('old')]);await old;
 assert.equal(f.run('pendingGestoresCache.length'),0);assert.equal(f.run('pendingGestoresLoading'),true);
 f.reads[1].resolve([row('new')]);await fresh;
 assert.equal(f.run('pendingGestoresCache[0].id'),'new');assert.equal(f.run('pendingGestoresLoading'),false);
});
test('roster failure keeps previous rows and allows another refresh',async()=>{
 const f=fixture();f.run("pendingGestoresCache=[{id:'previous'}]");const failed=f.run('loadPendingGestores()');
 f.reads[0].reject(Error('network failure'));await failed;
 assert.equal(f.run('pendingGestoresCache[0].id'),'previous');assert.equal(f.run('pendingGestoresLoading'),false);
});
