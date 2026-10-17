# Trabajo sin conexión: revisión local

Base: origin/main c454c374b14dddd7b5729919a090e545f92927c9 (fetch y fast-forward comprobados). Sin publicación.

Copia y ahorro de datos se consultan en Trabajo sin conexión del dashboard. El acceso Conexión también permite llegar sin sesión. Al usar copia offline, solo se presenta esa sección del dashboard y no se cargan sus datos de negocio. Catálogo enfoca el buscador sin desplazamiento posterior; pendientes conservan resumen visible y detalles expandibles. Comprobación de envío vencido y recuperación de carrito permanecen en catálogo. No se cambia almacenamiento ni lógica de pedidos.

Validación local:
- 40 pruebas de adaptador offline, copia y recuperación de catálogo: PASS.
- tests/work-settings-browser.cjs: PASS 390 y 1440 px; navegación, foco, scroll, ahorro persistido, pendientes visibles y detalle accesible, recarga offline, cero escrituras de negocio en fixture.
- tests/checkout-recovery-latest-browser.cjs: PASS 390 y 1280 px; recuperación y últimos recibos.
- npm run check:js y git diff --check: PASS.
- Revisión independiente: se corrigió acceso público, conservación de acciones pendientes, scroll tardío y texto offline extenso.
- Capturas reales Chromium con datos sintéticos: /workspace/scratch/work-settings/{catalog,dashboard,offline}-{390,1440}.png. Las fuentes externas se bloquean en las pruebas; los iconos existentes pueden verse como texto en las capturas.

Rollback: git revert <commit de este cambio>. Se comprobó git apply --reverse --check contra el parche del cambio, conservado en /workspace/scratch/work-settings/rollback.patch. No se ha ejecutado el rollback sobre el árbol final.

No se hicieron push, despliegue, pedidos reales ni WhatsApp. No se instalaron Docker ni PostgreSQL. No se intentó eludir los Forbidden de Actions/checks ni el 403 del Tunnel; validación solo local.
