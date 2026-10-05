const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('unsent form data restores only in its original account and expires after seven days',()=>{
 const source=fs.readFileSync(require.resolve('../js/storefront.js'),'utf8'),start=source.indexOf('function checkoutAutosaveKey');
 assert.ok(start>=0,'normal form autosave must be scoped');
 const end=source.indexOf('//',source.indexOf('function clearAutoSave()',start)+30);
 const functions=source.slice(start,source.indexOf('function clearAutoSave()',start));
 let owner='a';const rows=new Map(),fields=Object.fromEntries(['nombre','ci','tel','dir','vuelto'].map(f=>['check-'+f,{value:'',addEventListener(n,fn){this[n]=fn;}}]));
 const context={Date,localStorage:{getItem:k=>rows.get(k)||null,setItem:(k,v)=>rows.set(k,v)},currentNewCartOwner:()=>owner,window:{PTHPendingCheckoutUI:{localForm:()=>false}},document:{getElementById:id=>fields[id]}};
 vm.runInNewContext(functions,context);context.initAutoSaveSystem();fields['check-nombre'].value='Own draft';fields['check-nombre'].input();
 owner='b';context.restoreAccountFormDraft(owner);assert.equal(fields['check-nombre'].value,'');
 owner='a';context.restoreAccountFormDraft(owner);assert.equal(fields['check-nombre'].value,'Own draft');
 const key=context.checkoutAutosaveKey('check-nombre','a');rows.set(key,JSON.stringify({value:'Expired private draft',savedAt:Date.now()-8*86400000}));context.restoreAccountFormDraft(owner);assert.equal(fields['check-nombre'].value,'');
});
