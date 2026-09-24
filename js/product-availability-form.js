(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ProductAvailabilityFormApi = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function getProductAvailability({ isEditing, currentValue, saveInactive } = {}) {
    if (isEditing) return currentValue || 'SI';
    return saveInactive ? 'NO' : 'SI';
  }

  return { getProductAvailability };
});
