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
    const getKey = () => typeof storageKey === 'function' ? storageKey() : storageKey || 'pth_checkout_submission_token';
    const memory = new Map();
    const read = key => { try { return store.getItem(key) || memory.get(key) || null; } catch (_) { return memory.get(key) || null; } };
    const write = (key, value) => { memory.set(key, value); try { store.setItem(key, value); } catch (_) {} };
    const remove = key => { memory.delete(key); try { store.removeItem(key); } catch (_) {} };
    const makeId = idFactory || (() => (
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `pth-${Date.now()}-${Math.random().toString(16).slice(2)}`
    ));
    let active = false;
    let activeKey = null;

    return {
      acquire() {
        const key = getKey();
        if (active) return { accepted: false, token: read(activeKey) };
        active = true;
        activeKey = key;
        let token = read(key);
        if (!token) {
          token = String(makeId());
          write(key, token);
        }
        return { accepted: true, token };
      },
      fail() {
        active = false;
      },
      succeed() {
        active = false;
        remove(activeKey || getKey());
        activeKey = null;
      },
      token() {
        return read(getKey());
      }
    };
  }

  return { createCheckoutSubmitGuard };
});
