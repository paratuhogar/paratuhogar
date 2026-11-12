-- Apply before deploying the checkout function and the storefront.
alter table public.tarifas_mensajeria
  add column precio_mediano numeric
  check (precio_mediano >= 0 and precio_mediano < 'Infinity'::numeric);

alter table public.tarifas_mensajeria enable row level security;
revoke insert, update, delete, truncate on public.tarifas_mensajeria from public, anon, authenticated;
grant select on public.tarifas_mensajeria to anon, authenticated;
create policy tarifas_mensajeria_public_read on public.tarifas_mensajeria
  for select to anon, authenticated using (true);
notify pgrst, 'reload schema';
