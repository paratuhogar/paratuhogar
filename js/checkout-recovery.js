/* Confirm NEW submission outcomes through existing, authorized queries only. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PTHCheckoutRecovery=api;})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  async function check({authenticated,query,table,token,providers,codes}){
    if(!authenticated)return {kind:'unavailable'};
    if(!['pedidos','pedidos_subgestores'].includes(table)||typeof token!=='string'||!token||!Array.isArray(providers)||!providers.length||!Array.isArray(codes)||codes.length!==providers.length)return {kind:'unknown'};
    const result=await query(table,token,codes);
    if(result.error||!Array.isArray(result.data))return {kind:'unknown'};
    const rows=result.data;
    const receipts=providers.map(provider=>rows.find(row=>row.proveedor===provider&&row.submission_token===token&&row.id));
    if(receipts.every(Boolean))return {kind:'confirmed',receipts};
    return {kind:receipts.some(Boolean)?'partial':'absent',receipts:receipts.filter(Boolean)};
  }
  return {check};
});
