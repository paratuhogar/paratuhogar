import test from 'node:test';
import assert from 'node:assert/strict';
import form from '../js/checkout-form-shared.js';
import {deliveryCost} from '../supabase/functions/secure-data/checkout.mjs';
import {scopeFor} from '../supabase/functions/secure-data/policy.mjs';

test('tariffs remain publicly readable but only administrators may write', () => {
  assert.deepEqual(scopeFor('tarifas_mensajeria', null, 'select'), []);
  for (const op of ['insert','update','upsert','delete']) {
    for (const actor of [null,{rol:'gestor'},{rol:'admin',parent_id:'parent'},{rol:'mensajero'}])
      assert.throws(() => scopeFor('tarifas_mensajeria', actor, op));
    assert.deepEqual(scopeFor('tarifas_mensajeria', {rol:'admin'}, op), []);
  }
});

const delivery = {municipio:'Playa', localidad:'Centro', pickup:false};
const tariff = {...delivery, precio_pequeno:7, precio_mediano:12, precio_grande:18};
const item = tamaño_envio => ({tamaño_envio, proveedor:'A', qty:1, cantidad:1});
for (const [sizes, expected] of [[['Pequeño'],6], [['Pequeño','Mediano'],12], [['Mediano','Grande'],18]]) {
  test('uses the largest size: ' + sizes.join(', '), () => {
    const lines = sizes.map(item);
    assert.equal(form.shipping({...delivery, lines, tariffs:[tariff]}), expected);
    assert.equal(deliveryCost(lines, lines, delivery, tariff), expected);
  });
}
test('an unset medium tariff cannot become free or small shipping', () => {
  const unset = {...tariff, precio_mediano:null};
  const lines = [item('Mediano')];
  assert.equal(form.shipping({...delivery, lines, tariffs:[unset]}), null);
  assert.throws(() => deliveryCost(lines, lines, delivery, unset), /por confirmar/i);
  assert.equal(form.shipping({...delivery, pickup:true, lines, tariffs:[unset]}), 0);
});
