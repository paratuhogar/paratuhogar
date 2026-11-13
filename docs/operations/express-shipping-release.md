# Activación de mensajería exprés

La web anterior y los pedidos existentes conservan la mensajería ordinaria. Ninguna tarifa exprés se precarga.

1. Con autorización de publicación, comprobar que la rama incorpora `main` y comparar las definiciones en vivo de `pth_insert_checkout` y `pth_review_subgestor` con sus bases en el repositorio. Confirmar que municipio y localidad identifican una sola tarifa, y los permisos de `service_role` sobre `tarifas_mensajeria` (lectura y permiso de actualización necesario para tomar el bloqueo de fila).
2. En un entorno PostgreSQL aislado con dos conexiones, probar que actualizar o borrar una tarifa mientras se confirma no permite guardar una cotización obsoleta, y que el intento se puede cotizar nuevamente sin duplicados. Probar también aprobación simultánea y recuperación del recibo.
3. Aplicar, en este orden, `express-shipping.sql`, `atomic-order-numbering.sql` y `subgestor-review.sql` de `supabase/proposals/`. El último conserva la tabla y los índices de auditoría si ya existen. Confirmar que los RPC de inserción y aprobación siguen disponibles solo para el gateway y que las nuevas columnas tienen sus restricciones.
4. Desplegar el gateway `secure-data` conservando su configuración y sus demás archivos vigentes. Después publicar la interfaz y verificar la versión `20261112-express1` y su caché. No crear pedidos de prueba ni introducir tarifas de ejemplo en producción.
5. Ángel podrá activar un tamaño en **Administración → Mensajería** guardando precio final y plazo. Para retirarlo, puede dejar los dos campos vacíos y guardar.
