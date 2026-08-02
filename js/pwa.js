(() => {
  const SW_VERSION = '2026-08-02-pwa4';
  let registration = null;
  let reloadingForUpdate = false;

  function ensureStatusBar() {
    let bar = document.getElementById('pth-connection-status');
    if (bar) return bar;
    bar = document.createElement('aside');
    bar.id = 'pth-connection-status';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');
    bar.style.cssText = 'display:none;position:fixed;left:50%;bottom:18px;z-index:99999;max-width:calc(100% - 24px);transform:translateX(-50%);align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:#0f172a;color:#fff;box-shadow:0 14px 36px rgba(15,23,42,.28);font:700 12px/1.3 Arial,sans-serif';
    bar.innerHTML = '<span data-pth-status-text></span><button type="button" data-pth-status-action style="display:none;border:0;border-radius:10px;padding:8px 10px;background:#fff;color:#1a4789;font:800 11px Arial,sans-serif;white-space:nowrap">Actualizar</button>';
    document.body.appendChild(bar);
    return bar;
  }

  function showStatus(message, actionLabel = '', action = null) {
    const bar = ensureStatusBar();
    const text = bar.querySelector('[data-pth-status-text]');
    const button = bar.querySelector('[data-pth-status-action]');
    text.textContent = message;
    button.style.display = actionLabel ? 'block' : 'none';
    button.textContent = actionLabel || 'Actualizar';
    button.onclick = action;
    bar.style.display = 'flex';
  }

  function hideStatus() {
    const bar = document.getElementById('pth-connection-status');
    if (bar) bar.style.display = 'none';
  }

  function updateConnectionStatus() {
    if (!navigator.onLine) {
      showStatus('Sin conexión. La tienda se actualizará cuando regresen los datos.', 'Reintentar', () => location.reload());
    } else if (!registration?.waiting) {
      hideStatus();
    }
  }

  function offerUpdate(worker) {
    showStatus('Hay una versión nueva de ParaTuHogar disponible.', 'Actualizar ahora', () => {
      reloadingForUpdate = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    });
  }

  async function registerPwa() {
    if (!('serviceWorker' in navigator)) return;
    if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(location.hostname)) return;

    try {
      registration = await navigator.serviceWorker.register(`/service-worker.js?v=${SW_VERSION}`, {
        scope: '/',
        updateViaCache: 'none'
      });
      if (registration.waiting) offerUpdate(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
        });
      });
    } catch (error) {
      console.info('La instalación de la aplicación no está disponible todavía:', error.message);
    }
  }

  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (reloadingForUpdate) location.reload();
  });
  window.addEventListener('DOMContentLoaded', () => {
    updateConnectionStatus();
    registerPwa();
  }, { once: true });
})();
