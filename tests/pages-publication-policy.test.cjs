const test=require('node:test');
const assert=require('node:assert/strict');
const {publicationAllowed}=require('../scripts/pages-publication-policy.cjs');
const current={event:'push',ref:'refs/heads/main',sha:'a'.repeat(40),headSha:'a'.repeat(40),checkout:'success',build:'success',pagesBuildType:'workflow'};
test('only the tested current main commit may publish after checkout and build succeed',()=>{
 assert.equal(publicationAllowed(current),true);
 assert.equal(publicationAllowed({...current,event:'workflow_dispatch'}),true);
});
for(const status of ['failure','cancelled','skipped','pending',undefined])for(const job of ['checkout','build']){
 test(`${job} ${status} cannot publish`,()=>assert.equal(publicationAllowed({...current,[job]:status}),false));
}
test('a PR, another branch or an old main rerun cannot replace production',()=>{
 for(const change of [{event:'pull_request'},{event:'workflow_run'},{ref:'refs/heads/other'},{headSha:'b'.repeat(40)},{sha:undefined},{sha:'invalid',headSha:'invalid'}])assert.equal(publicationAllowed({...current,...change}),false);
});
test('branch publication or unknown Pages source cannot satisfy protection',()=>{
 for(const pagesBuildType of ['legacy',undefined,''])assert.equal(publicationAllowed({...current,pagesBuildType}),false);
});
test('deployment command exits unsuccessfully for a failed gate or legacy source',()=>{
 const {spawnSync}=require('node:child_process');
 for(const change of [{PTH_CHECKOUT_RESULT:'failure'},{PTH_PAGES_BUILD_TYPE:'legacy'}]){
  const r=spawnSync(process.execPath,[require.resolve('../scripts/pages-publication-policy.cjs')],{env:{GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/main',GITHUB_SHA:'a'.repeat(40),PTH_MAIN_SHA:'a'.repeat(40),PTH_CHECKOUT_RESULT:'success',PTH_BUILD_RESULT:'success',PTH_PAGES_BUILD_TYPE:'workflow',...change},encoding:'utf8'});
  assert.equal(r.status,1);assert.match(r.stderr,/Publication refused/);
 }
});
test('deployment command succeeds only for a complete current-main publication context',()=>{
 const {spawnSync}=require('node:child_process');
 const r=spawnSync(process.execPath,[require.resolve('../scripts/pages-publication-policy.cjs')],{env:{GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/main',GITHUB_SHA:'a'.repeat(40),PTH_MAIN_SHA:'a'.repeat(40),PTH_CHECKOUT_RESULT:'success',PTH_BUILD_RESULT:'success',PTH_PAGES_BUILD_TYPE:'workflow'},encoding:'utf8'});
 assert.equal(r.status,0);assert.match(r.stdout,/Publication policy accepted/);
});
