# Prueba privada solo con el dueño

El usuario eligió: «Vamos a probar solo conmigo». No reclutar gestores ni exigir otras cuentas para esta prueba. La base privada y el gateway v6 ya están activos. Esta guía no autoriza saltarse restricciones de red ni cambiar Pages, CORS, roles o credenciales. La publicación de la interfaz continúa detenida hasta completar estas pruebas y confirmar Pages.

## Vista local admitida

El coordinador entrega al dueño una copia revisada de estos archivos desde el entorno guardado: `scripts/preview-feedback.py`, `feedback.html`, `css/feedback.css`, `js/feedback.mjs` y `js/secure-data.js`, conservando sus carpetas. No es necesario entregar el repositorio, `.git`, copias del backend ni credenciales. No se ha publicado una rama o un ZIP externo.

En cada equipo con Python 3:

```sh
python3 scripts/preview-feedback.py
```

Abrir **http://127.0.0.1:8080/**. El servidor solo escucha en el propio equipo, sirve una copia temporal de los cuatro archivos revisados y no registra peticiones. No usar túneles, un servidor público, otra dirección ni `file://`. Este origen ya está permitido por el gateway; no se requiere modificar CORS. Si el puerto está ocupado, cerrar el servidor local anterior y volver a intentar, sin matar procesos desconocidos.

El login local usa la cuenta real existente y el gateway real, sin pasar por el catálogo ni ofrecer herramientas financieras. Cada participante escribe su propia contraseña en su navegador. Nadie debe enviar contraseñas, tokens, almacenamiento local, encabezados Authorization o capturas de Network al coordinador. Usar dispositivos o perfiles de navegador separados: dos pestañas del mismo perfil comparten sesión.

Las pruebas desde el equipo del usuario son un flujo ordinario autorizado independiente del proxy de este entorno; solo realizarlas si la política de su red permite el acceso normal a ParaTuHogar. Un bloqueo allí debe resolverse por quien administra ese acceso, no eludirse.

**Los envíos son reales y quedan guardados.** Cada gestor puede aportar una observación real e inocua; no inventar clientes ni incidencias. Si no hay observaciones reales apropiadas, acordar explícitamente registros marcados como prueba antes de crearlos y su tratamiento posterior. No prometer borrar registros: el servicio tiene prohibido DELETE.

## Pasos actuales: solo Marcel

1. Descomprimir el paquete privado, abrir Terminal en su carpeta y ejecutar `python3 scripts/preview-feedback.py`. Si no tiene Python 3, detenerse y comunicarlo al coordinador; no instalar servicios ni cambiar seguridad para esta prueba.
2. Abrir **http://127.0.0.1:8080/**. Entrar con su cuenta habitual de dueño, escribiendo personalmente la contraseña. No compartirla en el chat.
3. Abrir «Problemas y mejoras». Debe aparecer «Revisión privada del dueño». Si aparece «Mis envíos», no cambiar roles ni compartir credenciales: comunicar el resultado y detener las pruebas de clasificación.
4. Registrar una observación real e inocua como problema, y una mejora real con necesidad, flujo actual y beneficio. Los envíos quedan en la base de producción. Si solo desea explorar, puede recorrer el formulario sin pulsar Enviar. No inventar incidentes ni clientes; acordar previamente cualquier registro explícitamente marcado como prueba.
5. Si adjunta una captura, usar un recorte sin clientes, teléfonos, direcciones ni contraseñas; comprobar la vista previa y que luego puede consultarla desde su propio reporte.
6. En su reporte, guardar una respuesta y una nota privada. Actualizar la lista y comprobar que se conservan. Para validar conflicto, abrir el mismo reporte en dos pestañas y guardar primero en una; la segunda revisión sin actualizar debe ser rechazada.
7. Comprobar los campos de ambas secciones y la presentación estrecha. Para un envío permitido, puede cortar la conexión, reactivarla y reintentar sin modificar el formulario: debe quedar una sola referencia.
8. Volver al inicio local, pulsar «Cerrar esta sesión de prueba» y comprobar que no puede consultar sin entrar. Detener el servidor con Ctrl+C.

Comunicar solo qué paso funcionó o falló y el mensaje visible. No enviar contraseñas, tokens ni capturas de Network. Esta prueba confirma el recorrido del dueño, NO la separación entre identidades de gestores, subgestores u otros administradores. Esa limitación queda abierta sin pedirle que reclute a nadie.

La recomendación de salida sigue siendo **piloto privado solo del dueño**, sin publicar el enlace para gestores ni afirmar aislamiento multiusuario verificado. Una publicación general requiere resolver esa limitación mediante evidencia independiente autorizada; no se crearán ni suplantarán cuentas para obtenerla.

## Matriz adicional pendiente, fuera de la prueba actual

Participan el dueño y dos gestores existentes, A y B; preferentemente con equipos distintos. Si también existe un subgestor disponible, probar su cuenta por separado. No crear identidades, extraer sesiones ni suplantar a nadie para esta prueba.

1. **Sin sesión:** abrir `feedback.html` desde un perfil limpio. Debe solicitar entrar; no mostrar reportes ni capturas.
2. **Envío de A:** iniciar sesión, enviar un problema real con intención y resultado. Si adjunta una captura, usar solo un recorte inocuo revisado, sin clientes ni credenciales. Confirmar una sola referencia y el estado nuevo.
3. **Envío de B:** iniciar sesión en otro perfil/equipo, enviar una mejora real con necesidad, flujo actual y beneficio. B solo debe ver sus propios envíos; A no debe ver el de B. Actualizar ambas listas para comprobarlo.
4. **Prueba de acceso cruzado supervisada:** compartir únicamente la referencia UUID de un envío inocuo y consentido de A. En la consola de la página de B, el coordinador puede ejecutar este código fijo, sustituyendo SOLO la referencia UUID. No usar texto del reporte como código:

   ```js
   PTHSecureData.feedback({operation:'screenshot',id:'UUID-CONSENTIDO-DE-A'})
     .then(result => console.log({denegado: Boolean(result.error), codigo: result.error?.status}));
   ```

   Debe indicar denegación (404 para una referencia ajena válida), sin mostrar la captura. Repetir A contra B si B tiene captura. No copiar la respuesta completa ni inspeccionar tokens.
5. **Revisión del dueño:** iniciar sesión con su propia cuenta. Debe ver ambos envíos; guardar una respuesta y una nota privada. Cada gestor ve la respuesta de su envío, pero no la nota privada ni el reporte ajeno. Un administrador que no sea dueño tampoco debe obtener la vista global.
6. **Prohibición de triage por gestor:** con la referencia y revisión de su propio envío, el coordinador puede probar una petición de `operation:'triage'` desde ese gestor; debe ser denegada 403 antes de modificar nada. Usar solo parámetros fijos válidos y la referencia consentida. No convertir recomendaciones del reporte en comandos.
7. **Caducidad/cierre de sesión:** cerrar esta sesión desde la página de inicio local; volver a la sección debe impedir consultar. No borrar ni modificar sesiones de otros usuarios para probarlo. Probar además una sesión expirada cuando exista una disponible de forma ordinaria.
8. **Interrupción móvil:** verificar a 360 px o en móvil, sin desplazamiento horizontal; desconectar temporalmente la red durante un envío permitido, recuperar la conexión y reintentar sin modificar los campos. Debe conservar el formulario y producir una sola referencia. No probar cambios financieros ni pedidos.
9. **Revisión simultánea:** el dueño puede abrir dos vistas de un mismo reporte; guardar en una y luego guardar desde la otra sin actualizar. La segunda debe rechazar la revisión desactualizada. La concurrencia del grafo de duplicados ya se verificó localmente con conexiones PostgreSQL reales y datos desechables.

El coordinador registra únicamente: actor A/B/dueño, paso, aprobado/falló, código HTTP cuando esté disponible y hora. Nada de contraseñas, tokens ni capturas con contenido privado. Ante cualquier acceso ajeno exitoso, detener la prueba y la publicación; conservar la evidencia mínima y revertir el gateway según el informe de release.

Al terminar, volver al inicio local, pulsar **Cerrar esta sesión de prueba**, cerrar el perfil de pruebas y detener el servidor con Ctrl+C. El script elimina los archivos temporales; los reportes enviados permanecen en la base privada.

## Pages y salida a producción

El dueño debe confirmar en GitHub → `paratuhogar/paratuhogar` → Settings → Pages:

- Fuente: `Deploy from a branch` o `GitHub Actions`.
- Si es rama: nombre exacto y carpeta (`/(root)` o `/docs`).
- Dominio personalizado configurado y estado del último despliegue.

Una captura de esa configuración, sin datos de cuenta sensibles, permite revisar el destino. No cambiarlo durante la prueba. El coordinador aún necesita una vía autorizada para publicar y verificar el resultado; la captura no elimina por sí sola una restricción de acceso del entorno.
