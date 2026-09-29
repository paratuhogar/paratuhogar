export function reportDateRange({from,to}={}) {
  const valid=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
  if(!valid(from)||!valid(to)||from>to||(Date.parse(to)-Date.parse(from))/86400000>366) throw Error('Selecciona fechas válidas y un máximo de 367 días.');
  return {from,to};
}
export function normalizeGaReport(report) {
  return (report.rows||[]).map(row=>Object.fromEntries([
    ...(report.dimensionHeaders||[]).map((h,i)=>[h.name,h.name==='date'?row.dimensionValues[i].value.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'):row.dimensionValues[i].value]),
    ...(report.metricHeaders||[]).map((h,i)=>[h.name,Number(row.metricValues[i].value)])
  ]));
}
export async function googleJson(url,body,token) {
  const r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(18000)});
  if(!r.ok)throw Object.assign(Error('Google no respondió correctamente'),{status:r.status});
  return r.json();
}
export async function loadReports(token,period,request=googleJson) {
  const base={period,fetchedAt:new Date().toISOString()};
  async function ga(){
    const definitions={summary:[],daily:['date'],channels:['sessionDefaultChannelGroup'],devices:['deviceCategory'],countries:['country'],pages:['pagePath'],hours:['hour']};
    const metrics=['activeUsers','sessions','screenPageViews','engagementRate','averageSessionDuration','keyEvents'];
    const reports={};const metadata={};
    await Promise.all(Object.entries(definitions).map(async([key,dims])=>{
      const raw=await request('https://analyticsdata.googleapis.com/v1beta/properties/556333692:runReport',{
        dateRanges:[{startDate:period.from,endDate:period.to}],dimensions:dims.map(name=>({name})),metrics:metrics.map(name=>({name})),
        limit:1000,orderBys:key==='daily'||key==='hours'?[{dimension:{dimensionName:dims[0]}}]:[{metric:{metricName:key==='pages'?'screenPageViews':'sessions'},desc:true}]
      },token);
      reports[key]=normalizeGaReport(raw);metadata[key]={rowCount:raw.rowCount||0,thresholded:!!raw.metadata?.subjectToThresholding};
    }));
    return {...base,state:reports.summary.length?'connected':'empty',reports,metadata,timeZone:'America/Havana',message:reports.summary.length?'Conectado':'Sin actividad registrada en este periodo. GA4 no recupera visitas anteriores a su instalación.'};
  }
  async function search(){
    const definitions={summary:[],daily:['date'],queries:['query'],pages:['page'],devices:['device'],countries:['country']};const reports={};
    await Promise.all(Object.entries(definitions).map(async([key,dimensions])=>{
      const raw=await request('https://www.googleapis.com/webmasters/v3/sites/https%3A%2F%2Fparatuhogar.org%2F/searchAnalytics/query',{
        startDate:period.from,endDate:period.to,dimensions,type:'web',dataState:'final',rowLimit:1000
      },token);
      reports[key]=(raw.rows||[]).map(row=>({...Object.fromEntries(dimensions.map((d,i)=>[d,row.keys?.[i]||''])),clicks:row.clicks,impressions:row.impressions,ctr:row.ctr,position:row.position}));
      if(key==='daily')reports[key].sort((a,b)=>a.date.localeCompare(b.date));
    }));
    return {...base,state:reports.summary.length?'connected':'empty',reports,timeZone:'America/Los_Angeles',message:'Búsqueda web · datos finales, con retraso de Google. Rankings: hasta 1.000 filas; Google puede omitir consultas por privacidad.'};
  }
  const results=await Promise.allSettled([ga(),search()]);
  return Object.fromEntries(['analytics','search'].map((name,i)=>[name,results[i].status==='fulfilled'?results[i].value:{...base,state:'error',reports:null,message:results[i].reason?.status===403?'Google ha rechazado el permiso de lectura.':'No se pudo consultar Google. Intenta actualizar en unos minutos.'}]));
}
export function createHandler({authorize,loadSources}) {
  const allowed=new Set(['https://paratuhogar.org','https://www.paratuhogar.org','http://127.0.0.1:4173','http://localhost:4173']);
  return async req=>{
    const origin=req.headers.get('origin');
    const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(allowed.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type,apikey,authorization','Access-Control-Allow-Methods':'POST, OPTIONS'}:{})};
    const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
    if(origin&&!allowed.has(origin))return reply({error:'Origen no permitido'},403);
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(req.method!=='POST')return reply({error:'Método no permitido'},405);
    let body;
    try {
      if(Number(req.headers.get('content-length'))>8192)return reply({error:'Solicitud demasiado grande'},413);
      const reader=req.body?.getReader();let bytes=0;let chunks=[];
      if(!reader)return reply({error:'Solicitud vacía'},400);
      while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>8192){await reader.cancel();return reply({error:'Solicitud demasiado grande'},413);}chunks.push(value);}
      const full=new Uint8Array(bytes);let offset=0;for(const c of chunks){full.set(c,offset);offset+=c.length;}
      body=JSON.parse(new TextDecoder().decode(full));
      if(!body||typeof body!=='object')throw Error();
    }catch{return reply({error:'Solicitud inválida'},400);}
    try{
      if(!await authorize(body))return reply({error:'Acceso reservado a Ángel y Marcel. Inicia sesión de nuevo.'},401);
      let range;try{range=reportDateRange(body);}catch(e){return reply({error:e.message},400);}
      return reply(await loadSources(range));
    }catch{return reply({error:'No se pudo consultar la fuente. Intenta de nuevo.'},503);}
  };
}
