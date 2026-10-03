-- Review-only proposal. Not applied. Preserves every existing gestores.nombre,
-- account ID, short link, order and commission reference.
begin;
set local lock_timeout = '5s';
alter table public.gestores add column if not exists nombre_publico text;
do $$
begin
 if not exists (select 1 from pg_constraint where conrelid = 'public.gestores'::regclass and conname = 'gestores_nombre_publico_valid') then
  alter table public.gestores add constraint gestores_nombre_publico_valid check (
   nombre_publico is null or (
    char_length(btrim(nombre_publico)) between 1 and 40
    and nombre_publico !~ '[<>[:cntrl:]]'
   )
  );
 end if;
end;
$$;
comment on column public.gestores.nombre_publico is
 'Customer-facing display label only. Never an attribution, login, payroll or commission key. NULL uses a safe abbreviated display name.';
commit;
-- No backfill, RLS change, grants, expiration change or credential creation.
-- Rollback should leave this nullable column in place to preserve user aliases;
-- old frontend/server versions ignore it. Do not rename nombre or delete links.
