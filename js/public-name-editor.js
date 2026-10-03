/* Own-account display preference. No target IDs, roles or hierarchy are submitted. */
(function(root){
 'use strict';
 function mount(container, profile) {
  if (!container || !profile?.id) return;
  if (container.querySelector('form')?.dataset.owner === profile.id) return;
  container.replaceChildren();
  const form = document.createElement('form'); form.dataset.owner = profile.id; form.className = 'rounded-3xl border border-gray-200 bg-white p-5';
  const label = document.createElement('label'); label.className = 'block text-xs font-bold text-primary'; label.textContent = 'Nombre que verán tus clientes';
  const input = document.createElement('input'); input.type = 'text'; input.maxLength = 40; input.autocomplete = 'off'; input.value = profile.nombre_publico || '';
  input.placeholder = root.PTHAffiliate.publicName({nombre:profile.nombre}); input.className = 'mt-2 block w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm';
  label.append(input);
  const help = document.createElement('p'); help.className = 'mt-2 text-xs text-gray-500'; help.textContent = 'Escribe tu nombre corto o el nombre de tu tienda, hasta 40 caracteres. Si lo dejas vacío, mostramos tu primer nombre. Tus pedidos y tu nombre de cuenta se conservan.';
  const button = document.createElement('button'); button.type = 'submit'; button.className = 'mt-3 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-white'; button.textContent = 'Guardar nombre público';
  const status = document.createElement('p'); status.setAttribute('role','status'); status.className = 'mt-2 text-xs text-gray-500';
  form.append(label, help, button, status); container.append(form);
  form.addEventListener('submit', async event => {
   event.preventDefault(); if (button.disabled) return;
   button.disabled = true; status.textContent = 'Guardando…';
   const token = root.PTHSecureData.token();
   try {
    const result = await root.PTHSecureData.publicName(input.value.trim() || null);
    if (token !== root.PTHSecureData.token() || profile.id !== root.currentUserData?.id || !form.isConnected) return;
    if (result.error) throw Error(result.error.message);
    root.currentUserData = {...root.currentUserData, nombre_publico:result.data.nombre_publico};
    input.value = result.data.nombre_publico || '';
    status.textContent = 'Guardado. Tus clientes verán: ' + root.PTHAffiliate.publicName(root.currentUserData);
   } catch (error) { if (token === root.PTHSecureData.token() && form.isConnected) status.textContent = error.message || 'No se pudo guardar. Vuelve a intentar.'; }
   finally { button.disabled = false; }
  });
 }
 root.PTHPublicNameEditor = {mount};
})(window);
