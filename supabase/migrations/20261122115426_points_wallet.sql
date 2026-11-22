-- Prepared locally. Deploy disabled; activation requires a separate authorized
-- operator update of pth_points.config at the real server UTC instant.
begin;
create schema pth_points;
revoke all on schema pth_points from public,anon,authenticated;
grant usage on schema pth_points to service_role;

create table pth_points.config (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 started_at timestamptz,
 check(not enabled or started_at is not null)
);
insert into pth_points.config(singleton) values(true);

-- UUIDs below deliberately do NOT cascade from public operational tables.
-- Deleting a product, sale, or account must never erase an earned obligation.
create table pth_points.rules (
 id uuid primary key default gen_random_uuid(), product_id uuid not null,
 points_per_unit integer check(points_per_unit>=0),
 valid_from timestamptz not null default clock_timestamp(), valid_until timestamptz,
 actor_id uuid not null, reason text not null check(length(btrim(reason)) between 1 and 1000),
 check(valid_until is null or valid_until>=valid_from)
);
create unique index points_current_rule on pth_points.rules(product_id) where valid_until is null;
create index points_rules_history on pth_points.rules(product_id,valid_from desc);

create table pth_points.captures (
 id uuid primary key default gen_random_uuid(), order_id uuid not null unique,
 original_source text not null check(original_source in ('pedidos','pedidos_subgestores')),
 beneficiary_id uuid, order_reference text, submission_key text,
 original_at timestamptz not null default clock_timestamp(),
 request_snapshot jsonb not null,
 total_points bigint not null check(total_points>=0)
);
create index points_captures_account on pth_points.captures(beneficiary_id,original_at desc,id);
create table pth_points.lines (
 id uuid primary key default gen_random_uuid(), capture_id uuid not null references pth_points.captures(id),
 product_id uuid not null, product_name text, quantity integer not null check(quantity between 1 and 10000),
 size text, rule_id uuid references pth_points.rules(id),
 points_per_unit integer not null check(points_per_unit>=0)
);
create index points_lines_capture on pth_points.lines(capture_id);
create index points_lines_rule on pth_points.lines(rule_id) where rule_id is not null;
create table pth_points.earning_state (
 capture_id uuid primary key references pth_points.captures(id),
 revision bigint not null default 0, eligible boolean not null default false,
 cancelled boolean not null default false,
 issue text, manual_resolved boolean not null default false,
 manual_beneficiary_id uuid,
 manual_points integer not null default 0 check(manual_points>=0),
 voided boolean not null default false
);
create index points_unresolved on pth_points.earning_state(capture_id) where issue is not null and not manual_resolved;
create table pth_points.movements (
 id uuid primary key default gen_random_uuid(), beneficiary_id uuid not null,
 capture_id uuid references pth_points.captures(id), points bigint not null,
 kind text not null check(kind in ('sale_credit','sale_restore','manual_credit','reversal')),
 reason text not null check(length(btrim(reason)) between 1 and 1000),
 created_at timestamptz not null default clock_timestamp(), actor_id uuid,
 request_key text not null unique, reversal_of uuid unique references pth_points.movements(id),
 check((points>0 and kind<>'reversal' and reversal_of is null)
    or (points<0 and kind='reversal' and reversal_of is not null))
);
create index points_movements_account on pth_points.movements(beneficiary_id,created_at desc,id desc);
create index points_movements_capture on pth_points.movements(capture_id,created_at desc);
create table pth_points.requests (
 request_key text primary key, actor_id uuid not null, operation text not null,
 payload jsonb not null, response jsonb not null, created_at timestamptz not null default clock_timestamp()
);

create function pth_points.immutable() returns trigger language plpgsql security invoker
set search_path=pg_catalog as $$
begin raise exception 'El historial de puntos es inmutable'; end;
$$;
create trigger points_captures_immutable before update or delete or truncate on pth_points.captures
 for each statement execute function pth_points.immutable();
create trigger points_lines_immutable before update or delete or truncate on pth_points.lines
 for each statement execute function pth_points.immutable();
create trigger points_movements_immutable before update or delete or truncate on pth_points.movements
 for each statement execute function pth_points.immutable();
create trigger points_requests_immutable before update or delete or truncate on pth_points.requests
 for each statement execute function pth_points.immutable();

create function pth_points.base_points(p_size text) returns integer language sql immutable security invoker
set search_path=pg_catalog as $$
 select case lower(btrim(p_size)) when 'pequeño' then 1 when 'pequeno' then 1
  when 'mediano' then 2 when 'grande' then 3 else null end;
$$;

create function pth_points.rule_period_guard() returns trigger language plpgsql security invoker
set search_path=pg_catalog as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('points-product:'||new.product_id::text,0));
 if exists(select 1 from pth_points.rules r where r.product_id=new.product_id and r.id<>new.id
  and tstzrange(r.valid_from,r.valid_until,'[)') && tstzrange(new.valid_from,new.valid_until,'[)'))
 then raise exception 'Las vigencias de reglas no pueden solaparse';end if;
 return new;
end;
$$;
create trigger points_rule_periods before insert or update on pth_points.rules
 for each row execute function pth_points.rule_period_guard();

create function pth_points.ledger_insert_guard() returns trigger language plpgsql security invoker
set search_path=pg_catalog as $$
declare v_original pth_points.movements%rowtype; v_beneficiary uuid;
begin
 if new.capture_id is not null then
  select coalesce(c.beneficiary_id,s.manual_beneficiary_id) into v_beneficiary
   from pth_points.captures c join pth_points.earning_state s on s.capture_id=c.id where c.id=new.capture_id;
  if v_beneficiary is distinct from new.beneficiary_id then raise exception 'Beneficiario de movimiento no válido';end if;
 end if;
 if new.points<0 then
  select * into v_original from pth_points.movements where id=new.reversal_of;
  if not found or v_original.points<=0 or new.points<>-v_original.points
   or new.beneficiary_id<>v_original.beneficiary_id or new.capture_id is distinct from v_original.capture_id
  then raise exception 'Reverso no válido: debe anular exactamente su movimiento original';end if;
  -- Every debit cancels one entire immutable positive movement exactly once
  -- (UNIQUE reversal_of). Thus each credit/reversal pair has net zero and all
  -- unpaired credits are positive: no account-wide SUM lock is necessary.
 end if;
 return new;
end;
$$;
create trigger points_ledger_insert before insert on pth_points.movements
 for each row execute function pth_points.ledger_insert_guard();

create function pth_points.movement_json(p_id uuid) returns jsonb language sql stable security invoker
set search_path=pg_catalog as $$
 select jsonb_build_object('id',m.id,'points',m.points,'kind',m.kind,'reason',m.reason,
  'createdAt',m.created_at,'orderReference',c.order_reference,'reversalOf',m.reversal_of)
 from pth_points.movements m left join pth_points.captures c on c.id=m.capture_id where m.id=p_id;
$$;

-- Captured sale transitions serialize on their own earning_state row. An
-- account-wide lock would invert the lock order across bulk order triggers.
create function pth_points.append_movement(
 p_beneficiary uuid,p_capture uuid,p_points bigint,p_kind text,p_reason text,
 p_actor uuid,p_key text,p_reversal uuid default null
) returns uuid language plpgsql security invoker set search_path=pg_catalog as $$
declare v_id uuid;
begin
 insert into pth_points.movements(beneficiary_id,capture_id,points,kind,reason,actor_id,request_key,reversal_of)
 values(p_beneficiary,p_capture,p_points,p_kind,p_reason,p_actor,p_key,p_reversal) returning id into v_id;
 return v_id;
end;
$$;

create function pth_points.reconcile(p_order uuid) returns void language plpgsql security invoker
set search_path=pg_catalog as $$
declare c pth_points.captures%rowtype; s pth_points.earning_state%rowtype;
 v_order jsonb; v_eligible boolean; v_target bigint; v_net bigint; m record; v_beneficiary uuid;
begin
 select * into c from pth_points.captures where order_id=p_order;
 if not found then return;end if;
 select * into strict s from pth_points.earning_state where capture_id=c.id for update;
 -- Approval inserts the same UUID in pedidos before removing its child row.
 select to_jsonb(p) into v_order from public.pedidos p where id=p_order;
 if v_order is null then
  select to_jsonb(p) into v_order from public.pedidos_subgestores p where id=p_order;
 end if;
 v_eligible:=coalesce(v_order->>'estado'='Entregado'
  and v_order->>'estado_financiero' in ('Conciliado_Prov','Liquidado_Gestor'),false);
 update pth_points.earning_state set eligible=v_eligible,
  cancelled=v_order is null or lower(coalesce(v_order->>'estado','')) in ('cancelado','cancelada','devuelto','devuelta','rechazado','rechazada')
  where capture_id=c.id;
 v_beneficiary:=coalesce(c.beneficiary_id,s.manual_beneficiary_id);
 if v_beneficiary is null then return;end if;
 v_target:=case when not v_eligible or s.voided then 0
  when s.manual_resolved then s.manual_points when s.issue is null then c.total_points else 0 end;
 select coalesce(sum(points),0) into v_net from pth_points.movements where capture_id=c.id;
 if v_net=v_target then return;end if;
 update pth_points.earning_state set revision=revision+1 where capture_id=c.id returning * into s;
 if v_target=0 then
  for m in select p.* from pth_points.movements p where p.capture_id=c.id and p.points>0
    and not exists(select 1 from pth_points.movements r where r.reversal_of=p.id)
    order by p.created_at,p.id loop
   perform pth_points.append_movement(v_beneficiary,c.id,-m.points,'reversal',
    'Venta sin entrega y conciliación válidas',null,'capture:'||c.id||':'||s.revision||':'||m.id,m.id);
  end loop;
 elsif v_net=0 then
  perform pth_points.append_movement(v_beneficiary,c.id,v_target,
   case when s.revision=1 and not s.manual_resolved then 'sale_credit' else 'sale_restore' end,
   case when s.revision=1 then 'Venta entregada y conciliada' else 'Elegibilidad de venta restaurada' end,
   null,'capture:'||c.id||':'||s.revision);
 else raise exception 'Estado de puntos incoherente; requiere revisión';
 end if;
end;
$$;

create function pth_points.capture_order(p_source text,p_order jsonb,p_capture jsonb)
returns void language plpgsql security invoker set search_path=pg_catalog as $$
declare v_id uuid; v_beneficiary uuid; v_line jsonb; v_product jsonb; v_rule pth_points.rules%rowtype;
 v_lines jsonb:='[]'; v_points integer; v_quantity integer; v_total bigint:=0; v_issue text;
 v_order_id uuid:=(p_order->>'id')::uuid;
begin
 if exists(select 1 from pth_points.captures where order_id=v_order_id) then return;end if;
 if not exists(select 1 from pth_points.config where enabled and started_at<=clock_timestamp()) then return;end if;
 v_beneficiary:=nullif(p_capture->>'beneficiary_id','')::uuid;
 if v_beneficiary is null and p_source='pedidos' and p_order->>'gestor'='Venta Directa' then return;end if;
 if v_beneficiary is null then v_issue:='missing_beneficiary';
 elsif not exists(select 1 from public.gestores where id=v_beneficiary) then raise exception 'Beneficiario no válido';
 end if;
 if p_source='pedidos_subgestores' and v_beneficiary is distinct from (p_order->>'subgestor_id')::uuid
 then raise exception 'El beneficiario no coincide con el subgestor';end if;
 if jsonb_typeof(p_capture->'lines') is distinct from 'array'
  or jsonb_array_length(p_capture->'lines')=0 then v_issue:=coalesce(v_issue,'unstructured_lines');
 else
  if jsonb_array_length(p_capture->'lines')>100 then raise exception 'Captura demasiado grande';end if;
  for v_line in select value from jsonb_array_elements(p_capture->'lines') loop
   if jsonb_typeof(v_line) is distinct from 'object' or coalesce(v_line->>'cantidad','')!~'^[0-9]{1,5}$'
    or (v_line->>'cantidad')::integer not between 1 and 10000
    or coalesce(v_line->>'producto_id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   then v_issue:=coalesce(v_issue,'invalid_lines');continue;end if;
   v_quantity:=(v_line->>'cantidad')::integer;
   select to_jsonb(p) into v_product from public.productos p where id=(v_line->>'producto_id')::uuid;
   if v_product is null then v_issue:=coalesce(v_issue,'missing_product');end if;
   select * into v_rule from pth_points.rules where product_id=(v_line->>'producto_id')::uuid and valid_until is null;
   v_points:=coalesce(v_rule.points_per_unit,pth_points.base_points(v_product->>'tamaño_envio'));
   if pth_points.base_points(v_product->>'tamaño_envio') is null then v_issue:=coalesce(v_issue,'missing_classification');end if;
   v_lines:=v_lines||jsonb_build_array(jsonb_build_object('product_id',v_line->>'producto_id',
    'product_name',v_product->>'nombre','quantity',v_quantity,'size',v_product->>'tamaño_envio',
    'rule_id',v_rule.id,'points_per_unit',coalesce(v_points,0)));
   v_total:=v_total+v_quantity::bigint*coalesce(v_points,0);
  end loop;
 end if;
 insert into pth_points.captures(order_id,original_source,beneficiary_id,order_reference,submission_key,request_snapshot,total_points)
 values(v_order_id,p_source,v_beneficiary,p_order->>'orden_dia',p_order->>'submission_token',
  coalesce(p_capture,'{}'),v_total) returning id into v_id;
 insert into pth_points.earning_state(capture_id,issue) values(v_id,v_issue);
 insert into pth_points.lines(capture_id,product_id,product_name,quantity,size,rule_id,points_per_unit)
 select v_id,(x->>'product_id')::uuid,x->>'product_name',(x->>'quantity')::integer,x->>'size',
  (x->>'rule_id')::uuid,(x->>'points_per_unit')::integer from jsonb_array_elements(v_lines) x;
 perform pth_points.reconcile(v_order_id);
end;
$$;

create function pth_points.order_changed() returns trigger language plpgsql security invoker
set search_path=pg_catalog as $$
declare v_order jsonb; v_beneficiary uuid;
begin
 if tg_op='DELETE' then perform pth_points.reconcile(old.id);return old;end if;
 -- Approval is a same-ID transfer, not a new sale. Its child source still
 -- exists during INSERT pedidos; if it had no launch-time capture, keep it
 -- uncaptured rather than backfilling an issue at the later approval time.
 if tg_op='INSERT' and current_setting('pth.points_wrapping',true) is distinct from 'on'
  and not (tg_table_name='pedidos' and exists(select 1 from public.pedidos_subgestores s where s.id=new.id)) then
  v_order:=to_jsonb(new);
  if tg_table_name='pedidos_subgestores' then v_beneficiary:=(v_order->>'subgestor_id')::uuid;end if;
  perform pth_points.capture_order(tg_table_name,v_order,
   jsonb_build_object('beneficiary_id',v_beneficiary,'lines','[]'::jsonb));
 end if;
 perform pth_points.reconcile(new.id);
 return new;
end;
$$;
create trigger points_pedidos after insert or update or delete on public.pedidos
 for each row execute function pth_points.order_changed();
create trigger points_subgestores after insert or update or delete on public.pedidos_subgestores
 for each row execute function pth_points.order_changed();

create function public.pth_insert_checkout_points(p_table text,p_rows jsonb,p_captures jsonb,p_tariff jsonb default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare v_row jsonb; v_capture jsonb; v_order jsonb; v_existing uuid[]; v_result jsonb; v_old_setting text; v_product_id uuid;
 v_stored pth_points.captures%rowtype;
begin
 if p_table is null or p_table not in ('pedidos','pedidos_subgestores')
  or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 30
  or jsonb_typeof(p_captures) is distinct from 'array' then raise exception 'Lote de capturas no válido';end if;
 if jsonb_array_length(p_captures)<>jsonb_array_length(p_rows) or exists(
  select 1 from jsonb_array_elements(p_captures) c where jsonb_typeof(c)<>'object' or not exists(
   select 1 from jsonb_array_elements(p_rows) r where r->>'id'=c->>'pedido_id'))
  or (select count(distinct c->>'pedido_id') from jsonb_array_elements(p_captures) c)<>jsonb_array_length(p_rows)
 then raise exception 'Cada captura debe corresponder a un pedido del lote';end if;
 -- Same namespace and key as the original insertion RPC, before checking age.
 -- A receipt retry cannot acquire a new snapshot for a pre-activation sale.
 perform pg_advisory_xact_lock(hashtextextended('checkout-insert:'||split_part(p_rows->0->>'submission_token','.',5),0));
 select coalesce(array_agg(id),'{}'::uuid[]) into v_existing from (
  select id from public.pedidos where id in(select (r->>'id')::uuid from jsonb_array_elements(p_rows) r)
  union select id from public.pedidos_subgestores where id in(select (r->>'id')::uuid from jsonb_array_elements(p_rows) r)
 ) x;
 for v_capture in select value from jsonb_array_elements(p_captures) loop
  select * into v_stored from pth_points.captures where order_id=(v_capture->>'pedido_id')::uuid;
  if found and v_stored.request_snapshot is distinct from v_capture then raise exception 'La captura no coincide con la solicitud original';end if;
 end loop;
 -- Fence concurrent rule replacement BEFORE its SELECT snapshot is taken.
 -- Lock all products across the batch in UUID order, never per browser order.
 for v_product_id in select distinct (l->>'producto_id')::uuid
  from jsonb_array_elements(p_captures) c cross join lateral
   jsonb_array_elements(case when jsonb_typeof(c->'lines')='array' then c->'lines' else '[]'::jsonb end) l
  where coalesce(l->>'producto_id','')~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  order by 1 loop
  perform pg_advisory_xact_lock(hashtextextended('points-product:'||v_product_id::text,0));
 end loop;
 v_old_setting:=current_setting('pth.points_wrapping',true);
 perform set_config('pth.points_wrapping','on',true);
 if p_tariff is null then v_result:=public.pth_insert_checkout(p_table,p_rows);
 else v_result:=public.pth_insert_express_checkout(p_table,p_rows,p_tariff);end if;
 perform set_config('pth.points_wrapping',coalesce(v_old_setting,''),true);
 for v_capture in select value from jsonb_array_elements(p_captures) loop
  if (v_capture->>'pedido_id')::uuid=any(v_existing) then continue;end if;
  if p_table='pedidos' then
   select to_jsonb(p) into strict v_order from public.pedidos p where id=(v_capture->>'pedido_id')::uuid;
  else
   select to_jsonb(p) into strict v_order from public.pedidos_subgestores p where id=(v_capture->>'pedido_id')::uuid;
  end if;
  perform pth_points.capture_order(p_table,v_order,v_capture);
 end loop;
 return v_result;
end;
$$;

create function public.pth_points_wallet(p_actor_id uuid,p_operation text,p_body jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare a public.gestores%rowtype; v_admin boolean; v_target uuid; v_offset integer;
 v_search text; v_result jsonb; v_page jsonb; v_key text; v_previous pth_points.requests%rowtype;
 v_reason text; v_points integer; v_product public.productos%rowtype; v_rule_id uuid;
 v_movement pth_points.movements%rowtype; v_reverse uuid; v_capture pth_points.captures%rowtype;
 v_state pth_points.earning_state%rowtype; v_capture_id uuid; v_now timestamptz;
begin
 select * into a from public.gestores where id=p_actor_id;
 if not found or a.estado is distinct from 'activo' or a.activo is false
  or lower(coalesce(a.rol,'')) in ('mensajero','logistica') then raise exception 'Acceso no autorizado';end if;
 v_admin:=a.parent_id is null and lower(coalesce(a.rol,'')) in ('admin','administrador','superadmin');
 if p_operation is null or p_operation not in ('summary','accounts','rules','save_rule','grant','reverse','issues','settings')
  or jsonb_typeof(p_body) is distinct from 'object' then raise exception 'Operación no válida';end if;
 if p_operation<>'summary' and not v_admin then raise exception 'Operación reservada a administración';end if;
 if coalesce(p_body->>'offset','0')!~'^[0-9]{1,7}$' then raise exception 'Consulta no válida';end if;
 v_offset:=coalesce((p_body->>'offset')::integer,0);v_search:=coalesce(p_body->>'search','');
 if v_offset>1000000 or length(v_search)>120 then raise exception 'Consulta no válida';end if;
 if p_operation='settings' then
  if p_body<>'{}'::jsonb then raise exception 'Configuración de solo lectura';end if;
  return (select jsonb_build_object('enabled',enabled,'startedAt',started_at) from pth_points.config);
 elsif p_operation='summary' then
  v_target:=coalesce((p_body->>'beneficiaryId')::uuid,a.id);
  if v_target<>a.id and not v_admin then raise exception 'Solo puedes consultar tu propia cuenta';end if;
  if not exists(select 1 from public.gestores where id=v_target) then raise exception 'Cuenta no válida';end if;
  select coalesce(jsonb_agg(pth_points.movement_json(id) order by created_at desc,id desc),'[]') into v_page
   from (select id,created_at from pth_points.movements where beneficiary_id=v_target order by created_at desc,id desc limit 51 offset v_offset) x;
  select jsonb_build_object('beneficiary',(select jsonb_build_object('id',id,'name',nombre) from public.gestores where id=v_target),
   'enabled',enabled,'startedAt',started_at,
   'balance',(select coalesce(sum(points),0) from pth_points.movements where beneficiary_id=v_target),
   'pending',(select coalesce(sum(c.total_points),0) from pth_points.captures c join pth_points.earning_state s on s.capture_id=c.id
    where c.beneficiary_id=v_target and not s.eligible and not s.cancelled and s.issue is null and not s.manual_resolved and not s.voided),
   'reversed',(select coalesce(-sum(points),0) from pth_points.movements where beneficiary_id=v_target and points<0),
   'movements',(select coalesce(jsonb_agg(value order by ordinality),'[]') from jsonb_array_elements(v_page) with ordinality where ordinality<=50),
   'nextOffset',case when jsonb_array_length(v_page)>50 then v_offset+50 end) into v_result from pth_points.config;
  return v_result;
 elsif p_operation='accounts' then
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',nombre,'active',active) order by nombre,id),'[]') into v_page
   from (select id,nombre,coalesce(estado='activo' and activo is not false,false) active from public.gestores
    where lower(coalesce(rol,'')) not in ('mensajero','logistica') and strpos(lower(coalesce(nombre,'')),lower(v_search))>0
    order by nombre,id limit 51 offset v_offset) x;
 elsif p_operation='rules' then
  select coalesce(jsonb_agg(item order by name,id),'[]') into v_page from (
   select p.id,p.nombre name,jsonb_build_object('productId',p.id,'name',p.nombre,'size',p."tamaño_envio",
    'pointsPerUnit',coalesce(r.points_per_unit,pth_points.base_points(p."tamaño_envio")),'customPoints',r.points_per_unit) item
   from public.productos p left join pth_points.rules r on r.product_id=p.id and r.valid_until is null
   where strpos(lower(coalesce(p.nombre,'')),lower(v_search))>0 order by p.nombre,p.id limit 51 offset v_offset
  ) x;
 elsif p_operation='issues' then
  select coalesce(jsonb_agg(item order by original_at desc,id),'[]') into v_page from (
   select c.id,c.original_at,jsonb_build_object('id',c.id,'beneficiaryId',c.beneficiary_id,'name',coalesce(g.nombre,'Cuenta sin identificar'),
    'orderReference',c.order_reference,'reason',s.issue) item from pth_points.captures c
   join pth_points.earning_state s on s.capture_id=c.id left join public.gestores g on g.id=c.beneficiary_id
   where s.issue is not null and not s.manual_resolved order by c.original_at desc,c.id limit 51 offset v_offset
  ) x;
 else
  v_key:=p_body->>'idempotencyKey';v_reason:=btrim(p_body->>'reason');
  if v_key is null or length(v_key) not between 8 and 200 then raise exception 'Clave de solicitud no válida';end if;
  if coalesce(length(v_reason),0) not between 1 and 1000 then raise exception 'Indica un motivo válido';end if;
  perform pg_advisory_xact_lock(hashtextextended('points-request:'||v_key,0));
  select * into v_previous from pth_points.requests where request_key=v_key;
  if found then
   if v_previous.actor_id<>a.id or v_previous.operation<>p_operation or v_previous.payload<>p_body then
    raise exception 'La clave de idempotencia pertenece a otra solicitud';end if;
   return v_previous.response;
  end if;
  if p_operation='save_rule' then
   if not p_body?'pointsPerUnit' or (p_body->'pointsPerUnit'<>'null'::jsonb and
    (jsonb_typeof(p_body->'pointsPerUnit')<>'number' or (p_body->>'pointsPerUnit')!~'^[0-9]{1,10}$'
    or (p_body->>'pointsPerUnit')::numeric>2147483647)) then raise exception 'Puntos por unidad no válidos';end if;
   v_points:=(p_body->>'pointsPerUnit')::integer;
   perform pg_advisory_xact_lock(hashtextextended('points-product:'||(p_body->>'productId'),0));
   select * into v_product from public.productos where id=(p_body->>'productId')::uuid for share;
   if not found then raise exception 'Producto no válido';end if;
   v_now:=clock_timestamp();
   update pth_points.rules set valid_until=v_now where product_id=v_product.id and valid_until is null;
   insert into pth_points.rules(product_id,points_per_unit,valid_from,actor_id,reason)
    values(v_product.id,v_points,v_now,a.id,v_reason) returning id into v_rule_id;
   v_result:=jsonb_build_object('rule',jsonb_build_object('productId',v_product.id,'name',v_product.nombre,
    'size',v_product."tamaño_envio",'pointsPerUnit',coalesce(v_points,pth_points.base_points(v_product."tamaño_envio")),'customPoints',v_points));
  elsif p_operation='grant' then
   if not exists(select 1 from pth_points.config where enabled and started_at<=clock_timestamp())
    then raise exception 'El programa de puntos está desactivado';end if;
   if jsonb_typeof(p_body->'points') is distinct from 'number' or coalesce(p_body->>'points','')!~'^[0-9]{1,10}$'
    or (p_body->>'points')::numeric not between 1 and 2147483647 then raise exception 'Puntos positivos no válidos';end if;
   v_points:=(p_body->>'points')::integer;v_target:=(p_body->>'beneficiaryId')::uuid;
   if not exists(select 1 from public.gestores where id=v_target and estado='activo' and activo is not false
    and lower(coalesce(rol,'')) not in ('mensajero','logistica')) then raise exception 'Cuenta destinataria no válida';end if;
   v_capture_id:=(p_body->>'captureId')::uuid;
   if v_capture_id is not null then
    select * into v_capture from pth_points.captures where id=v_capture_id;
    if not found or (v_capture.beneficiary_id is not null and v_capture.beneficiary_id<>v_target)
     then raise exception 'Beneficiario de captura no válido';end if;
    select * into strict v_state from pth_points.earning_state where capture_id=v_capture_id for update;
    if not v_state.eligible then raise exception 'La venta debe ser elegible: entregada y conciliada';end if;
    if v_state.issue is null or v_state.manual_resolved then raise exception 'La incidencia ya está resuelta o no requiere reconocimiento manual';end if;
    update pth_points.earning_state set manual_resolved=true,manual_points=v_points,manual_beneficiary_id=v_target,
     revision=revision+1 where capture_id=v_capture_id;
   end if;
   v_reverse:=pth_points.append_movement(v_target,v_capture_id,v_points,'manual_credit',v_reason,a.id,'request:'||v_key);
   v_result:=jsonb_build_object('movement',pth_points.movement_json(v_reverse));
  elsif p_operation='reverse' then
   select * into v_movement from pth_points.movements where id=(p_body->>'movementId')::uuid;
   if not found or v_movement.points<=0 then raise exception 'Solo se puede revertir una asignación positiva';end if;
   if v_movement.capture_id is not null then
    select * into strict v_state from pth_points.earning_state where capture_id=v_movement.capture_id for update;
    update pth_points.earning_state set manual_resolved=true,voided=true,revision=revision+1 where capture_id=v_movement.capture_id;
   else
    -- Standalone recognitions share neither an order nor a capture lock.
    -- Fence only this positive movement before checking an existing reverse;
    -- do not take this lock for captured movements (their state lock suffices).
    perform pg_advisory_xact_lock(hashtextextended('points-movement:'||v_movement.id::text,0));
   end if;
   if v_movement.capture_id is not null then
    select m.* into v_movement from pth_points.movements m where m.capture_id=v_movement.capture_id and m.points>0
     and not exists(select 1 from pth_points.movements r where r.reversal_of=m.id) order by m.created_at desc limit 1;
    if not found then
     select r.id into v_reverse from pth_points.movements r where r.reversal_of=(p_body->>'movementId')::uuid;
    end if;
   else select id into v_reverse from pth_points.movements where reversal_of=v_movement.id;
   end if;
   if v_reverse is null then
    v_reverse:=pth_points.append_movement(v_movement.beneficiary_id,v_movement.capture_id,-v_movement.points,
     'reversal',v_reason,a.id,'request:'||v_key,v_movement.id);
   end if;
   v_result:=jsonb_build_object('movement',pth_points.movement_json(v_reverse));
  end if;
  insert into pth_points.requests(request_key,actor_id,operation,payload,response) values(v_key,a.id,p_operation,p_body,v_result);
  return v_result;
 end if;
 return jsonb_build_object('rows',(select coalesce(jsonb_agg(value order by ordinality),'[]')
  from jsonb_array_elements(v_page) with ordinality where ordinality<=50),
  'nextOffset',case when jsonb_array_length(v_page)>50 then v_offset+50 end);
end;
$$;

-- No policies for browser identities. Gateway service_role is the only caller;
-- functions deliberately keep SECURITY INVOKER rather than bypassing RLS.
do $$declare t text;begin
 foreach t in array array['config','rules','captures','lines','earning_state','movements','requests'] loop
  execute format('alter table pth_points.%I enable row level security',t);
  execute format('revoke all on table pth_points.%I from public,anon,authenticated,service_role',t);
 end loop;
end$$;
grant select on all tables in schema pth_points to service_role;
grant insert on pth_points.rules,pth_points.captures,pth_points.lines,pth_points.earning_state,pth_points.movements,pth_points.requests to service_role;
grant update on pth_points.rules,pth_points.earning_state to service_role;
revoke all on all functions in schema pth_points from public,anon,authenticated;
grant execute on all functions in schema pth_points to service_role;
revoke all on function public.pth_points_wallet(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.pth_insert_checkout_points(text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.pth_points_wallet(uuid,text,jsonb) to service_role;
grant execute on function public.pth_insert_checkout_points(text,jsonb,jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
