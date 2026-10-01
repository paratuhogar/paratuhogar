# Preparar las claves de notificaciones sin compartirlas

Estas claves identifican al servidor cuando envía notificaciones. No son tu
contraseña. No hace falta enviarlas a ChatGPT ni dar acceso general a tus secretos.
El usuario realiza estos pasos en su equipo y en el panel autenticado de Supabase.
No hay una herramienta de entrada segura de secretos disponible en esta sesión.

## 1. Generarlas en tu propio Mac

Abre Terminal dentro de la copia actualizada del repositorio. Con Node.js instalado,
ejecuta tú mismo (no mediante una herramienta de chat):

```sh
node scripts/prepare-push-secrets.mjs --local-user-setup
```

El programa no descarga nada ni envía información. Crea una carpeta privada nueva
en tu carpeta de usuario, fuera del repositorio, con permisos solo para ti. Imprime
su ubicación, nunca las claves. No sobrescribe claves anteriores.

En esa carpeta habrá `edge-secrets.env` y `dispatch-secret.txt`. Ábrelos tú en un
editor local privado. No los subas a GitHub, al chat ni a una carpeta compartida;
no compartas capturas con sus valores. No ejecutes `cat` de esos archivos en una
sesión de herramientas compartida. El script nunca ha sido ejecutado por el agente.

## 2. Guardarlas en Supabase

Entra con tu cuenta de Supabase, abre el proyecto **paratuhogar**, referencia
`ljqwaovevfatkiigirhf`, y ve a **Edge Functions → Secrets**. Usa el formulario
**Add new secrets**: cada línea de `edge-secrets.env` contiene `NOMBRE=VALOR`.
Pon la parte izquierda en **Key**, la derecha en **Value**, y pulsa **Save**.
No cambies otros secretos del proyecto. Estos son los cinco nombres:

| Nombre | Uso |
| --- | --- |
| `PTH_PUSH_VAPID_PUBLIC_KEY` | Clave pública que recibirá el navegador al activar avisos. |
| `PTH_PUSH_VAPID_PRIVATE_KEY` | Clave privada para firmar envíos desde el servidor. Nunca va al navegador. |
| `PTH_PUSH_VAPID_SUBJECT` | Identificación pública: `https://paratuhogar.org`. |
| `PTH_PUSH_DISPATCH_SECRET` | Autoriza únicamente las llamadas del programador al proceso de envío. |
| `PTH_PUSH_ENABLED` | Déjalo en `false` durante esta preparación. |

Supabase documenta este formulario en
[Production secrets](https://supabase.com/docs/guides/functions/secrets#production-secrets).
El gateway `secure-data` comprueba la presencia de la configuración sin devolver
valores privados. El futuro despachador usará la clave VAPID privada y el secreto
de envío dentro de su entorno servidor. Introducir valores ahora no activa avisos:
además del interruptor en false hay una barrera de código deshabilitada.

## 3. Guardar solo el secreto de envío en Vault

En el mismo proyecto abre **Integrations → Vault → Secrets** y el formulario para
añadir un secreto. Usa:

- **Name:** `pth_push_dispatch_secret`
- **Secret/Value:** el contenido de `dispatch-secret.txt` (el mismo valor que
  `PTH_PUSH_DISPATCH_SECRET` en Edge Functions).
- **Description:** `Autorización del programador de notificaciones ParaTuHogar`.

Pulsa guardar. No pongas aquí la clave VAPID privada ni una clave service_role.
El programador leerá este secreto por su nombre al invocar al despachador; no se
pegará su valor en SQL ni en la definición de la tarea. La interfaz segura de Vault
está documentada en [Supabase Vault](https://supabase.com/docs/guides/database/vault).

Guarda una copia de recuperación en tu gestor privado de contraseñas y elimina
los archivos temporales locales cuando hayas comprobado ambos formularios.
Después basta responder **«Ya están configuradas»**, sin valores ni capturas.

## Estado técnico de esta preparación

- Migración `20261001221521_admin_web_push_disabled_preparation` aplicada.
- Tres tablas privadas con RLS; anon/authenticated sin acceso. Service role tiene
  SELECT/INSERT/UPDATE/DELETE, sin TRUNCATE. Los dos disparadores están deshabilitados.
- `secure-data` v8 activo, con configuración y operaciones propias de suscripción;
  nuevas suscripciones deshabilitadas incluso si se introducen claves ahora.
- 141 pruebas Node y prueba SQL local pasan. Verificación real de grants/RLS y
  disparadores realizada. Advisor señala solo el aviso informativo esperado de
  tabla privada con RLS sin políticas para clientes.
- No claves generadas/configuradas por el agente, ningún dispositivo registrado,
  ningún aviso enviado y ninguna tarea cron creada.
- Pendientes: despachador con reintentos/claims, enlaces autenticados, conectar la
  interfaz al gateway y piloto real. Solo después se habilitarán envío y disparadores.

Cuando esté activo, el programador revisará la cola cada minuto; se añade el
tiempo del proveedor/navegador, así que no es entrega instantánea garantizada.
«Pedido nuevo» significa inserción confirmada en `pedidos`, no pago ni entrega.
Los pedidos de subgestor avisan después de su aprobación hacia esa tabla.
Mejoras nuevas solo llegan a las cuentas que ya pueden revisarlas; pedidos, a los
administradores con acceso vigente. No se amplían permisos para recibir avisos.
