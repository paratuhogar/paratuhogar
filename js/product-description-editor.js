(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ProductDescriptionEditorApi = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const EDITOR_ID = 'editor-container';
  function getElement(documentRef) { return documentRef?.getElementById?.(EDITOR_ID) || null; }
  function enableNativeEditor(element) {
    element.setAttribute('contenteditable', 'true');
    element.setAttribute('role', 'textbox');
    element.setAttribute('aria-multiline', 'true');
    element.setAttribute('aria-label', 'Descripción detallada del producto');
    element.setAttribute('data-editor-mode', 'native');
    element.classList?.add('product-description-fallback');
  }
  function ensureProductDescriptionEditor({ documentRef = typeof document !== 'undefined' ? document : null, QuillCtor = typeof Quill !== 'undefined' ? Quill : undefined, currentEditor = null } = {}) {
    if (currentEditor?.root) return currentEditor;
    const element = getElement(documentRef);
    if (!element) return null;
    if (typeof QuillCtor === 'function') {
      if (element.getAttribute?.('data-editor-mode') === 'native') {
        element.removeAttribute?.('contenteditable');
        element.removeAttribute?.('role');
        element.removeAttribute?.('aria-multiline');
        element.removeAttribute?.('aria-label');
        element.removeAttribute?.('data-editor-mode');
      }
      return new QuillCtor(element, { theme: 'snow', placeholder: 'Descripción...', modules: { toolbar: [['bold', 'italic'], [{ color: [] }]] } });
    }
    enableNativeEditor(element);
    return null;
  }
  function writeProductDescription(html, { documentRef = typeof document !== 'undefined' ? document : null, editor = null } = {}) {
    const value = html || '';
    if (editor?.root) editor.root.innerHTML = value;
    else { const element = getElement(documentRef); if (element) element.innerHTML = value; }
  }
  function readProductDescription({ documentRef = typeof document !== 'undefined' ? document : null, editor = null } = {}) {
    if (editor?.root) return editor.root.innerHTML;
    return getElement(documentRef)?.innerHTML || '';
  }
  return { ensureProductDescriptionEditor, readProductDescription, writeProductDescription };
});
