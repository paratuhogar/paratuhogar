import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { createHandler } from './handler.mjs';

const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const pushEnv=Object.fromEntries(['PTH_PUSH_VAPID_PUBLIC_KEY','PTH_PUSH_VAPID_PRIVATE_KEY','PTH_PUSH_VAPID_SUBJECT','PTH_PUSH_DISPATCH_SECRET','PTH_PUSH_ENABLED'].map(name=>[name,Deno.env.get(name)||'']));
async function pushPilot(body:object){
 const response=await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/admin-push-dispatch`,{
  method:'POST',headers:{'Content-Type':'application/json','x-pth-push-secret':pushEnv.PTH_PUSH_DISPATCH_SECRET},
  body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000),
 });
 return response.ok;
}
Deno.serve(createHandler({db,pushEnv,pushPilot,checkoutSecret:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}));
