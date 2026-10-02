(function(root){
 const requested=()=>new URLSearchParams(root.location.search).get('admin_alert');
 root.PTHPushLinks={resolve:async()=>{
  const kind=requested();if(!['orders','suggestions','applications'].includes(kind))return null;
  const profile=await root.PTHSecureData.restore();
  if(!root.PTHWorkView.canSwitch(profile))return null;
  const result=await root.PTHSecureData.push({operation:'config'});
  if(result.error||!result.data?.allowedTopics?.includes(kind))return null;
  const url=new URL(root.location.href);url.searchParams.delete('admin_alert');root.history.replaceState(null,'',url);
  return kind==='orders'?'logistica':kind==='applications'?'aprobaciones':'feedback';
 }};
 root.addEventListener('DOMContentLoaded',()=>{if(['orders','suggestions','applications'].includes(requested())&&!root.PTHSecureData.token())root.openLoginModal?.();},{once:true});
})(window);
