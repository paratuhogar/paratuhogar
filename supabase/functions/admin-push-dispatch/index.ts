import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
// @deno-types="npm:@types/web-push@3.6.4"
import webpush from 'npm:web-push@3.6.7';
import {createDispatcher} from './dispatcher.mjs';
import {createPushSender} from './sender.mjs';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const env=Object.fromEntries(['PTH_PUSH_VAPID_PUBLIC_KEY','PTH_PUSH_VAPID_PRIVATE_KEY','PTH_PUSH_VAPID_SUBJECT','PTH_PUSH_DISPATCH_SECRET','PTH_PUSH_ENABLED'].map(k=>[k,Deno.env.get(k)||'']));
const send=createPushSender({fetch,prepare:(sub:any,payload:object,endpoint:string)=>
 webpush.generateRequestDetails({endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify(payload),{
  TTL:300,urgency:'normal',contentEncoding:'aes128gcm',
  vapidDetails:{subject:env.PTH_PUSH_VAPID_SUBJECT,publicKey:env.PTH_PUSH_VAPID_PUBLIC_KEY,privateKey:env.PTH_PUSH_VAPID_PRIVATE_KEY},
 })});
Deno.serve(createDispatcher({db,env,send}));
