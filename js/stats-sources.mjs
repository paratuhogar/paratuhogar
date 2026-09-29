export const STATS_CONFIG = Object.freeze({
  supabaseUrl: 'https://ljqwaovevfatkiigirhf.supabase.co',
  supabaseKey: 'sb_publishable_DAuFcu0JjUo15yLDAev3MQ_9x5GIVXt',
  refreshMs: 20000,
  googleEndpoint: 'https://ljqwaovevfatkiigirhf.supabase.co/functions/v1/google-statistics',
  sourceEndpoints: globalThis.window?.PTH_STATS_SOURCE_ENDPOINTS || {}
});

export function sourceState(name, snapshot = {}) {
  if (name === 'analytics' || name === 'search') return snapshot.google?.[name] || {state:'pending',label:'Pendiente de consulta'};
  if (name === 'traffic' && Array.isArray(snapshot.traffic)) return { state: 'connected', label: 'Clics internos disponibles' };
  return { state: 'pending', label: 'No conectado todavía' };
}

export async function loadGoogleSources(session,range){
  const response=await fetch(STATS_CONFIG.googleEndpoint,{method:'POST',headers:{'Content-Type':'application/json',apikey:STATS_CONFIG.supabaseKey},
    body:JSON.stringify({session_token:globalThis.window?.PTHSecureData?.token(),from:range.from,to:range.to}),signal:AbortSignal.timeout(45000)});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||`No se pudo consultar Google (${response.status})`);
  if(!result.analytics?.state||!result.search?.state)throw Error('Respuesta de Google incompleta');
  return result;
}

export async function loadExternalSource(name, endpoint) {
  if (!endpoint) return { data: null, state: 'pending', message: 'No conectado todavía' };
  const response = await fetch(endpoint, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Fuente ${name}: ${response.status}`);
  return { data: await response.json(), state: 'connected', message: 'Conectado' };
}
