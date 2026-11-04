# secure-data: fallos intermitentes, 4 noviembre 2026

## Evidencia confirmada (solo lectura)

- Proyecto `ljqwaovevfatkiigirhf`, función `secure-data`, despliegue v35, región `us-east-1`.
- Ventana UTC: 2026-11-04 19:00–21:15.
- `function_edge_logs`: 923 POST 200, 78 POST 503, 295 OPTIONS 204.
- Los 78 POST 503 tienen `sb_error_code=EDGE_FUNCTION_ERROR`, respuesta de 98 bytes.
- Ejemplo 21:11:42.132 UTC: request ID `01a1a867-40f8-791f-bebd-8086358a2070`, ejecución `628e3209-ece4-4237-83ca-5def837c318e`, duración 572 ms.
- Ejemplo 21:11:36.467 UTC: request ID `01a1a867-2a79-77e6-a34f-3df83eb30d61`, ejecución `766913f9-9842-4ab1-ad89-149369419193`, duración 666 ms.
- Ambas ejecuciones registraron arranque correcto (30/36 ms). Sus cierres posteriores indicaron `EarlyDrop`, no un límite de CPU/memoria. No se obtuvo stack trace de excepción.
- En `postgrest_logs`, durante la misma ventana, aparecen múltiples `Warp server error: Thread killed by timeout manager`. No se ha demostrado la correlación con cada solicitud de función.
- Una prueba anónima de `action=session` respondió HTTP 401 con JSON válido en 1776 ms. Es una prueba de disponibilidad, no una autenticación de usuario.

## Lo que NO está demostrado

`EDGE_FUNCTION_ERROR` puede acompañar respuestas 5XX del código o fallos de ejecución: por sí solo no demuestra una caída de infraestructura. `EarlyDrop` tampoco demuestra la causa del 503. No se ha confirmado agotamiento de recursos, cuota, bloqueo de cuenta, error de contraseña ni defecto del teléfono. No se conserva el cuerpo histórico de las respuestas 503 en estos registros.

## Pregunta para soporte (lista para enviar; no enviada)

Please investigate intermittent HTTP 503 / EDGE_FUNCTION_ERROR for secure-data v35 in project ljqwaovevfatkiigirhf (us-east-1), Nov 4 2026, 19:00–21:15 UTC. We recorded 78 failed POSTs alongside 923 successful POSTs. Two request IDs and execution IDs are listed above. Workers booted successfully, no associated exception stack was visible, and later shutdowns were EarlyDrop. PostgREST logs also show repeated “Warp server error: Thread killed by timeout manager” in that interval. Can you identify the origin and response bodies of these 503s and determine whether they correlate with the PostgREST timeouts or regional runtime issues?

## Mitigación en el cliente

- Clasificar HTTP 502/503/504 como indisponibilidad temporal, incluso si el cuerpo es HTML o JSON con estructura de plataforma.
- Una repetición como máximo, tras 500 ms, exclusivamente de `session` o `query/select`.
- Nunca repetir automáticamente login, RPC, pagos, aprobación, checkout (ni quote ni submit), ni escrituras.
- Conservar credenciales ante indisponibilidad; mantener invalidación de 401 genuinos y comprobar cambio de sesión antes de repetir.
- Distinguir timeout, fallo de transporte y respuesta inválida; no revelar cuerpos internos ni credenciales.
- Esto mitiga el impacto; no resuelve por sí solo la causa del servidor.

Referencias: https://supabase.com/docs/guides/functions/error-codes y https://supabase.com/kb/troubleshooting/edge-function-503-response
