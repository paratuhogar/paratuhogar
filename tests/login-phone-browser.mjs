// Isolated Chrome profile, local synthetic handler only; never contacts production.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {sessionFixture} from './fixtures/session-infrastructure.mjs';
const f=await sessionFixture();f.rows.pth_secure_sessions=[];
f.rows.gestores=[{id:'owner',nombre:'José Pérez',telefono:'52929310',rol:'gestor',estado:'activo',activo:true,password:'fixture-only'},
 {id:'other',nombre:'Jose Perez',telefono:'53123456',rol:'gestor',estado:'bloqueado',activo:false,password:'fixture-only'}];
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const form=index.slice(index.indexOf('<div id="form-login"'),index.indexOf('<!-- FORMULARIO REGISTRO -->'));
const client=fs.readFileSync(new URL('../js/secure-data.js',import.meta.url),'utf8');
const html='<!doctype html><meta charset="utf-8"><title>Fixture login QA</title>'+form+'<pre id="result">RUNNING</pre><script>'+`
 const realFetch=window.fetch;window.fetch=(_url,options)=>realFetch('/gateway',options);
`+client+`\n(async()=>{
 const check=(ok,message)=>{if(!ok)throw Error(message);};
 check(document.getElementById('log-user').getAttribute('aria-describedby')==='login-phone-help','missing accessible help');
 check(document.getElementById('login-phone-help').textContent.includes('+53'),'missing Cuban formats');
 let message='';try{await PTHSecureData.login('José Pérez','fixture-only');throw Error('ambiguous login accepted');}catch(e){message=e.message;check(message.includes('teléfono'),'no phone guidance: '+message);}
 check(!PTHSecureData.token(),'ambiguous login created token');
 for(const phone of ['52929310','+5352929310','+53 5 2929310']){
  const profile=await PTHSecureData.login(phone,'fixture-only');check(profile.id==='owner','wrong account');
  check(PTHSecureData.offlineProfile().id==='owner','offline profile missing');
  check((await PTHSecureData.restore()).id==='owner','session restore failed');
 }
 window.fetch=()=>Promise.reject(Error('Fixture offline'));
 check(PTHSecureData.offlineProfile().id==='owner','offline session lost');
 document.getElementById('result').textContent='PASS: ambiguous name, 3 Cuban formats, session and offline profile';
})().catch(e=>{document.getElementById('result').textContent='FAIL: '+e.message;});</script>`;
const server=http.createServer(async(req,res)=>{
 if(req.url==='/gateway'){
  let body='';for await(const chunk of req)body+=chunk;
  const response=await f.fetch('',{method:'POST',headers:{...req.headers,origin:'http://127.0.0.1:8080'},body});
  res.writeHead(response.status,{'content-type':'application/json'});res.end(await response.text());
 }else{res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'pth-login-fixture-'));
try{
 const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',[
  '--headless','--disable-gpu','--no-first-run','--disable-background-networking','--disable-component-update',
  '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',`--user-data-dir=${profile}`,
  '--dump-dom','--virtual-time-budget=10000',`http://127.0.0.1:${server.address().port}`]);
 let output='';chrome.stdout.on('data',chunk=>output+=chunk);
 let errors='';chrome.stderr.on('data',chunk=>errors+=chunk);
 const timer=setTimeout(()=>chrome.kill(),30000);
 const code=await new Promise(resolve=>chrome.on('close',resolve));clearTimeout(timer);
 assert.equal(code,0,errors.slice(-500));
 assert.match(output,/<pre id="result">PASS:/);assert.equal(f.rows.pedidos.length,0);
 console.log('Chrome PASS: ambiguous name, 3 Cuban formats, session and offline profile; only local fixtures.');
}finally{server.close();fs.rmSync(profile,{recursive:true,force:true});}
