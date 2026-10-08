# Metadatos Supabase — solo lectura, 8 octubre 2026

Proyecto existente: paratuhogar. SELECT de metadatos, sin datos de solicitantes.
PostgreSQL 17.6. questionnaire/application_token todavía ausentes.
public.gestores: RLS activo; grants de tabla solo postgres y service_role.
Sin grants de columna a anon/authenticated. Políticas existentes permanecen
sin cambios. La propuesta no añade grants, políticas, roles ni backfill.
No se aplicó migración ni se desplegó Edge. No se crearon credenciales.
Esta lectura verifica el estado actual y compatibilidad de tipos/funciones;
no certifica ejecución de la migración ni integración Edge/PostgREST.
