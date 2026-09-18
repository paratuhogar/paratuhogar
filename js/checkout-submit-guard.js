(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PTHCheckoutSubmitGuard = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function createCheckoutSubmitGuard(storage, storageKey, idFactory) {
    const store = storage || {
      getItem() { return null; },
      setItem() {},
      removeItem() {}
    };
    const key = storageKey || 'pth_checkout_submission_token';
    const makeId = idFactory || (() => (
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `pth-${Date.now()}-${Math.random().toString(16).slice(2)}`
    ));
    let active = false;

    return {
      acquire() {
        if (active) return { accepted: false, token: store.getItem(key) };
        active = true;
        let token = store.getItem(key);
        if (!token) {
          token = String(makeId());
          store.setItem(key, token);
        }
        return { accepted: true, token };
      },
      fail() {
        active = false;
      },
      succeed() {
        active = false;
        store.removeItem(key);
      },
      token() {
        return store.getItem(key);
      }
    };
  }

  return { createCheckoutSubmitGuard };
});
