import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getProductAvailability } = require('../js/product-availability-form.js');

test('los productos nuevos quedan activos por defecto', () => {
  assert.equal(getProductAvailability({ isEditing: false, saveInactive: false }), 'SI');
});

test('la opción de alta permite guardar el producto inactivo', () => {
  assert.equal(getProductAvailability({ isEditing: false, saveInactive: true }), 'NO');
});

test('editar conserva la disponibilidad existente sin aplicar la opción de alta', () => {
  assert.equal(getProductAvailability({ isEditing: true, currentValue: 'NO', saveInactive: false }), 'NO');
  assert.equal(getProductAvailability({ isEditing: true, currentValue: 'SI', saveInactive: true }), 'SI');
});
