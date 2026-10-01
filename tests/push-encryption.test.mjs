import test from 'node:test';
import assert from 'node:assert/strict';
import {createECDH} from 'node:crypto';
import webpush from 'web-push';
test('pinned Web Push library encrypts a synthetic generic message without any network or production keys',()=>{
 // Deterministic scalar-one/scalar-two test fixtures, NOT credentials.
 const vapid=createECDH('prime256v1'),client=createECDH('prime256v1');const one=Buffer.alloc(32),two=Buffer.alloc(32);one[31]=1;two[31]=2;vapid.setPrivateKey(one);client.setPrivateKey(two);
 const details=webpush.generateRequestDetails({endpoint:'https://fcm.googleapis.com/synthetic-test',keys:{p256dh:client.getPublicKey().toString('base64url'),auth:Buffer.alloc(16).toString('base64url')}},JSON.stringify({version:1,kind:'orders'}),{TTL:300,contentEncoding:'aes128gcm',vapidDetails:{subject:'https://paratuhogar.org',publicKey:vapid.getPublicKey().toString('base64url'),privateKey:one.toString('base64url')}});
 assert.equal(details.method,'POST');assert.equal(details.headers['Content-Encoding'],'aes128gcm');assert.ok(details.body.length>60);assert.doesNotMatch(details.body.toString(),/orders/);
});
