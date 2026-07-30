-- Opiniones reales autorizadas: Carmen María y Consuelo.
-- Requiere haber ejecutado antes opiniones-verificadas.sql.
-- Las valoraciones quedan en NULL porque las clientas no eligieron una
-- puntuación numérica; la web no debe convertir elogios en estrellas inventadas.

insert into public.opiniones_verificadas (
    pedido_id,
    producto_id,
    producto_nombre,
    producto_imagen_url,
    comentario,
    valoracion_atencion,
    valoracion_mensajeria,
    municipio,
    mostrar_municipio,
    foto_url,
    foto_autorizada,
    consentimiento_publicacion,
    consentimiento_fecha,
    aprobada,
    fecha_entrega
) values (
    'f75e059f-60a8-4841-9c85-a8944658bd2e',
    'ccca522f-3b21-4948-a144-4e54569967c9',
    '2x Panel Solar SUN 630W',
    'panel_sun630W.jpg',
    'Muy complacida con la atención. Los equipos llegaron muy bien y los mensajeros fueron súper atentos, serviciales y educados.',
    null,
    null,
    'Plaza de la Revolución',
    false,
    null,
    false,
    true,
    now(),
    true,
    date '2026-06-11'
)
on conflict (pedido_id) do update set
    producto_nombre = excluded.producto_nombre,
    producto_id = excluded.producto_id,
    producto_imagen_url = excluded.producto_imagen_url,
    comentario = excluded.comentario,
    consentimiento_publicacion = true,
    consentimiento_fecha = excluded.consentimiento_fecha,
    aprobada = true,
    updated_at = now();

insert into public.opiniones_verificadas (
    pedido_id,
    producto_id,
    producto_nombre,
    producto_imagen_url,
    comentario,
    valoracion_atencion,
    valoracion_mensajeria,
    municipio,
    mostrar_municipio,
    foto_url,
    foto_autorizada,
    consentimiento_publicacion,
    consentimiento_fecha,
    aprobada,
    fecha_entrega
) values (
    'c210fecb-90cf-4e6b-80bf-de182a665866',
    'f0dd5843-791c-47ef-8f0d-f1345e612c4e',
    'Inversor 3kw con batería 7kwh Infinisolar',
    'Inversor3kwX7kwbateria.jpg',
    'Es una bestia: funciona muy bien incluso con la cocina, el freezer, el refrigerador, ventiladores y el televisor. Lo máximo, aun sin los paneles instalados. La recomiendo.',
    null,
    null,
    'Playa',
    false,
    null,
    false,
    true,
    now(),
    true,
    date '2026-04-21'
)
on conflict (pedido_id) do update set
    producto_nombre = excluded.producto_nombre,
    producto_id = excluded.producto_id,
    producto_imagen_url = excluded.producto_imagen_url,
    comentario = excluded.comentario,
    consentimiento_publicacion = true,
    consentimiento_fecha = excluded.consentimiento_fecha,
    aprobada = true,
    updated_at = now();
