import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import checkoutForm from '../js/checkout-form-shared.js';

test('ordinary is default, express is opt-in, and losing an offer never silently downgrades it',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/<option value="ordinary" selected>Ordinaria/);
 const src=readFileSync(new URL('../js/storefront.js',import.meta.url),'utf8');
 const select={value:'ordinary',options:[{},{}]},status={};
 let hidden;
 const nodes={'check-shipping-service':select,'check-express-panel':{classList:{toggle:(_,value)=>hidden=value}},'check-express-status':status,
  'check-recogida':{checked:false},'check-municipio':{value:'Playa'},'check-localidad':{value:'Centro'}};
 const ctx={document:{getElementById:key=>nodes[key]},cart:[{qty:1}],tarifasMensajeria:{Playa:{Centro:{pq:6,gr:20,precio_expres_pequeno:10,minutos_expres_pequeno:60}}},
  newCheckoutShippingOverride:null,window:{PTHCheckoutForm:checkoutForm}};
 vm.runInNewContext(src.slice(src.indexOf('function expressShippingSelected()'),src.indexOf('\n};',src.indexOf('window.obtenerCostoMensajeriaGlobal = function()'))+3),ctx);
 ctx.renderExpressShipping();
 assert.equal(hidden,false);assert.equal(ctx.window.obtenerCostoMensajeriaGlobal(),6);
 assert.match(select.options[1].textContent,/10\.00 USD · 60 min/);
 select.value='express';assert.equal(ctx.window.obtenerCostoMensajeriaGlobal(),10);
 ctx.window.PTHPendingCheckoutUI={localForm:()=>true};ctx.renderExpressShipping();
 assert.equal(hidden,true);assert.equal(select.value,'express');assert.equal(ctx.window.obtenerCostoMensajeriaGlobal(),6);
 ctx.window.PTHPendingCheckoutUI={localForm:()=>false};ctx.renderExpressShipping();
 assert.equal(hidden,false);assert.equal(ctx.window.obtenerCostoMensajeriaGlobal(),10);
 nodes['check-localidad'].value='Other';ctx.renderExpressShipping();
 assert.equal(select.value,'express');assert.equal(select.options[1].disabled,true);assert.equal(ctx.window.obtenerCostoMensajeriaGlobal(),null);
 assert.match(status.textContent,/Elige Ordinaria/);
 select.value='ordinary';nodes['check-recogida'].checked=true;ctx.renderExpressShipping();
 assert.equal(hidden,true);assert.equal(ctx.window.obtenerCostoMensajeriaGlobal(),0);
});
