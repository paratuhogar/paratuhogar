import test from 'node:test';
import assert from 'node:assert/strict';
import {createECDH} from 'node:crypto';
import webpush from 'web-push';
import {createPushSender} from '../supabase/functions/admin-push-dispatch/sender.mjs';
function fixture(){
 const vapid=createECDH('prime256v1'),client=createECDH('prime256v1'),one=Buffer.alloc(32),two=Buffer.alloc(32);one[31]=1;two[31]=2;vapid.setPrivateKey(one);client.setPrivateKey(two);
 const sub={endpoint:'https://fcm.googleapis.com/synthetic-test',p256dh:client.getPublicKey().toString('base64url'),auth:Buffer.alloc(16).toString('base64url')};
 const stages=[];let requests=0;
 const send=createPushSender({prepare:(sub,payload,endpoint)=>{
  stages.push('encrypt');return webpush.generateRequestDetails({endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify(payload),{TTL:300,urgency:'normal',contentEncoding:'aes128gcm',vapidDetails:{subject:'https://paratuhogar.org',publicKey:vapid.getPublicKey().toString('base64url'),privateKey:one.toString('base64url')}});
 },fetch:async(endpoint,options)=>{requests++;stages.push('http');assert.equal(endpoint,sub.endpoint);assert.equal(options.redirect,'manual');assert.equal(options.method,'POST');assert.equal(options.headers['Content-Encoding'],'aes128gcm');assert.ok(options.body.length>60);assert.doesNotMatch(Buffer.from(options.body).toString(),/application_reminders/);return new Response(null,{status:201});}});
 return {send,sub,stages,requests:()=>requests};
}
test('actual encrypted sender awaits the authorization snapshot after encryption and directly before provider HTTP',async()=>{
 const f=fixture();let resolve;
 const pending=f.send(f.sub,{version:1,kind:'application_reminders'},()=>{f.stages.push('snapshot');return new Promise(done=>resolve=done);});
 assert.deepEqual(f.stages,['encrypt','snapshot']);assert.equal(f.requests(),0);
 resolve(true);assert.equal(await pending,201);assert.deepEqual(f.stages,['encrypt','snapshot','http']);
});
test('a denied or failed final snapshot sends no request; existing channels still use the encrypted sender',async()=>{
 const denied=fixture();assert.equal(await denied.send(denied.sub,{version:1,kind:'application_reminders'},async()=>false),null);assert.equal(denied.requests(),0);
 const failed=fixture();await assert.rejects(failed.send(failed.sub,{version:1,kind:'application_reminders'},async()=>{throw Error('synthetic DB interruption');}));assert.equal(failed.requests(),0);
 const original=fixture();assert.equal(await original.send(original.sub,{version:1,kind:'orders'}),201);assert.deepEqual(original.stages,['encrypt','http']);
});
