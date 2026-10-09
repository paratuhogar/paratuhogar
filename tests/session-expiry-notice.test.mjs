import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../js/storefront.js',import.meta.url),'utf8');
const start=source.indexOf('function openLoginModal('),end=source.indexOf('// Ejecutar inmediatamente',start);
function fixture(online=true){
 const elements=new Map(),listeners=new Map();let opened=0;
 elements.set('login-overlay',{classList:{remove(name){assert.equal(name,'hidden');opened++;}},prepend(node){elements.set(node.id,node);}});
 const root={document:{getElementById:id=>elements.get(id),createElement:()=>({setAttribute(){}})},navigator:{onLine:online},toggleLoginMode(){},console};
 root.window={addEventListener:(name,listener)=>listeners.set(name,listener)};
 vm.runInNewContext(source.slice(start,end),root);
 return {root,elements,listeners,opened:()=>opened};
}
test('online expiry opens login with an explanatory notice without touching pending storage',()=>{
 const f=fixture();assert.ok(f.listeners.has('pth:session-changed'));
 f.listeners.get('pth:session-changed')({reason:'expired'});
 assert.equal(f.opened(),1);assert.match(f.elements.get('pth-session-login-notice').textContent,/sesión.*venci|sesión.*entrar/i);
});
test('offline expiry does not interrupt local order drafting with a login modal',()=>{
 const f=fixture(false);assert.ok(f.listeners.has('pth:session-changed'));
 f.listeners.get('pth:session-changed')({reason:'expired'});assert.equal(f.opened(),0);
});
for(const prepared of [false,true])test(`a cold online start ${prepared?'with a prepared offline copy':'without an offline copy'} shows login after local session expiry`,async()=>{
 const f=fixture(),items=new Map([['pth_secure_token','a'.repeat(64)],['pth_secure_token_expires_at',String(Date.now()-1000)],['pth_session',JSON.stringify({name:'Fixture',data:{id:'owner',nombre:'Fixture',estado:'activo',password:'__session__'}})]]);
 const storage={getItem:k=>items.get(k)||null,setItem:(k,v)=>items.set(k,String(v)),removeItem:k=>items.delete(k),key:i=>[...items.keys()][i],get length(){return items.size;}};
 f.elements.get('login-overlay').classList.add=()=>{throw Error('Expired login must remain visible');};
 Object.assign(f.root,{localStorage:storage,AbortSignal,location:{pathname:'/'},Event:class{constructor(type){this.type=type;}},dispatchEvent:e=>f.listeners.get(e.type)?.(e),fetch(){throw Error('Expired local session must not send requests');},offlineStorefront:{current:()=>null,fallback:async()=>false},setupSession(){assert.fail('Expired session cannot set up account');},loadProducts(){},loadInternalAssets(){},showCatalogLoadError(){},renderLowConnectivityPanel(){}});
 Object.assign(f.root.window,f.root);f.root.window.window=f.root.window;
 if(prepared){const profile={id:'owner',nombre:'Fixture',estado:'activo',password:'__session__'};storage.setItem('pth_offline_context_v1',JSON.stringify({profile,savedAt:Date.now()-1000,expiresAt:Date.now()+86400000}));f.root.window.offlineStorefront={current:()=>({profile}),fallback:async()=>true};f.root.window.setupSession=()=>{};}
 vm.runInNewContext(fs.readFileSync(new URL('../js/secure-data.js',import.meta.url),'utf8'),f.root.window);
 f.root.window.PTHSecureData.clearSession('expired');const beforeStartup=f.opened();
 const after=source.indexOf("window.addEventListener('DOMContentLoaded'"),begin=source.indexOf('    try {',after),end=source.indexOf('    initAutoSaveSystem();',begin);
 await vm.runInNewContext('(async()=>{'+source.slice(begin,end)+'})()',f.root.window);
 assert.ok(f.opened()>beforeStartup);assert.equal(f.root.window.PTHSecureData.token(),null);
});
