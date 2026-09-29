import {createHandler,loadReports} from './core.mjs';

const owners=new Set(['38f20b63-a845-4a03-8d10-9a57da2ac2c4','6193f310-1e3f-4404-b874-977d0e23a6a0']);
const cache=new Map();
let oauth:{value:string,expires:number}|null=null;
const encode=(value:Uint8Array)=>btoa(String.fromCharCode(...value)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const json64=(value:unknown)=>encode(new TextEncoder().encode(JSON.stringify(value)));
async function accessToken(){
  if(oauth&&oauth.expires>Date.now()+60000)return oauth.value;
  const account=JSON.parse(Deno.env.get('PTH_GOOGLE_SERVICE_ACCOUNT_JSON')||'{}');
  if(account.client_email!=='pth-statistics-reader@gen-lang-client-0830579016.iam.gserviceaccount.com')throw Error('Configuración de identidad incorrecta');
  const now=Math.floor(Date.now()/1000);
  const unsigned=`${json64({alg:'RS256',typ:'JWT'})}.${json64({iss:account.client_email,scope:'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+300})}`;
  const der=Uint8Array.from(atob(account.private_key.replace(/-----[^-]+-----|\s/g,'')),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned));
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${unsigned}.${encode(new Uint8Array(signature))}`}),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('Autenticación Google no disponible');
  const data=await r.json();oauth={value:data.access_token,expires:Date.now()+Number(data.expires_in)*1000};return oauth.value;
}
Deno.serve(createHandler({
  async authorize(body){
    if(typeof body.session_token==='string'&&body.session_token.length===64){
      const response=await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/secure-data`,{
        method:'POST',headers:{apikey:Deno.env.get('SUPABASE_ANON_KEY')||'',Authorization:`Bearer ${body.session_token}`,'Content-Type':'application/json'},
        body:JSON.stringify({action:'session'}),signal:AbortSignal.timeout(12000)
      });
      const result=await response.json();return response.ok&&!result.error&&owners.has(result.data?.profile?.id)&&!result.data?.profile?.parent_id;
    }
    if(!owners.has(body.id)||typeof body.password!=='string'||!body.password||body.password.length>512)return false;
    // Reuse the server-side owner check, never trust client role or fetch a password.
    const r=await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/owner_statistics_products`,{
      method:'POST',headers:{apikey:Deno.env.get('SUPABASE_ANON_KEY')||'','Content-Type':'application/json',Range:'0-0'},
      body:JSON.stringify({p_admin_id:body.id,p_password:body.password}),signal:AbortSignal.timeout(12000)
    });
    await r.body?.cancel();return r.ok;
  },
  async loadSources(period){
    const key=`${period.from}/${period.to}`;const old=cache.get(key);
    if(old&&old.expires>Date.now())return old.value;
    const value=await loadReports(await accessToken(),period);
    if(cache.size>=30)cache.delete(cache.keys().next().value);
    cache.set(key,{value,expires:Date.now()+ (value.analytics.state==='error'||value.search.state==='error'?30000:300000)});
    return value;
  }
}));
