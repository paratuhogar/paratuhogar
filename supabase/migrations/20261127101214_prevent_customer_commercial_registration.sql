-- New applications only. Never rewrite old accounts, orders or bindings.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Share the established Cuban key with checkout/customer-binding locks.
-- Preserve international applications without introducing Cuba-only validation.
create function pth_customers.registration_phone(p_phone text)
returns text language sql immutable strict parallel safe security invoker
set search_path = pg_catalog as $$
 select coalesce(pth_customers.canonical_phone(p_phone),
   nullif(regexp_replace(regexp_replace(p_phone,'[^0-9]','','g'),'^00',''),''));
$$;
revoke all on function pth_customers.registration_phone(text) from public,anon,authenticated;
grant execute on function pth_customers.registration_phone(text) to service_role;

-- A rejected child request is not a sale. Unknown/pending states remain eligible
-- evidence, so a legacy null status cannot bypass the registration restriction.
create index pedidos_registration_buyer_phone on public.pedidos
 (pth_customers.registration_phone(telefono))
 where lower(btrim(coalesce(estado,''))) not in ('cancelado','rechazado');
create index pedidos_subgestores_registration_buyer_phone on public.pedidos_subgestores
 (pth_customers.registration_phone(telefono))
 where lower(btrim(coalesce(estado,''))) not in ('cancelado','rechazado');

-- Normal checkout already holds this lock before products/numbering. Fence raw
-- direct/admin writes and state/phone corrections too; never modify order data.
create function pth_customers.lock_registration_phone()
returns trigger language plpgsql security invoker
set search_path = pg_catalog,pg_temp as $$
declare phone text; old_phone text;
begin
 if tg_op='UPDATE' then old_phone:=pth_customers.registration_phone(old.telefono);end if;
 for phone in
   select distinct p from unnest(array[old_phone,pth_customers.registration_phone(new.telefono)]) p
   where p is not null order by p
 loop
   perform pg_advisory_xact_lock(hashtextextended('customer-binding:'||phone,0));
 end loop;
 return new;
end;
$$;
revoke all on function pth_customers.lock_registration_phone() from public,anon,authenticated;
grant execute on function pth_customers.lock_registration_phone() to service_role;
create trigger pth_lock_registration_phone before insert or update of telefono,estado
 on public.pedidos for each row execute function pth_customers.lock_registration_phone();
create trigger pth_lock_registration_phone before insert or update of telefono,estado
 on public.pedidos_subgestores for each row execute function pth_customers.lock_registration_phone();

create function pth_customers.guard_new_commercial_account()
returns trigger language plpgsql volatile security invoker
set search_path = pg_catalog,pg_temp as $$
declare phone text;
begin
 -- Existing accounts (including same-ID administrative upserts) are untouched.
 if new.id is not null and exists(select 1 from public.gestores where id=new.id) then return new;end if;
 if new.parent_id is null and lower(coalesce(new.rol,''))='mensajero' then return new;end if;
 phone:=pth_customers.registration_phone(new.telefono);
 if phone is null then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('customer-binding:'||phone,0));
 -- Volatile/read-committed queries get a fresh snapshot after any competing
 -- purchase commits. Registration-first keeps an account that already exists.
 if exists(select 1 from public.pedidos
   where pth_customers.registration_phone(telefono)=phone
     and lower(btrim(coalesce(estado,''))) not in ('cancelado','rechazado'))
 or exists(select 1 from public.pedidos_subgestores
   where pth_customers.registration_phone(telefono)=phone
     and lower(btrim(coalesce(estado,''))) not in ('cancelado','rechazado')) then
   raise sqlstate 'PT409' using message=
     'No se puede solicitar una cuenta comercial con este teléfono. Contacta con administración.';
 end if;
 return new;
end;
$$;
revoke all on function pth_customers.guard_new_commercial_account() from public,anon,authenticated;
grant execute on function pth_customers.guard_new_commercial_account() to service_role;
create trigger pth_guard_new_commercial_account before insert on public.gestores
 for each row execute function pth_customers.guard_new_commercial_account();
commit;
