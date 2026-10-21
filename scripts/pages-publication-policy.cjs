// Deployment policy only. No application, session or customer operations.
function publicationAllowed({event,ref,sha,headSha,checkout,build,pagesBuildType}){
 return ['push','workflow_dispatch'].includes(event)&&ref==='refs/heads/main'
  &&/^[a-f0-9]{40}$/.test(sha||'')&&sha===headSha
  &&checkout==='success'&&build==='success'&&pagesBuildType==='workflow';
}
if(require.main===module){
 const allowed=publicationAllowed({event:process.env.GITHUB_EVENT_NAME,ref:process.env.GITHUB_REF,
  sha:process.env.GITHUB_SHA,headSha:process.env.PTH_MAIN_SHA,checkout:process.env.PTH_CHECKOUT_RESULT,
  build:process.env.PTH_BUILD_RESULT,pagesBuildType:process.env.PTH_PAGES_BUILD_TYPE});
 if(!allowed){console.error('Publication refused: require successful checkout/build of current main and Pages Actions source. Existing production is preserved.');process.exitCode=1;}
 else console.log('Publication policy accepted for the exact tested current main commit.');
}
module.exports={publicationAllowed};
