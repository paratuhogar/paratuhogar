const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('an exact saved CRM option fills the normal form on input; partial text does not overwrite customer fields',()=>{
 const source=fs.readFileSync(require.resolve('../js/storefront.js'),'utf8');
 const functions=source.slice(source.indexOf('function renderCheckoutClientChoices()'),source.indexOf('// 3. SISTEMA DE AUTO-GUARDADO'));
 const handlers={},list={children:[],replaceChildren(){this.children=[];},append(option){this.children.push(option);}},search={value:'',dataset:{},addEventListener:(event,fn)=>handlers[event]=fn};
 const fields=Object.fromEntries(['nombre','ci','tel','dir'].map(name=>['check-'+name,{value:''}]));
 const context={document:{getElementById:id=>id==='crm-datalist'?list:id==='crm-search'?search:fields[id],createElement:()=>({})},crmClients:[{cliente:'Own customer',telefono:'5351111111',ci:'synthetic-ci',direccion:'Own address'}]};
 vm.runInNewContext(functions,context);context.renderCheckoutClientChoices();
 assert.equal(typeof handlers.input,'function','real CRM selection must respond to input, including saved datalist options');
 search.value='Own customer | 5351';handlers.input();assert.equal(fields['check-nombre'].value,'');
 search.value='Own customer | 5351111111';handlers.input();assert.equal(fields['check-nombre'].value,'Own customer');assert.equal(fields['check-dir'].value,'Own address');
 context.crmClients=[];context.renderCheckoutClientChoices();search.value='Own customer | 5351111111';fields['check-nombre'].value='Other account';handlers.input();assert.equal(fields['check-nombre'].value,'Other account');
});
