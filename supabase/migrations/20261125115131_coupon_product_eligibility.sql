-- Coupon scope is enforced by the service-only transaction, never browser labels.
begin;
alter table pth_coupons.campaigns
 add column product_size text check(product_size in ('Pequeño','Mediano','Grande')),
 add column product_min_cents bigint not null default 0 check(product_min_cents between 0 and 999999999999),
 add column product_max_cents bigint check(product_max_cents between 0 and 999999999999),
 add constraint coupon_product_price_range check(product_max_cents is null or product_max_cents>=product_min_cents);

create function pth_coupons.eligible_rows(p_rows jsonb,p_size text,p_min bigint,p_max bigint) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare gross jsonb;r jsonb;line jsonb;p public.productos%rowtype;result jsonb:='[]';
 amount bigint;eligible bigint;unit_cents bigint;quantity integer;line_count integer:=0;provider text;
begin
 -- gross_rows has already verified direct-customer context and exact cents.
 for r in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(r->'_coupon_lines') is distinct from 'array'
   or jsonb_array_length(r->'_coupon_lines') not between 1 and 100
  then raise sqlstate 'PT409' using message='Actualiza la comprobación del cupón.';end if;
  line_count:=line_count+jsonb_array_length(r->'_coupon_lines');
 end loop;
 if line_count>100 then raise sqlstate 'PT409' using message='Demasiados productos.';end if;
 -- One deterministic lock order: catalogue size/price cannot change during insert.
 perform 1 from public.productos pr where pr.id in
  (select (l->>'producto_id')::uuid from jsonb_array_elements(p_rows) rr cross join lateral jsonb_array_elements(rr->'_coupon_lines') l)
  order by pr.id for share;
 for r in select value from jsonb_array_elements(p_rows) loop
  amount:=0;eligible:=0;provider:=r->>'proveedor';
  for line in select value from jsonb_array_elements(r->'_coupon_lines') loop
   if jsonb_typeof(line) is distinct from 'object'
    or coalesce(line->>'cantidad','')!~'^[0-9]{1,5}$'
    or coalesce(line->>'unit_cents','')!~'^[0-9]{1,12}$'
   then raise sqlstate 'PT409' using message='Productos del cupón no válidos.';end if;
   quantity:=(line->>'cantidad')::integer;unit_cents:=(line->>'unit_cents')::bigint;
   select * into p from public.productos where id=(line->>'producto_id')::uuid;
   if not found or quantity not between 1 and 10000 or unit_cents<=0
    or p.disponible is distinct from 'SI' or p.proveedor is distinct from provider
    or p.precio is null or p.precio*100 is distinct from unit_cents::numeric
   then raise sqlstate 'PT409' using message='Cambió el producto. Revisa el cupón.';end if;
   amount:=amount+unit_cents*quantity;
   if p."tamaño_envio"=p_size and unit_cents>=p_min and (p_max is null or unit_cents<=p_max) then
    eligible:=eligible+unit_cents*quantity;
   end if;
  end loop;
  if amount is distinct from round(((r->>'total')::numeric-(r->>'costo_mensajeria')::numeric)*100)::bigint
   then raise sqlstate 'PT409' using message='Los productos no coinciden con el pedido.';end if;
  result:=result||jsonb_build_array(jsonb_build_object('proveedor',provider,'gross_cents',amount,'eligible_cents',eligible));
 end loop;
 return result;
exception when invalid_text_representation or numeric_value_out_of_range or null_value_not_allowed then
 raise sqlstate 'PT409' using message='Productos del cupón no válidos.';
end;
$$;
revoke all on function pth_coupons.eligible_rows(jsonb,text,bigint,bigint) from public,anon,authenticated;
grant execute on function pth_coupons.eligible_rows(jsonb,text,bigint,bigint) to service_role;

create or replace function pth_coupons.snapshot(p_code text,p_phone text,p_rows jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare c pth_coupons.campaigns%rowtype;gross jsonb;subtotal bigint;discount bigint;allocations jsonb;ph text;eligible bigint;
begin
 ph:=pth_customers.canonical_phone(p_phone);
 if ph is null then raise sqlstate 'PT409' using message='No se pudo validar el cupón.';end if;
 perform pg_advisory_xact_lock(hashtextextended('customer-binding:'||ph,0));
 perform pth_coupons.assert_direct(ph);
 gross:=pth_coupons.gross_rows(ph,p_rows);
 select * into c from pth_coupons.campaigns where code=upper(btrim(p_code)) for update;
 if not found or not c.active or clock_timestamp()<c.starts_at or clock_timestamp()>=c.ends_at
 then raise sqlstate 'PT409' using message='No se pudo validar el cupón.';end if;
 if c.product_size is not null then
  gross:=pth_coupons.eligible_rows(p_rows,c.product_size,c.product_min_cents,c.product_max_cents);
 else
  raise sqlstate 'PT409' using message='Administración debe configurar el tamaño del cupón.';
 end if;
 select sum((x->>'eligible_cents')::bigint) into eligible from jsonb_array_elements(gross) x;
 if coalesce(eligible,0)<=0 then raise sqlstate 'PT409' using message='Este cupón no corresponde al tamaño o precio de los equipos.';end if;
 select sum((x->>'gross_cents')::bigint) into subtotal from jsonb_array_elements(gross) x;
 if subtotal<c.minimum_cents
  or (select count(*) from pth_coupons.redemptions where campaign_id=c.id)>=c.total_limit
  or (select count(*) from pth_coupons.redemptions where campaign_id=c.id and phone_hash=pth_coupons.phone_hash(ph))>=c.phone_limit
 then raise sqlstate 'PT409' using message='No se pudo validar el cupón.';end if;
 discount:=least(eligible,case when c.kind='fixed' then c.value else trunc(eligible::numeric*c.value/100)::bigint end);
 if discount<=0 then raise sqlstate 'PT409' using message='El descuento no es aplicable.';end if;
 -- Largest fractional remainders first; provider name breaks ties independently
 -- of browser row order. Integer/numeric arithmetic never uses float dollars.
 with base as (
  select x->>'proveedor' provider,(x->>'gross_cents')::bigint amount,
   trunc(discount::numeric*(x->>'eligible_cents')::bigint/eligible)::bigint partial,
   mod(discount::numeric*(x->>'eligible_cents')::bigint,eligible) remainder
  from jsonb_array_elements(gross) x
 ),ranked as (
  select *,row_number() over(order by remainder desc,provider collate "C") rank,
   discount-sum(partial) over() residual from base
 ) select jsonb_agg(jsonb_build_object('proveedor',provider,'gross_cents',amount,
   'discount_cents',partial+case when rank<=residual then 1 else 0 end,
   'net_cents',amount-partial-case when rank<=residual then 1 else 0 end) order by provider collate "C")
  into allocations from ranked;
 return jsonb_build_object('id',c.id,'revision',c.revision,'code',c.code,'subtotal_cents',subtotal,
  'discount_cents',discount,'eligible_subtotal_cents',eligible,'allocations',allocations);
end;
$$;

create or replace function public.pth_insert_coupon_checkout(p_rows jsonb,p_coupon jsonb,p_captures jsonb,p_tariff jsonb) returns jsonb
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
  net_rows:=net_rows||jsonb_build_array((r-'_coupon_lines'-'subtotal_productos'-'descuento_productos'-'cupon_codigo')
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

create or replace function public.pth_coupon_admin(p_actor uuid,p_operation text,p_campaign jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
<<coupon_admin>>
declare c pth_coupons.campaigns%rowtype;prior jsonb;current_snapshot jsonb;campaign_id uuid;
 code text;kind text;value bigint;minimum bigint;starts timestamptz;ends timestamptz;total integer;per_phone integer;active boolean;reason text;
 product_size text;product_min bigint;product_max bigint;defaults jsonb;
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
  -- An older editor cannot erase the new restrictions.
  if nullif(p_campaign->>'id','') is not null then
   select jsonb_build_object('product_size',camp.product_size,'product_min_cents',camp.product_min_cents,'product_max_cents',camp.product_max_cents)
    into defaults from pth_coupons.campaigns camp where camp.id=(p_campaign->>'id')::uuid;
   p_campaign:=coalesce(defaults,'{}'::jsonb)||p_campaign;
  end if;
  product_size:=p_campaign->>'product_size';
  if product_size is null or product_size not in ('Pequeño','Mediano','Grande')
   or coalesce(p_campaign->>'product_min_cents','')!~'^[0-9]{1,12}$'
   or (p_campaign->>'product_max_cents' is not null and (p_campaign->>'product_max_cents')!~'^[0-9]{1,12}$')
  then raise sqlstate 'PT400' using message='Revisa el tamaño y los precios por equipo del cupón.';end if;
  product_min:=(p_campaign->>'product_min_cents')::bigint;product_max:=(p_campaign->>'product_max_cents')::bigint;
  if product_max is not null and product_max<product_min then raise sqlstate 'PT400' using message='El precio máximo no puede ser menor que el mínimo.';end if;
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
  insert into pth_coupons.campaigns(product_size,product_min_cents,product_max_cents,code,kind,value,minimum_cents,starts_at,ends_at,total_limit,phone_limit,active,created_by,updated_by)
  values(product_size,product_min,product_max,code,kind,value,minimum,starts,ends,total,per_phone,active,p_actor,p_actor) returning * into c;
 else
  select * into c from pth_coupons.campaigns where id=campaign_id for update;
  if not found or c.code<>code then raise sqlstate 'PT400' using message='El código de una campaña no puede cambiar';end if;
  if c.revision is distinct from (p_campaign->>'revision')::integer then
   raise sqlstate 'PT409' using message='La campaña cambió. Actualiza antes de guardar.';end if;
  prior:=to_jsonb(c);
  update pth_coupons.campaigns set product_size=coupon_admin.product_size,product_min_cents=product_min,product_max_cents=product_max,
   kind=coupon_admin.kind,value=coupon_admin.value,minimum_cents=minimum,
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
-- Apply the explicitly requested 1/3/10 USD size mapping to existing fixed coupons.
-- System actor is intentionally not a human administrator; historical orders and
-- immutable old revisions are untouched. Other legacy values remain unchanged.
do $$
declare c pth_coupons.campaigns%rowtype;prior jsonb;current_snapshot jsonb;
begin
 for c in select * from pth_coupons.campaigns where kind='fixed' and value in (100,300,1000) and product_size is null order by id for update loop
  prior:=to_jsonb(c);
  update pth_coupons.campaigns set product_size=case c.value when 100 then 'Pequeño' when 300 then 'Mediano' else 'Grande' end,
   revision=revision+1,updated_by='00000000-0000-0000-0000-000000000000',updated_at=clock_timestamp()
   where id=c.id returning * into c;
  current_snapshot:=to_jsonb(c);
  insert into pth_coupons.revisions(campaign_id,revision,snapshot) values(c.id,c.revision,current_snapshot);
  insert into pth_coupons.audit(campaign_id,revision,actor_id,reason,before_snapshot,after_snapshot)
   values(c.id,c.revision,'00000000-0000-0000-0000-000000000000',
    'Sistema: alcance por tamaño 1/3/10 USD solicitado y aprobado por Marcel; límites por equipo configurables por administración.',prior,current_snapshot);
 end loop;
end;
$$;
notify pgrst,'reload schema';
commit;
