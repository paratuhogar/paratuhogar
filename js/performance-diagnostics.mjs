// Opt-in local diagnostics. No fetch, telemetry, identifiers, URLs or persistence.
const observed={lcpCandidateMs:null};
let observer;
try{observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())observed.lcpCandidateMs=Math.round(entry.startTime);});observer.observe({type:'largest-contentful-paint',buffered:true});}catch(_){/* Browser may not support LCP observation. */}
const ms=value=>Number.isFinite(value)?Math.round(value):null;
export function snapshot(){
 const navigation=performance.getEntriesByType('navigation')[0];
 const resources=performance.getEntriesByType('resource');
 const groups={};
 for(const entry of resources){
  const group=['img','image'].includes(entry.initiatorType)?'images':['script','css','link'].includes(entry.initiatorType)?'scriptsAndStyles':'other';
  const item=groups[group]||(groups[group]={requests:0,reportedTransferBytes:0,unknownOrCachedRequests:0});
  item.requests++;item.reportedTransferBytes+=entry.transferSize||0;if(!entry.transferSize)item.unknownOrCachedRequests++;
 }
 return {schema:1,localOnly:true,navigationType:navigation?.type||'unknown',viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
  timingMs:{responseStart:ms(navigation?.responseStart),domContentLoaded:ms(navigation?.domContentLoadedEventEnd),loadEvent:ms(navigation?.loadEventEnd),firstContentfulPaint:ms(performance.getEntriesByName('first-contentful-paint')[0]?.startTime),lcpCandidate:observed.lcpCandidateMs},
  navigationReportedTransferBytes:navigation?.transferSize||0,resources:groups,
  caveat:'Local lab snapshot, not field Core Web Vitals. Zero transferSize may mean cache or unavailable cross-origin timing. LCP may still change. No URLs, account data or reports included.'};
}
export function stop(){observer?.disconnect();}
