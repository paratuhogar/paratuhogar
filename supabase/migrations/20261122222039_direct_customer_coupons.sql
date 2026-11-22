-- Prepared locally only. No campaigns, backfills, deployment or activation.
-- Requires protect_customer_assignment and the existing atomic/points wrappers.
begin;
create schema pth_coupons;
revoke all on schema pth_coupons from public,anon,authenticated;
grant usage on schema pth_coupons to service_role;

alter table public.pedidos
 add column subtotal_productos numeric,
 add column descuento_productos numeric,
 add column cupon_codigo text;
alter table public.pedidos add constraint coupon_order_snapshot check (
 (subtotal_productos is null and descuento_productos is null and cupon_codigo is null)
 or (subtotal_productos is not null and descuento_productos is not null
  and subtotal_productos>=0 and descuento_productos>=0 and descuento_productos<=subtotal_productos
  and subtotal_productos*100=trunc(subtotal_productos*100)
  and descuento_productos*100=trunc(descuento_productos*100)
  and cupon_codigo is not null and total is not null and costo_mensajeria is not null
  and total=subtotal_productos-descuento_productos+costo_mensajeria));

create table pth_coupons.campaigns (
 id uuid primary key default gen_random_uuid(),code text not null unique,
 kind text not null check(kind in ('fixed','percent')),value bigint not null check(value>0),
 minimum_cents bigint not null check(minimum_cents>=0),
 starts_at timestamptz not null,ends_at timestamptz not null check(ends_at>starts_at),
 total_limit integer not null check(total_limit>0),phone_limit integer not null check(phone_limit>0),
 active boolean not null default false,revision integer not null default 1 check(revision>0),
 created_by uuid not null,created_at timestamptz not null default clock_timestamp(),
 updated_by uuid not null,updated_at timestamptz not null default clock_timestamp(),
 check(code~'^[A-Z0-9-]{4,32}$'),check(kind<>'percent' or value<=100)
);
create table pth_coupons.revisions (
 campaign_id uuid not null references pth_coupons.campaigns(id),revision integer not null,
 snapshot jsonb not null,created_at timestamptz not null default clock_timestamp(),
 primary key(campaign_id,revision)
);
create table pth_coupons.audit (
 id uuid primary key default gen_random_uuid(),campaign_id uuid not null references pth_coupons.campaigns(id),
 revision integer not null,actor_id uuid not null,reason text not null check(length(btrim(reason)) between 1 and 1000),
 before_snapshot jsonb,after_snapshot jsonb not null,created_at timestamptz not null default clock_timestamp(),
 foreign key(campaign_id,revision) references pth_coupons.revisions(campaign_id,revision)
);
create index coupons_audit_campaign on pth_coupons.audit(campaign_id,revision);
create table pth_coupons.redemptions (
 id uuid primary key default gen_random_uuid(),campaign_id uuid not null,
 revision integer not null,submission_token text not null unique,phone_hash text not null,
 subtotal_cents bigint not null check(subtotal_cents>0),discount_cents bigint not null check(discount_cents>=0 and discount_cents<=subtotal_cents),
 quote_snapshot jsonb not null,receipt jsonb not null,created_at timestamptz not null default clock_timestamp(),
 foreign key(campaign_id,revision) references pth_coupons.revisions(campaign_id,revision)
);
create index coupons_redemption_campaign_phone on pth_coupons.redemptions(campaign_id,phone_hash);
create table pth_coupons.allocations (
 order_id uuid primary key,redemption_id uuid not null references pth_coupons.redemptions(id),proveedor text not null,
 gross_cents bigint not null check(gross_cents>0),discount_cents bigint not null check(discount_cents>=0 and discount_cents<=gross_cents),
 net_cents bigint not null check(net_cents=gross_cents-discount_cents)
);
create index coupons_allocation_redemption on pth_coupons.allocations(redemption_id);
create table pth_coupons.quote_rates (rate_hash text primary key,events timestamptz[] not null);

create function pth_coupons.immutable() returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin raise sqlstate 'PT403' using message='El historial de cupones es inmutable';end;
$$;
create trigger coupons_revisions_immutable before update or delete or truncate on pth_coupons.revisions
 for each statement execute function pth_coupons.immutable();
create trigger coupons_audit_immutable before update or delete or truncate on pth_coupons.audit
 for each statement execute function pth_coupons.immutable();
create trigger coupons_redemptions_immutable before update or delete or truncate on pth_coupons.redemptions
 for each statement execute function pth_coupons.immutable();
create trigger coupons_allocations_immutable before update or delete or truncate on pth_coupons.allocations
 for each statement execute function pth_coupons.immutable();

create function pth_coupons.phone_hash(p_phone text) returns text language sql immutable security invoker set search_path=pg_catalog as $$
 select encode(sha256(convert_to(p_phone,'UTF8')),'hex');
$$;

-- Service-generated rows carry canonical catalogue totals. Validate the entire
-- row context, not a customer-controlled origin label or discount amount.
create function pth_coupons.gross_rows(p_phone text,p_rows jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare r jsonb;s numeric;t numeric;g numeric;result jsonb:='[]';key text;
begin
 if p_phone is null or jsonb_typeof(p_rows) is distinct from 'array'
  or jsonb_array_length(p_rows) not between 1 and 30 then
  raise sqlstate 'PT409' using message='No se pudo validar el cupón.';end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(r) is distinct from 'object' or r->>'gestor' is distinct from 'Venta Directa'
   or pth_customers.canonical_phone(r->>'telefono') is distinct from p_phone
   or coalesce(lower(btrim(r->>'origen')),'') not in ('','web','venta directa','directo','direct','directo/web')
   or (r->>'comision_total')::numeric is distinct from 0::numeric
   or coalesce((r->>'comision_subgestor')::numeric,0)<>0
   or coalesce((r->>'comision_parent')::numeric,0)<>0
   or coalesce(nullif(r->>'_referral_reference',''),'')<>''
   or coalesce(nullif(r->>'cupon_codigo',''),'')<>''
   or coalesce((r->>'descuento_productos')::numeric,0)<>0
   or coalesce(r->>'proveedor','')!~'^[A-Z0-9]{1,12}$'
   then raise sqlstate 'PT409' using message='No se pudo validar el cupón.';end if;
  for key in select jsonb_object_keys(r) loop
   if (key like 'subgestor%' or key like 'parent_gestor%') and nullif(r->>key,'') is not null
   then raise sqlstate 'PT409' using message='No se pudo validar el cupón.';end if;
  end loop;
  s:=(r->>'costo_mensajeria')::numeric;t:=(r->>'total')::numeric;
  g:=coalesce((r->>'subtotal_productos')::numeric,t-s);
  if s is null or t is null or g is null or s<0 or g<=0 or g>100000000
   or s*100<>trunc(s*100) or t*100<>trunc(t*100) or g*100<>trunc(g*100)
   or t<>g+s then raise sqlstate 'PT409' using message='No se pudo validar el cupón.';end if;
  result:=result||jsonb_build_array(jsonb_build_object('proveedor',r->>'proveedor','gross_cents',(g*100)::bigint));
 end loop;
 if (select count(distinct x->>'proveedor') from jsonb_array_elements(result) x)<>jsonb_array_length(result)
 then raise sqlstate 'PT409' using message='No se pudo validar el cupón.';end if;
 return result;
exception when invalid_text_representation or numeric_value_out_of_range then
 raise sqlstate 'PT409' using message='No se pudo validar el cupón.';
end;
$$;

create function pth_coupons.assert_direct(p_phone text) returns void
language plpgsql security invoker set search_path=pg_catalog as $$
begin
 if p_phone is null or exists(select 1 from public.gestores where pth_customers.canonical_phone(telefono)=p_phone)
  or exists(select 1 from public.customer_bindings where pth_customers.canonical_phone(phone)=p_phone)
  or exists(select 1 from public.customer_binding_events where pth_customers.canonical_phone(phone)=p_phone)
  or exists(select 1 from public.pedidos p where pth_customers.canonical_phone(p.telefono)=p_phone and (
   nullif(btrim(p.gestor),'') is not null and p.gestor<>'Venta Directa'
   or nullif(to_jsonb(p)->>'subgestor_nombre','') is not null
   or nullif(to_jsonb(p)->>'subgestor_id','') is not null
   or nullif(to_jsonb(p)->>'parent_gestor_id','') is not null
   or coalesce(p.comision_total,0)>0
   or lower(coalesce(p.origen,'')) in ('gestor','enlace compartido','manual (panel)','subgestor')))
  or exists(select 1 from public.pedidos_subgestores p where pth_customers.canonical_phone(p.telefono)=p_phone)
 then raise sqlstate 'PT409' using message='No se pudo validar el cupón.';end if;
end;
$$;

-- Always acquire a phone lock before locking a campaign. Insert callers already
-- hold checkout-insert:nonce first, matching points and assignment wrappers.
create function pth_coupons.snapshot(p_code text,p_phone text,p_rows jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare c pth_coupons.campaigns%rowtype;gross jsonb;subtotal bigint;discount bigint;allocations jsonb;ph text;
begin
 ph:=pth_customers.canonical_phone(p_phone);
 if ph is null then raise sqlstate 'PT409' using message='No se pudo validar el cupón.';end if;
 perform pg_advisory_xact_lock(hashtextextended('customer-binding:'||ph,0));
 perform pth_coupons.assert_direct(ph);
 gross:=pth_coupons.gross_rows(ph,p_rows);
 select * into c from pth_coupons.campaigns where code=upper(btrim(p_code)) for update;
 if not found or not c.active or clock_timestamp()<c.starts_at or clock_timestamp()>=c.ends_at
 then raise sqlstate 'PT409' using message='No se pudo validar el cupón.';end if;
 select sum((x->>'gross_cents')::bigint) into subtotal from jsonb_array_elements(gross) x;
 if subtotal<c.minimum_cents
  or (select count(*) from pth_coupons.redemptions where campaign_id=c.id)>=c.total_limit
  or (select count(*) from pth_coupons.redemptions where campaign_id=c.id and phone_hash=pth_coupons.phone_hash(ph))>=c.phone_limit
 then raise sqlstate 'PT409' using message='No se pudo validar el cupón.';end if;
 discount:=least(subtotal,case when c.kind='fixed' then c.value else trunc(subtotal::numeric*c.value/100)::bigint end);
 -- Largest fractional remainders first; provider name breaks ties independently
 -- of browser row order. Integer/numeric arithmetic never uses float dollars.
 with base as (
  select x->>'proveedor' provider,(x->>'gross_cents')::bigint amount,
   trunc(discount::numeric*(x->>'gross_cents')::bigint/subtotal)::bigint partial,
   mod(discount::numeric*(x->>'gross_cents')::bigint,subtotal) remainder
  from jsonb_array_elements(gross) x
 ),ranked as (
  select *,row_number() over(order by remainder desc,provider collate "C") rank,
   discount-sum(partial) over() residual from base
 ) select jsonb_agg(jsonb_build_object('proveedor',provider,'gross_cents',amount,
   'discount_cents',partial+case when rank<=residual then 1 else 0 end,
   'net_cents',amount-partial-case when rank<=residual then 1 else 0 end) order by provider collate "C")
  into allocations from ranked;
 return jsonb_build_object('id',c.id,'revision',c.revision,'code',c.code,'subtotal_cents',subtotal,
  'discount_cents',discount,'allocations',allocations);
end;
$$;

create function public.pth_coupon_quote(p_code text,p_phone text,p_rows jsonb,p_rate_key text) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare key text;ph text;recent timestamptz[];instant timestamptz:=clock_timestamp();
begin
 -- NULL is reserved for the server's signed submission revalidation. Public
 -- quote requests always provide the verified IP key; this module owns its rate.
 if p_rate_key is not null then
  if length(p_rate_key) not between 1 and 200 then raise sqlstate 'PT400' using message='Solicitud de cupón no válida';end if;
  ph:=coalesce(pth_customers.canonical_phone(p_phone),left(coalesce(p_phone,''),80));
  key:=pth_coupons.phone_hash(p_rate_key||':'||ph);
  insert into pth_coupons.quote_rates(rate_hash,events) values(key,'{}') on conflict do nothing;
  -- Lock and reread together to avoid lost attempts under parallel requests.
  perform 1 from pth_coupons.quote_rates where rate_hash=key for update;
  instant:=clock_timestamp();
  select coalesce(array_agg(t),'{}') into recent from pth_coupons.quote_rates r
   cross join lateral unnest(r.events) t where r.rate_hash=key and t>instant-interval '1 minute';
  if cardinality(recent)>=10 then raise sqlstate 'PT429' using message='Espera un minuto antes de comprobar otro cupón.';end if;
  update pth_coupons.quote_rates set events=array_append(recent,instant) where rate_hash=key;
 end if;
 begin
  return pth_coupons.snapshot(p_code,p_phone,p_rows);
 exception when others then
  -- A rejected guessed code must still count. Returning this generic envelope
  -- commits the rate event; raising here would roll it back with the RPC.
  return jsonb_build_object('error',jsonb_build_object('code','COUPON_UNAVAILABLE',
   'message','No se pudo validar el cupón.'),'sqlstate','PT409');
 end;
end;
$$;

create function public.pth_insert_coupon_checkout(p_rows jsonb,p_coupon jsonb,p_captures jsonb,p_tariff jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare token text;receipt jsonb;snapshot jsonb;ph text;r jsonb;a jsonb;net_rows jsonb:='[]';redemption uuid;
begin
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 30
 then raise sqlstate 'PT400' using message='Lote de cupón no válido';end if;
 token:=p_rows->0->>'submission_token';
 if token is null or length(token)>600 or token!~'^pthn[12]\.'
  or exists(select 1 from jsonb_array_elements(p_rows) x where x->>'submission_token' is distinct from token)
 then raise sqlstate 'PT400' using message='Clave de cupón no válida';end if;
 perform pg_advisory_xact_lock(hashtextextended('checkout-insert:'||split_part(token,'.',5),0));
 select r.receipt into receipt from pth_coupons.redemptions r where submission_token=token;
 if receipt is not null then return receipt;end if;
 -- A noncoupon receipt cannot be reinterpreted later as a discounted sale.
 if exists(select 1 from public.pedidos where submission_token=token)
  or exists(select 1 from public.pedidos_subgestores where submission_token=token)
 then raise sqlstate 'PT409' using message='Revisa el recibo del pedido existente.';end if;
 ph:=pth_customers.canonical_phone(p_coupon->>'phone');
 snapshot:=pth_coupons.snapshot(p_coupon->>'code',ph,p_rows);
 if p_coupon-'phone' is distinct from snapshot then
  raise sqlstate 'PT409' using message='Cambió el cupón. Revisa el resumen antes de confirmar.';end if;
 if p_captures is not null then
  if jsonb_typeof(p_captures) is distinct from 'array' then
   raise sqlstate 'PT400' using message='Lote de capturas no válido';end if;
  if exists(select 1 from jsonb_array_elements(p_captures) capture
   where nullif(capture->>'beneficiary_id','') is not null
    or coalesce(capture->>'sales_channel','') not in ('','direct','organic_direct')) then
   raise sqlstate 'PT409' using message='No se pudo validar el cupón.';end if;
 end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  select value into strict a from jsonb_array_elements(snapshot->'allocations') where value->>'proveedor'=r->>'proveedor';
  net_rows:=net_rows||jsonb_build_array((r-'subtotal_productos'-'descuento_productos'-'cupon_codigo')
   ||jsonb_build_object('total',(a->>'net_cents')::numeric/100+(r->>'costo_mensajeria')::numeric));
 end loop;
 if p_captures is not null then receipt:=public.pth_insert_checkout_points('pedidos',net_rows,p_captures,p_tariff);
 elsif p_tariff is not null then receipt:=public.pth_insert_express_checkout('pedidos',net_rows,p_tariff);
 else receipt:=public.pth_insert_checkout('pedidos',net_rows);end if;
 insert into pth_coupons.redemptions(campaign_id,revision,submission_token,phone_hash,subtotal_cents,discount_cents,quote_snapshot,receipt)
 values((snapshot->>'id')::uuid,(snapshot->>'revision')::integer,token,pth_coupons.phone_hash(ph),
  (snapshot->>'subtotal_cents')::bigint,(snapshot->>'discount_cents')::bigint,snapshot,receipt) returning id into redemption;
 for r in select value from jsonb_array_elements(p_rows) loop
  select value into strict a from jsonb_array_elements(snapshot->'allocations') where value->>'proveedor'=r->>'proveedor';
  update public.pedidos set subtotal_productos=(a->>'gross_cents')::numeric/100,
   descuento_productos=(a->>'discount_cents')::numeric/100,cupon_codigo=snapshot->>'code' where id=(r->>'id')::uuid;
  insert into pth_coupons.allocations(order_id,redemption_id,proveedor,gross_cents,discount_cents,net_cents)
   values((r->>'id')::uuid,redemption,r->>'proveedor',(a->>'gross_cents')::bigint,(a->>'discount_cents')::bigint,(a->>'net_cents')::bigint);
 end loop;
 return receipt;
end;
$$;

create function public.pth_coupon_admin(p_actor uuid,p_operation text,p_campaign jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
<<coupon_admin>>
declare c pth_coupons.campaigns%rowtype;prior jsonb;current_snapshot jsonb;campaign_id uuid;
 code text;kind text;value bigint;minimum bigint;starts timestamptz;ends timestamptz;total integer;per_phone integer;active boolean;reason text;
begin
 if not exists(select 1 from public.gestores g where g.id=p_actor and g.parent_id is null
  and lower(btrim(g.rol)) in ('admin','administrador','superadmin')
  and g.activo is true and lower(btrim(g.estado))='activo')
 then raise sqlstate 'PT403' using message='Administración de cupones no autorizada';end if;
 if p_operation='list' then
  return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(camp)||jsonb_build_object('uses',
   (select count(*) from pth_coupons.redemptions r where r.campaign_id=camp.id)) order by camp.created_at desc,camp.id)
   from pth_coupons.campaigns camp),'[]'::jsonb));
 end if;
 if p_operation<>'save' or jsonb_typeof(p_campaign) is distinct from 'object'
 then raise sqlstate 'PT400' using message='Operación de cupón no válida';end if;
 begin
  code:=upper(btrim(p_campaign->>'code'));kind:=p_campaign->>'kind';
  if coalesce(p_campaign->>'value','')!~'^[0-9]{1,12}$'
   or coalesce(p_campaign->>'minimum_cents','')!~'^[0-9]{1,12}$'
   or coalesce(p_campaign->>'total_limit','')!~'^[0-9]{1,9}$'
   or coalesce(p_campaign->>'phone_limit','')!~'^[0-9]{1,9}$'
   or jsonb_typeof(p_campaign->'active') is distinct from 'boolean'
  then raise sqlstate 'PT400' using message='Configuración de cupón no válida';end if;
  value:=(p_campaign->>'value')::bigint;minimum:=(p_campaign->>'minimum_cents')::bigint;
  total:=(p_campaign->>'total_limit')::integer;per_phone:=(p_campaign->>'phone_limit')::integer;
  starts:=(p_campaign->>'starts_at')::timestamptz;ends:=(p_campaign->>'ends_at')::timestamptz;
  active:=(p_campaign->>'active')::boolean;reason:=btrim(p_campaign->>'reason');
  if code is null or code!~'^[A-Z0-9-]{4,32}$' or kind is null or kind not in ('fixed','percent')
   or value<=0 or kind='percent' and value>100 or minimum<0 or total<=0 or per_phone<=0
   or starts is null or ends is null or not isfinite(starts) or not isfinite(ends) or starts>=ends
   or reason is null or length(reason) not between 1 and 1000
  then raise sqlstate 'PT400' using message='Configuración de cupón no válida';end if;
  campaign_id:=nullif(p_campaign->>'id','')::uuid;
 exception when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow then
  raise sqlstate 'PT400' using message='Configuración de cupón no válida';
 end;
 if campaign_id is null then
  insert into pth_coupons.campaigns(code,kind,value,minimum_cents,starts_at,ends_at,total_limit,phone_limit,active,created_by,updated_by)
  values(code,kind,value,minimum,starts,ends,total,per_phone,active,p_actor,p_actor) returning * into c;
 else
  select * into c from pth_coupons.campaigns where id=campaign_id for update;
  if not found or c.code<>code then raise sqlstate 'PT400' using message='El código de una campaña no puede cambiar';end if;
  if c.revision is distinct from (p_campaign->>'revision')::integer then
   raise sqlstate 'PT409' using message='La campaña cambió. Actualiza antes de guardar.';end if;
  prior:=to_jsonb(c);
  update pth_coupons.campaigns set kind=coupon_admin.kind,value=coupon_admin.value,minimum_cents=minimum,
   starts_at=starts,ends_at=ends,total_limit=total,phone_limit=per_phone,active=coupon_admin.active,
   revision=revision+1,updated_by=p_actor,updated_at=clock_timestamp() where id=campaign_id returning * into c;
 end if;
 current_snapshot:=to_jsonb(c);
 insert into pth_coupons.revisions(campaign_id,revision,snapshot) values(c.id,c.revision,current_snapshot);
 insert into pth_coupons.audit(campaign_id,revision,actor_id,reason,before_snapshot,after_snapshot)
 values(c.id,c.revision,p_actor,reason,prior,current_snapshot);
 return current_snapshot;
exception when unique_violation or check_violation then
 raise sqlstate 'PT400' using message='Código reservado o configuración de cupón no válida';
end;
$$;

alter table pth_coupons.campaigns enable row level security;
alter table pth_coupons.revisions enable row level security;
alter table pth_coupons.audit enable row level security;
alter table pth_coupons.redemptions enable row level security;
alter table pth_coupons.allocations enable row level security;
alter table pth_coupons.quote_rates enable row level security;
revoke all on all tables in schema pth_coupons from public,anon,authenticated;
revoke all on all functions in schema pth_coupons from public,anon,authenticated;
grant select,insert,update on pth_coupons.campaigns,pth_coupons.quote_rates to service_role;
grant select,insert on pth_coupons.revisions,pth_coupons.audit,pth_coupons.redemptions,pth_coupons.allocations to service_role;
grant execute on all functions in schema pth_coupons to service_role;
revoke all on function public.pth_coupon_quote(text,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.pth_insert_coupon_checkout(jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.pth_coupon_admin(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.pth_coupon_quote(text,text,jsonb,text) to service_role;
grant execute on function public.pth_insert_coupon_checkout(jsonb,jsonb,jsonb,jsonb) to service_role;
grant execute on function public.pth_coupon_admin(uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
