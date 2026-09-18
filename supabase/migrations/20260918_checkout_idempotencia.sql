begin;

-- Evita que un doble clic, reintento del navegador o reenvío de red
-- cree otra fila para el mismo checkout y proveedor.
alter table public.pedidos
  add column if not exists submission_token text;

alter table public.pedidos_subgestores
  add column if not exists submission_token text;

create unique index if not exists pedidos_submission_token_proveedor_uidx
  on public.pedidos (submission_token, proveedor)
  where submission_token is not null;

create unique index if not exists pedidos_subgestores_submission_token_proveedor_uidx
  on public.pedidos_subgestores (submission_token, proveedor)
  where submission_token is not null;

comment on column public.pedidos.submission_token is
  'Clave idempotente del checkout; se conserva para impedir reenvíos duplicados.';

comment on column public.pedidos_subgestores.submission_token is
  'Clave idempotente del checkout; se conserva al aprobar el pedido.';

commit;
