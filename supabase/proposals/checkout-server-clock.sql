-- No order/customer data. Do not purge these identities and reissue their clocks.
begin;
create table pth_private.checkout_attempt_clocks (
 nonce text primary key check(nonce ~ '^[a-f0-9]{64}$'),
 issued_at timestamptz not null default clock_timestamp()
);
alter table pth_private.checkout_attempt_clocks enable row level security;
revoke all on pth_private.checkout_attempt_clocks from public,anon,authenticated,service_role;
grant usage on schema pth_private to service_role;
grant select,insert on pth_private.checkout_attempt_clocks to service_role;
create function public.pth_checkout_clock(p_nonce text,p_create boolean default false)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare issued timestamptz;
begin
 if p_nonce is null or p_nonce !~ '^[a-f0-9]{64}$' then raise exception 'Intento no válido';end if;
 if p_create then
  insert into pth_private.checkout_attempt_clocks(nonce) values(p_nonce) on conflict(nonce) do nothing;
 end if;
 select issued_at into issued from pth_private.checkout_attempt_clocks where nonce=p_nonce;
 if not found then raise exception 'Intento no registrado';end if;
 return jsonb_build_object('issuedAt',floor(extract(epoch from issued)*1000),
  'serverNow',floor(extract(epoch from clock_timestamp())*1000));
end;
$$;
revoke all on function public.pth_checkout_clock(text,boolean) from public,anon,authenticated;
grant execute on function public.pth_checkout_clock(text,boolean) to service_role;
commit;
