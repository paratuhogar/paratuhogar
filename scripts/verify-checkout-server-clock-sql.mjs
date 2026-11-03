// Disposable SQL engine, no external database or orders.
import fs from 'node:fs';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PTH_PGLITE_MODULE).href);const db=new PGlite();
try{
 await db.exec('create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema pth_private;');
 await db.exec(fs.readFileSync(new URL('../supabase/proposals/checkout-server-clock.sql',import.meta.url),'utf8'));
 const nonce='a'.repeat(64),call=(key,create)=>db.query('select public.pth_checkout_clock($1,$2) result',[key,create]).then(r=>r.rows[0].result);
 await db.exec('set role service_role');await assert.rejects(()=>call(nonce,false));
 const first=await call(nonce,true);assert.ok(Number.isSafeInteger(first.issuedAt));assert.ok(Math.abs(first.serverNow-Date.now())<5000);
 const next=await call(nonce,true);assert.equal(next.issuedAt,first.issuedAt);
 assert.equal(Number((await db.query('select count(*) n from pth_private.checkout_attempt_clocks')).rows[0].n),1);
 await assert.rejects(()=>call('invalid',true));await assert.rejects(()=>db.exec('update pth_private.checkout_attempt_clocks set issued_at=now()'));
 await assert.rejects(()=>db.exec('delete from pth_private.checkout_attempt_clocks'));
 await db.exec('reset role');await db.exec("update pth_private.checkout_attempt_clocks set issued_at=now()-interval '8 days'");await db.exec('set role service_role');
 const old=await call(nonce,true);assert.ok(old.serverNow-old.issuedAt>7*86400000);
 await db.exec('reset role');for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(()=>call(nonce,true));await assert.rejects(()=>db.exec('select * from pth_private.checkout_attempt_clocks'));await db.exec('reset role');}
 console.log('PASS server-issued clock, stable identity, old identity not renewed, malformed nonce, immutable privileges and private access');
}finally{await db.close();}
