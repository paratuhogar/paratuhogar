-- Synthetic CTE rows only. Prefix the reviewed aggregate SELECT with these CTEs.
-- This file creates no objects and changes no real data.
fixtures_gestores(id,nombre,nombre_publico,rol,estado,activo,parent_id) as (
 values
 ('11111111-1111-4111-8111-111111111111'::uuid,'Principal A','Tienda A','gestor','activo',true,null::uuid),
 ('22222222-2222-4222-8222-222222222222'::uuid,'Principal B','Tienda B','gestor','activo',true,null::uuid),
 ('33333333-3333-4333-8333-333333333333'::uuid,'Principal C','Tienda C','gestor','activo',true,null::uuid),
 ('44444444-4444-4444-8444-444444444444'::uuid,'Colaborador A','Tienda A','admin','activo',true,'11111111-1111-4111-8111-111111111111'::uuid),
 ('55555555-5555-4555-8555-555555555555'::uuid,'Administrador','Administración','admin','activo',true,null::uuid),
 ('66666666-6666-4666-8666-666666666666'::uuid,'Duplicado','Duplicado A','gestor','activo',true,null::uuid),
 ('77777777-7777-4777-8777-777777777777'::uuid,'Duplicado','Duplicado B','gestor','activo',true,null::uuid),
 ('88888888-8888-4888-8888-888888888888'::uuid,'Inactivo','Inactivo','gestor','inactivo',true,null::uuid)
), fixtures_pedidos(id,gestor,subgestor_nombre,fecha,fecha_entrega,estado) as (
 select x.id,x.gestor,x.child,'2026-09-20T12:00:00Z'::timestamptz,x.delivered_at::timestamptz,x.state from (values
 (1,'Principal A',null,'2026-10-01T04:00:00Z','Entregado'),
 (2,'Principal A',null,'2026-10-02T12:00:00Z','Entregado'),
 (3,'Principal B',null,'2026-10-01T12:00:00Z','Entregado'),
 (4,'Principal B',null,'2026-10-02T12:00:00Z','Entregado'),
 (5,'Principal C',null,'2026-10-02T12:00:00Z','Entregado'),
 (6,'Principal A','Colaborador A','2026-10-01T12:00:00Z','Entregado'),
 (7,'Principal A','Colaborador A','2026-10-02T12:00:00Z','Entregado'),
 (8,'Principal A','Colaborador A','2026-10-03T10:00:00Z','Entregado'),
 (9,'Principal A',null,null,'Entregado'),
 (10,'Duplicado',null,'2026-10-02T12:00:00Z','Entregado'),
 (11,'Administrador',null,'2026-10-02T12:00:00Z','Entregado'),
 (12,'Inactivo',null,'2026-10-02T12:00:00Z','Entregado'),
 (13,'Principal A',null,'2026-10-01T03:59:59Z','Entregado'),
 (14,'Principal A',null,'2026-11-01T04:30:00Z','Entregado'),
 (15,'Principal A',null,'2026-11-01T05:30:00Z','Entregado'),
 (16,'Principal A',null,'2026-10-04T12:00:00Z','Entregado'),
 (17,'Principal A',null,'2026-10-02T12:00:00Z','Cancelado'),
 (18,'Missing account',null,'2026-10-02T12:00:00Z','Entregado')
 ) x(id,gestor,child,delivered_at,state)
)
