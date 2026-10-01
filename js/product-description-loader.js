(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PTHProductDescriptions = api;
})(typeof window === 'undefined' ? globalThis : window, function() {
  'use strict';
  function create({ getScope, fetchRows }) {
    let scope;
    const pending = new Map();
    const stale = () => Error('La sesión o el catálogo cambió. Abre el producto de nuevo.');
    async function hydrate(products) {
      const requestScope = getScope();
      if (scope !== requestScope) { pending.clear(); scope = requestScope; }
      const missing = products.filter(product => !Object.prototype.hasOwnProperty.call(product, 'descripcion'));
      const fresh = [...new Set(missing.map(product => String(product.id)))].filter(id => !pending.has(id));
      // Bound bulk exports and share in-flight requests with detail/copy clicks.
      for (let offset = 0; offset < fresh.length; offset += 40) {
        const ids = fresh.slice(offset, offset + 40);
        const batch = Promise.resolve().then(() => fetchRows(ids)).then(rows => {
          if (getScope() !== requestScope) throw stale();
          return new Map(rows.map(row => [String(row.id), row]));
        });
        for (const id of ids) {
          const result = batch.then(rows => {
            const row = rows.get(id);
            if (!row || !Object.prototype.hasOwnProperty.call(row, 'descripcion')) throw Error('No se pudo cargar la descripción. Vuelve a intentarlo.');
            return row.descripcion;
          });
          pending.set(id, result);
          result.catch(() => {}).finally(() => { if (pending.get(id) === result) pending.delete(id); });
        }
      }
      const descriptions = await Promise.all(missing.map(product => pending.get(String(product.id))));
      if (getScope() !== requestScope) throw stale();
      // Never merge response prices, commissions, availability, or any other fields.
      missing.forEach((product, index) => { product.descripcion = descriptions[index]; });
      return products;
    }
    return { hydrate };
  }
  return { create };
});
