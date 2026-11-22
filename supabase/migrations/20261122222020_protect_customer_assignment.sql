-- Assignment-protection prerequisite. Deploy before enabling coupons.
-- No historic owners, orders, commission recipients or event rows are rewritten.
begin;
create schema if not exists pth_customers;
revoke all on schema pth_customers from public,anon,authenticated;
grant usage on schema pth_customers to service_role;

create or replace function pth_customers.canonical_phone(p_phone text)
returns text language sql immutable strict parallel safe set search_path=pg_catalog as $$
 select case
  when digits ~ '^[0-9]{8}$' then digits
  when digits ~ '^53[0-9]{8}$' then substr(digits,3)
  when digits ~ '^0[0-9]{8}$' then substr(digits,2)
  when digits ~ '^053[0-9]{8}$' then substr(digits,4)
  when digits ~ '^0053[0-9]{8}$' then substr(digits,5)
  else null end
 from (select regexp_replace(p_phone,'[^0-9]','','g') as digits) s;
$$;
revoke all on function pth_customers.canonical_phone(text) from public,anon,authenticated;
grant execute on function pth_customers.canonical_phone(text) to service_role;
-- Expression-index evaluation runs as its writer. Keep pre-existing custom
-- writers functional without exposing the private schema to browser roles.
do $$declare writer text;begin
 for writer in
  select distinct pg_get_userbyid(a.grantee) from (
   select acl.grantee,acl.privilege_type from pg_class c cross join lateral aclexplode(c.relacl) acl
    where c.oid in ('public.customer_bindings'::regclass,'public.customer_binding_events'::regclass)
   union all
   select acl.grantee,acl.privilege_type from pg_attribute c cross join lateral aclexplode(c.attacl) acl
    where c.attrelid in ('public.customer_bindings'::regclass,'public.customer_binding_events'::regclass)
  ) a where a.grantee<>0 and a.privilege_type in ('INSERT','UPDATE')
   and pg_get_userbyid(a.grantee) not in ('anon','authenticated')
 loop execute format('grant execute on function pth_customers.canonical_phone(text) to %I',writer);end loop;
end;$$;

-- Private, forward-only proof. Public audit was historically browser-writable,
-- so it cannot establish either ownership or the seller of an accepted order.
-- No existing binding or order is backfilled into these tables.
create table pth_customers.binding_owners (
 phone text primary key check(phone ~ '^[0-9]{8}$'), owner_id uuid not null,
 created_at timestamptz not null default clock_timestamp()
);
create table pth_customers.confirmed_orders (
 order_id uuid primary key, phone text not null check(phone ~ '^[0-9]{8}$'),
 seller_id uuid not null, seller_name text not null, parent_id uuid, parent_name text,
 source_table text not null check(source_table in ('pedidos','pedidos_subgestores')),
 confirmed_at timestamptz not null default clock_timestamp()
);
alter table pth_customers.binding_owners enable row level security;
alter table pth_customers.confirmed_orders enable row level security;
revoke all on pth_customers.binding_owners,pth_customers.confirmed_orders from public,anon,authenticated,service_role;
grant select,insert on pth_customers.binding_owners,pth_customers.confirmed_orders to service_role;
create function pth_customers.keep_proof_immutable()
returns trigger language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
begin raise sqlstate '42501' using message='La confirmación de asignación es inmutable';end;$$;
revoke all on function pth_customers.keep_proof_immutable() from public,anon,authenticated;
grant execute on function pth_customers.keep_proof_immutable() to service_role;
create trigger pth_keep_owner_proof before update or delete on pth_customers.binding_owners
 for each row execute function pth_customers.keep_proof_immutable();
create trigger pth_keep_order_proof before update or delete on pth_customers.confirmed_orders
 for each row execute function pth_customers.keep_proof_immutable();

-- Nonunique by design: preserve conflicting historical spellings for review.
create index if not exists customer_bindings_canonical_phone on public.customer_bindings(pth_customers.canonical_phone(phone));
create index if not exists customer_binding_events_order on public.customer_binding_events(order_id);

-- Table revokes alone do not remove explicit column grants. Preserve all other
-- roles' grants and existing policies. Compatibility policies are added only
-- when RLS was previously off, preserving the prior custom-role access model.
do $$
declare t text; col text;
begin
 foreach t in array array['customer_bindings','customer_binding_events'] loop
  if not (select relrowsecurity from pg_class where oid=('public.'||t)::regclass) then
   execute format('create policy pth_binding_existing_read on public.%I for select to public using (true)',t);
   execute format('create policy pth_binding_existing_custom_access on public.%I for all to public using (current_user not in (''anon'',''authenticated'')) with check (current_user not in (''anon'',''authenticated''))',t);
  end if;
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke insert,update,delete,truncate,references,trigger on public.%I from public,anon,authenticated',t);
  for col in select a.attname from pg_attribute a where a.attrelid=('public.'||t)::regclass and a.attnum>0 and not a.attisdropped loop
   execute format('revoke insert(%I),update(%I),references(%I) on public.%I from public,anon,authenticated',col,col,col,t);
  end loop;
  -- Policy role matching includes inherited memberships. Deny only the actual
  -- browser role, not pre-existing operational roles that inherit authenticated.
  execute format('create policy pth_binding_deny_browser_insert on public.%I as restrictive for insert to anon,authenticated with check(current_user not in (''anon'',''authenticated''))',t);
  execute format('create policy pth_binding_deny_browser_update on public.%I as restrictive for update to anon,authenticated using(current_user not in (''anon'',''authenticated'')) with check(current_user not in (''anon'',''authenticated''))',t);
  execute format('create policy pth_binding_deny_browser_delete on public.%I as restrictive for delete to anon,authenticated using(current_user not in (''anon'',''authenticated''))',t);
 end loop;
end;$$;
grant select,insert,update on public.customer_bindings to service_role;
grant select,insert on public.customer_binding_events to service_role;
do $$declare seq text;begin
 seq:=pg_get_serial_sequence('public.customer_binding_events','id');
 if seq is not null then
  execute format('revoke usage,update on sequence %s from public,anon,authenticated',seq);
  execute format('grant usage on sequence %s to service_role',seq);
 end if;
end;$$;

-- Keep the original insertion/numbering implementation byte-for-byte intact.
-- Lock attempt -> sorted phones BEFORE its supplier locks. Points and coupon
-- wrappers acquire the same reentrant attempt lock, preventing lock inversion.
alter function public.pth_insert_checkout(text,jsonb) rename to insert_checkout_before_bindings;
alter function public.insert_checkout_before_bindings(text,jsonb) set schema pth_customers;
revoke all on function pth_customers.insert_checkout_before_bindings(text,jsonb) from public,anon,authenticated;
grant execute on function pth_customers.insert_checkout_before_bindings(text,jsonb) to service_role;
create or replace function public.pth_insert_checkout(p_table text,p_rows jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare phone text; attempt text;
begin
 if current_user<>'service_role' then raise sqlstate '42501' using message='Inserción reservada al servidor';end if;
 if p_table is null or p_table not in ('pedidos','pedidos_subgestores')
  or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 30
 then raise exception 'Lote no válido';end if;
 attempt:=p_rows->0->>'submission_token';
 perform pg_advisory_xact_lock(hashtextextended('checkout-insert:'||split_part(attempt,'.',5),0));
 for phone in select distinct pth_customers.canonical_phone(value->>'telefono')
  from jsonb_array_elements(p_rows) where pth_customers.canonical_phone(value->>'telefono') is not null order by 1
 loop perform pg_advisory_xact_lock(hashtextextended('customer-binding:'||phone,0));end loop;
 return pth_customers.insert_checkout_before_bindings(p_table,p_rows);
end;$$;
revoke all on function public.pth_insert_checkout(text,jsonb) from public,anon,authenticated;
grant execute on function public.pth_insert_checkout(text,jsonb) to service_role;

-- Points normally fences product rules before delegating to order insertion.
-- Acquire phones outside that unchanged implementation too; coupons already
-- hold phones before entering it, so products must never precede phone locks.
alter function public.pth_insert_checkout_points(text,jsonb,jsonb,jsonb) rename to insert_checkout_points_before_bindings;
alter function public.insert_checkout_points_before_bindings(text,jsonb,jsonb,jsonb) set schema pth_customers;
revoke all on function pth_customers.insert_checkout_points_before_bindings(text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function pth_customers.insert_checkout_points_before_bindings(text,jsonb,jsonb,jsonb) to service_role;
create or replace function public.pth_insert_checkout_points(p_table text,p_rows jsonb,p_captures jsonb,p_tariff jsonb default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare phone text; attempt text;
begin
 if current_user<>'service_role' then raise sqlstate '42501' using message='Inserción reservada al servidor';end if;
 if p_table is null or p_table not in ('pedidos','pedidos_subgestores')
  or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 30
 then raise exception 'Lote no válido';end if;
 attempt:=p_rows->0->>'submission_token';
 perform pg_advisory_xact_lock(hashtextextended('checkout-insert:'||split_part(attempt,'.',5),0));
 for phone in select distinct pth_customers.canonical_phone(value->>'telefono')
  from jsonb_array_elements(p_rows) where pth_customers.canonical_phone(value->>'telefono') is not null order by 1
 loop perform pg_advisory_xact_lock(hashtextextended('customer-binding:'||phone,0));end loop;
 return pth_customers.insert_checkout_points_before_bindings(p_table,p_rows,p_captures,p_tariff);
end;$$;
revoke all on function public.pth_insert_checkout_points(text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.pth_insert_checkout_points(text,jsonb,jsonb,jsonb) to service_role;

create or replace function pth_customers.bind_confirmed_order()
returns trigger language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare
 v_phone text; seller public.gestores%rowtype; parent public.gestores%rowtype;
 source public.pedidos_subgestores%rowtype; confirmation pth_customers.confirmed_orders%rowtype;
 owner_name text; owner_count integer; occurred timestamptz; activity text; source_json jsonb;
begin
 v_phone:=pth_customers.canonical_phone(new.telefono);
 -- No-code checkout keeps its existing validation, including historical phones.
 if v_phone is null then return new;end if;
 source_json:=to_jsonb(new);
 if tg_table_name='pedidos' and nullif(btrim(coalesce(source_json->>'subgestor_nombre','')),'') is null
  and nullif(btrim(coalesce(source_json->>'gestor','')),'') is null then return new;end if;
 if tg_table_name='pedidos' and coalesce(source_json->>'gestor','') in ('Venta Directa','Directo')
  and nullif(btrim(coalesce(source_json->>'subgestor_nombre','')),'') is null then return new;end if;
 if current_user<>'service_role' then raise sqlstate '42501' using message='Asignación reservada al servidor';end if;
 perform pg_advisory_xact_lock(hashtextextended('customer-binding:'||v_phone,0));
 if tg_table_name='pedidos_subgestores' then
  select * into seller from public.gestores where id=new.subgestor_id;
  if not found or seller.nombre is distinct from new.subgestor_nombre or seller.parent_id is distinct from new.parent_gestor_id then
   raise exception 'Subgestor no válido';end if;
  select * into parent from public.gestores where id=seller.parent_id;
  if not found or parent.nombre is distinct from new.parent_gestor_nombre or parent.parent_id is not null
   or parent.estado is distinct from 'activo' or parent.activo=false then raise exception 'Gestor principal no válido';end if;
 elsif nullif(btrim(coalesce(source_json->>'subgestor_nombre','')),'') is not null then
  -- Approval transfers the SAME confirmed child order. Resolve the child using
  -- its still-present source, never the commission-recipient parent name.
  select * into source from public.pedidos_subgestores where id=new.id;
  if not found or pth_customers.canonical_phone(source.telefono) is distinct from v_phone
   or source.parent_gestor_nombre is distinct from new.gestor or source.subgestor_nombre is distinct from new.subgestor_nombre
   or source.submission_token is distinct from new.submission_token
   or source.orden_dia is distinct from new.orden_dia or source.proveedor is distinct from new.proveedor
  then raise exception 'Pedido de subgestor no verificable';end if;
  select * into confirmation from pth_customers.confirmed_orders where order_id=new.id;
  if found and (confirmation.source_table<>'pedidos_subgestores'
   or confirmation.seller_id is distinct from source.subgestor_id
   or confirmation.seller_name is distinct from source.subgestor_nombre
   or confirmation.parent_id is distinct from source.parent_gestor_id
   or confirmation.parent_name is distinct from source.parent_gestor_nombre)
  then raise exception 'La confirmación del subgestor no coincide con el pedido';end if;
  -- Approval copies an already accepted source; it is not another purchase.
  -- Neither current profile changes nor editable delivery details can transfer
  -- ownership, change its purchase history or append another binding event.
  -- Legacy pending orders have no private proof: preserve their existing review
  -- path without backfilling assignments or trusting the old public audit.
  return new;
 else
  if (select count(*) from public.gestores where nombre=new.gestor and parent_id is null)<>1 then raise exception 'Vendedor no válido';end if;
  select * into seller from public.gestores where nombre=new.gestor and parent_id is null;
 end if;
 if seller.estado is distinct from 'activo' or seller.activo=false or lower(coalesce(seller.rol,'')) in ('mensajero','logistica')
 then raise exception 'Vendedor no activo';end if;
 if exists(select 1 from pth_customers.confirmed_orders where order_id=new.id)
 then raise exception 'El pedido ya tiene una confirmación de asignación';end if;
 select count(distinct agent_name),min(agent_name)
  into owner_count,owner_name from public.customer_bindings b where pth_customers.canonical_phone(b.phone)=v_phone;
 if owner_count>1 then raise exception 'Asignaciones contradictorias del cliente';end if;
 occurred:=clock_timestamp();
 activity:=case when owner_count=0 then 'primera_compra' else 'compra_recurrente' end;
 if owner_count=0 then
  owner_name:=seller.nombre;
  insert into public.customer_bindings(phone,agent_name,protected_until,last_activity_at,last_activity_type,last_purchase_at,last_order_id,updated_at)
   values(v_phone,owner_name,null,occurred,activity,occurred,new.id::text,occurred);
  insert into pth_customers.binding_owners(phone,owner_id,created_at) values(v_phone,seller.id,occurred);
 else
  -- Never transfer permanent ownership or rewrite historical phone spellings.
  update public.customer_bindings b set last_activity_at=occurred,last_activity_type=activity,
   last_purchase_at=occurred,last_order_id=new.id::text,updated_at=occurred
   where pth_customers.canonical_phone(b.phone)=v_phone;
 end if;
 insert into public.customer_binding_events(phone,agent_name,event_type,order_id,occurred_at,protected_until,metadata)
  values(v_phone,owner_name,activity,new.id::text,occurred,null,
   jsonb_build_object('closing_agent',seller.nombre,'seller_id',seller.id,'source_table',tg_table_name));
 insert into pth_customers.confirmed_orders(order_id,phone,seller_id,seller_name,parent_id,parent_name,source_table,confirmed_at)
  values(new.id,v_phone,seller.id,seller.nombre,parent.id,parent.nombre,tg_table_name,occurred);
 return new;
end;$$;
revoke all on function pth_customers.bind_confirmed_order() from public,anon,authenticated;
grant execute on function pth_customers.bind_confirmed_order() to service_role;
create trigger pth_bind_confirmed_order after insert on public.pedidos for each row execute function pth_customers.bind_confirmed_order();
create trigger pth_bind_confirmed_child_order after insert on public.pedidos_subgestores for each row execute function pth_customers.bind_confirmed_order();

create or replace function public.pth_customer_binding(p_actor_id uuid,p_phone text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare actor public.gestores%rowtype; v_phone text; owner_name text; owner_count integer;
 owner_id uuid; legacy_count integer; legacy_id text; occurred timestamptz; is_admin boolean;
begin
 if current_user<>'service_role' then raise sqlstate '42501' using message='Operación reservada al servidor';end if;
 select * into actor from public.gestores where id=p_actor_id;
 if not found or actor.estado is distinct from 'activo' or actor.activo=false
  or lower(coalesce(actor.rol,'')) in ('mensajero','logistica')
 then raise sqlstate '42501' using message='Cuenta no autorizada';end if;
 if actor.parent_id is not null and not exists(select 1 from public.gestores p where p.id=actor.parent_id
  and p.parent_id is null and p.estado='activo' and p.activo is distinct from false)
 then raise sqlstate '42501' using message='Cuenta principal no activa';end if;
 is_admin:=actor.parent_id is null and lower(coalesce(actor.rol,'')) in ('admin','administrador','superadmin');
 v_phone:=pth_customers.canonical_phone(p_phone);
 if v_phone is null then raise sqlstate '22023' using message='Teléfono no válido';end if;
 perform pg_advisory_xact_lock(hashtextextended('customer-binding:'||v_phone,0));
 select count(distinct agent_name),min(agent_name) into owner_count,owner_name
  from public.customer_bindings b where pth_customers.canonical_phone(b.phone)=v_phone;
 if owner_count>1 then raise exception 'Asignaciones contradictorias del cliente';end if;
 if owner_count<>1
 then raise sqlstate '42501' using message='Cliente no autorizado';end if;
 if not is_admin then
  select b.owner_id into owner_id from pth_customers.binding_owners b where b.phone=v_phone;
  if found then
   if owner_id is distinct from actor.id then raise sqlstate '42501' using message='Cliente no autorizado';end if;
  else
   -- Legacy display names prove identity only when globally unambiguous.
   -- Include inactive accounts and every team, not just active team members.
   select count(distinct g.id),min(g.id::text) into legacy_count,legacy_id
    from public.gestores g where g.nombre=owner_name or g.id::text=owner_name;
   if legacy_count<>1 or legacy_id is distinct from actor.id::text
   then raise sqlstate '42501' using message='Cliente no autorizado';end if;
  end if;
 end if;
 occurred:=clock_timestamp();
 update public.customer_bindings b set last_activity_at=occurred,last_activity_type='seguimiento_registrado',updated_at=occurred
  where pth_customers.canonical_phone(b.phone)=v_phone;
 insert into public.customer_binding_events(phone,agent_name,event_type,occurred_at,protected_until,metadata)
  values(v_phone,owner_name,'seguimiento_registrado',occurred,null,jsonb_build_object('actor_id',actor.id));
 return jsonb_build_object('renewed',true,'phone',v_phone,'activityAt',occurred);
end;$$;
revoke all on function public.pth_customer_binding(uuid,text) from public,anon,authenticated;
grant execute on function public.pth_customer_binding(uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
