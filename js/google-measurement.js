/* ParaTuHogar: basic consent mode. No Google request until opt-in. */
(function () {
  'use strict';
  const w=window,d=document,ID='G-GT0LMLWZ2G',KEY='pth_analytics_consent';
  if(w.PTHAnalytics)return;
  const allowedEvents=new Set(['view_item','add_to_cart','begin_checkout','generate_lead']);
  let loaded=false,viewSent=false,banner,settings;
  const read=k=>{try{return w.localStorage.getItem(k);}catch{return null;}};
  const internal=()=>{try{return Boolean(JSON.parse(read('pth_session')||'null')?.data?.rol);}catch{return true;}};
  const publicPage=()=>['paratuhogar.org','www.paratuhogar.org'].includes(w.location.hostname)&&(/^(\/|\/index\.html|\/(producto|categoria)\/[a-z0-9/-]+\.html)$/.test(w.location.pathname)||/^\/(producto|categoria)\/[a-z0-9-]+\/?$/.test(w.location.pathname));
  const eligible=()=>publicPage()&&!internal();
  let granted=read(KEY)==='granted';
  function command(){w.dataLayer=w.dataLayer||[];w.dataLayer.push(arguments);}
  function safeContext(){
    let referrer='';try{referrer=new URL(d.referrer).origin+'/';}catch{}
    return {page_location:w.location.origin+w.location.pathname,page_referrer:referrer,page_title:'ParaTuHogar · Tienda',send_to:ID};
  }
  function event(name){
    if(!granted||!eligible()||!allowedEvents.has(name))return false;
    command('event',name,safeContext());return true;
  }
  function start(){
    if(!granted||!eligible())return;
    w['ga-disable-'+ID]=false;
    if(!loaded){
      loaded=true;
      command('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
      command('js',new Date());
      command('config',ID,{...safeContext(),send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});
      const script=d.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+ID;d.head.appendChild(script);
    }else command('consent','update',{analytics_storage:'granted'});
    if(!viewSent){viewSent=true;command('event','page_view',safeContext());}
  }
  function consent(value){
    granted=value===true;
    try{w.localStorage.setItem(KEY,granted?'granted':'denied');}catch{}
    if(granted)start();else{
      w['ga-disable-'+ID]=true;
      if(loaded)command('consent','update',{analytics_storage:'denied'});
      for(const cookie of d.cookie.split(';')){
        const name=cookie.split('=')[0].trim();if(!/^_ga(?:_|$)/.test(name))continue;
        for(const domain of ['',w.location.hostname,'.paratuhogar.org'])d.cookie=name+'=; Max-Age=0; Path=/;'+(domain?' Domain='+domain+';':'')+' SameSite=Lax; Secure';
      }
    }
    if(banner)banner.hidden=true;
  }
  function ui(){
    if(!eligible())return;
    const style=d.createElement('style');
    style.textContent='#pth-analytics-banner{position:fixed;bottom:12px;left:12px;right:12px;max-width:650px;z-index:2147483000;background:#12202a;color:#f4f8fb;padding:18px;border:1px solid #426174;border-radius:14px;box-shadow:0 6px 30px #0006;font:14px/1.5 system-ui}#pth-analytics-banner[hidden]{display:none}#pth-analytics-banner p{margin:0 0 12px}#pth-analytics-banner button,#pth-analytics-settings{font:inherit;border:1px solid #91a5b2;border-radius:8px;background:#fff;color:#132633;padding:8px 13px;margin:0 8px 4px 0;cursor:pointer}#pth-analytics-settings{position:fixed;bottom:5px;left:5px;z-index:900;font:11px system-ui;padding:4px 7px}';d.head.appendChild(style);
    banner=d.createElement('section');banner.id='pth-analytics-banner';banner.setAttribute('role','region');banner.setAttribute('aria-label','Preferencias de estadísticas');
    const text=d.createElement('p');text.textContent='¿Nos permites medir las visitas con Google Analytics? Usamos estadísticas de navegación para mejorar la tienda. No enviamos nombres, teléfonos ni datos de los pedidos. Es opcional y puedes cambiar tu decisión en “Privacidad”.';banner.appendChild(text);
    for(const [label,value] of [['Aceptar estadísticas',true],['Rechazar',false]]){const b=d.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>consent(value));banner.appendChild(b);}
    banner.hidden=['granted','denied'].includes(read(KEY));d.body.appendChild(banner);
    settings=d.createElement('button');settings.id='pth-analytics-settings';settings.type='button';settings.textContent='Privacidad';settings.addEventListener('click',()=>{banner.hidden=false;});d.body.appendChild(settings);
    start();
  }
  const excludeInternal=()=>{if(internal()){w['ga-disable-'+ID]=true;if(banner)banner.hidden=true;if(settings)settings.hidden=true;}};
  w.PTHAnalytics={event,consent,excludeInternal};
  // Recheck each event; internal sign-in must never count as customer activity.
  w.addEventListener('storage',e=>{if(e.key===KEY){granted=e.newValue==='granted';if(granted)start();else consent(false);}if(e.key==='pth_session'&&internal())w['ga-disable-'+ID]=true;});
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',ui,{once:true});else ui();
})();
