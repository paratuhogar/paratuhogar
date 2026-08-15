import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ensureProductDescriptionEditor, readProductDescription, writeProductDescription } = require('../js/product-description-editor.js');

function makeEditorElement() {
  const attributes = new Map();
  return {
    innerHTML: '',
    classList: { values: new Set(), add(...names) { names.forEach(name => this.values.add(name)); }, contains(name) { return this.values.has(name); } },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; }
  };
}

test('permite escribir y guardar la descripción cuando Quill no está disponible', () => {
  const element = makeEditorElement();
  const documentRef = { getElementById: id => id === 'editor-container' ? element : null };
  const editor = ensureProductDescriptionEditor({ documentRef, QuillCtor: undefined });
  writeProductDescription('<p>Descripción inicial</p>', { documentRef, editor });
  assert.equal(element.getAttribute('contenteditable'), 'true');
  assert.equal(element.getAttribute('role'), 'textbox');
  assert.equal(element.getAttribute('aria-multiline'), 'true');
  element.innerHTML = '<p>Texto escrito desde el teléfono</p>';
  assert.equal(readProductDescription({ documentRef, editor }), '<p>Texto escrito desde el teléfono</p>');
});

test('usa la raíz de Quill cuando el editor enriquecido está activo', () => {
  const element = makeEditorElement();
  const documentRef = { getElementById: id => id === 'editor-container' ? element : null };
  class FakeQuill { constructor() { this.root = { innerHTML: '' }; } }
  const editor = ensureProductDescriptionEditor({ documentRef, QuillCtor: FakeQuill });
  writeProductDescription('<p>Con formato</p>', { documentRef, editor });
  assert.equal(editor.root.innerHTML, '<p>Con formato</p>');
  assert.equal(readProductDescription({ documentRef, editor }), '<p>Con formato</p>');
  assert.notEqual(element.getAttribute('contenteditable'), 'true');
});
