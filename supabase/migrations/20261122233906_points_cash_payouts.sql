-- Local preparation only. Intake begins disabled; no real payouts or balances.
begin;
create table pth_points.cash_config (
 singleton boolean primary key default true check(singleton), enabled boolean not null default false
);
insert into pth_points.cash_config(singleton) values(true);
create table pth_points.cash_payouts (
 id uuid primary key default gen_random_uuid(), beneficiary_id uuid not null,
 usd integer not null check(usd between 1 and 715827882),
 points bigint not null check(points=usd::bigint*3),
 state text not null default 'requested' check(state in ('requested','approved','in_payment','paid','rejected','cancelled','refunded')),
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 claimed_by uuid, payment_method text check(payment_method in ('efectivo','transferencia','otro')),
 payment_reference text check(length(btrim(payment_reference)) between 1 and 200), paid_at timestamptz,
 reason text check(length(btrim(reason)) between 1 and 1000),
 check((state in ('in_payment','paid','refunded'))=(claimed_by is not null)),
 check((state in ('paid','refunded'))=(payment_method is not null and payment_reference is not null and paid_at is not null)),
 check(state in ('paid','refunded') or (payment_method is null and payment_reference is null and paid_at is null))
);
create index points_cash_account on pth_points.cash_payouts(beneficiary_id,created_at desc,id desc);
create index points_cash_state on pth_points.cash_payouts(state,created_at desc,id desc);
create index points_cash_claim on pth_points.cash_payouts(claimed_by) where claimed_by is not null;
create table pth_points.cash_events (
 id uuid primary key default gen_random_uuid(), payout_id uuid not null references pth_points.cash_payouts(id),
 operation text not null, state text not null, revision integer not null,
 actor_id uuid, reason text, reference text, created_at timestamptz not null default clock_timestamp(),
 unique(payout_id,revision)
);
create table pth_points.cash_entries (
 id uuid primary key default gen_random_uuid(), payout_id uuid not null references pth_points.cash_payouts(id),
 beneficiary_id uuid not null, kind text not null check(kind in ('payment','refund')),
 usd integer not null, points bigint not null check(points=usd::bigint*3),
 actor_id uuid not null, reference text not null check(length(btrim(reference)) between 1 and 200),
 created_at timestamptz not null default clock_timestamp(), unique(payout_id,kind),
 check((kind='payment' and points>0) or (kind='refund' and points<0))
);
create index points_cash_entries_account on pth_points.cash_entries(beneficiary_id,created_at desc,id desc);
create table pth_points.cash_operations (
 request_key text primary key check(request_key~'^[a-f0-9]{64}$'), actor_id uuid not null,
 operation text not null, payload jsonb not null, response jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
create trigger points_cash_events_immutable before update or delete or truncate on pth_points.cash_events
 for each statement execute function pth_points.immutable();
create trigger points_cash_entries_immutable before update or delete or truncate on pth_points.cash_entries
 for each statement execute function pth_points.immutable();
create trigger points_cash_operations_immutable before update or delete or truncate on pth_points.cash_operations
 for each statement execute function pth_points.immutable();
create trigger points_cash_payouts_no_delete before delete or truncate on pth_points.cash_payouts
 for each statement execute function pth_points.immutable();

create function pth_points.cash_payout_guard() returns trigger language plpgsql security invoker
set search_path=pg_catalog as $$
begin
 if tg_op='INSERT' then
  if new.state<>'requested' or new.revision<>1 then raise sqlstate 'PT400' using message='Solicitud inicial no válida';end if;
 else
  if (new.id,new.beneficiary_id,new.usd,new.points,new.created_at) is distinct from
   (old.id,old.beneficiary_id,old.usd,old.points,old.created_at) or new.revision<>old.revision+1
   then raise sqlstate 'PT400' using message='Los importes y el titular son inmutables';end if;
  if not ((old.state='requested' and new.state in ('approved','rejected','cancelled'))
   or (old.state='approved' and new.state in ('in_payment','cancelled'))
   or (old.state='in_payment' and new.state in ('approved','paid'))
   or (old.state='paid' and new.state='refunded'))
   then raise sqlstate 'PT409' using message='Transición de cobro no válida';end if;
  if old.state in ('paid','refunded') and (new.payment_method,new.payment_reference,new.paid_at,new.claimed_by)
   is distinct from (old.payment_method,old.payment_reference,old.paid_at,old.claimed_by)
   then raise sqlstate 'PT400' using message='La constancia original del pago es inmutable';end if;
  new.updated_at:=clock_timestamp();
 end if;
 return new;
end;$$;
create trigger points_cash_guard before insert or update on pth_points.cash_payouts
 for each row execute function pth_points.cash_payout_guard();

create function pth_points.cash_book_guard() returns trigger language plpgsql security invoker
set search_path=pg_catalog as $$
declare r pth_points.cash_payouts%rowtype;
begin
 select * into strict r from pth_points.cash_payouts where id=new.payout_id;
 if tg_table_name='cash_events' then
  if new.state<>r.state or new.revision<>r.revision then raise sqlstate 'PT400' using message='Auditoría no coincide con solicitud';end if;
 else
  if new.beneficiary_id<>r.beneficiary_id or abs(new.points)<>r.points or abs(new.usd)<>r.usd
   or new.kind='payment' and (r.state<>'paid' or new.actor_id<>r.claimed_by or new.reference<>r.payment_reference)
   or new.kind='refund' and (r.state<>'refunded' or not exists(select 1 from pth_points.cash_entries where payout_id=r.id and kind='payment'))
   then raise sqlstate 'PT400' using message='Contrapartida de cobro no válida';end if;
 end if;
 return new;
end;$$;
create trigger points_cash_event_guard before insert on pth_points.cash_events
 for each row execute function pth_points.cash_book_guard();
create trigger points_cash_entry_guard before insert on pth_points.cash_entries
 for each row execute function pth_points.cash_book_guard();

create function pth_points.cash_complete_guard() returns trigger language plpgsql security invoker
set search_path=pg_catalog as $$
begin
 if not exists(select 1 from pth_points.cash_events where payout_id=new.id and revision=new.revision and state=new.state)
  then raise sqlstate 'PT400' using message='Falta auditoría de solicitud';end if;
 if new.state in ('paid','refunded') and not exists(select 1 from pth_points.cash_entries where payout_id=new.id and kind='payment')
  or new.state='refunded' and not exists(select 1 from pth_points.cash_entries where payout_id=new.id and kind='refund')
  then raise sqlstate 'PT400' using message='Falta registro financiero del cobro';end if;
 return null;
end;$$;
create constraint trigger points_cash_complete after insert or update on pth_points.cash_payouts
 deferrable initially deferred for each row execute function pth_points.cash_complete_guard();

create function pth_points.cash_request_json(p_id uuid) returns jsonb language sql security invoker
set search_path=pg_catalog as $$
 select jsonb_build_object('id',r.id,'beneficiaryId',r.beneficiary_id,'beneficiaryName',coalesce(g.nombre,'Cuenta sin identificar'),
 'usd',r.usd,'points',r.points,'state',r.state,'revision',r.revision,'createdAt',r.created_at,'updatedAt',r.updated_at,
 'claimedBy',r.claimed_by,'claimedByName',case when r.claimed_by is not null then coalesce(a.nombre,'Cuenta sin identificar') end,'paymentMethod',r.payment_method,
 'paymentReference',r.payment_reference,'paidAt',r.paid_at,'reason',r.reason)
 from pth_points.cash_payouts r left join public.gestores g on g.id=r.beneficiary_id
 left join public.gestores a on a.id=r.claimed_by where r.id=p_id;
$$;

create function pth_points.cash_snapshot(p_beneficiary uuid) returns jsonb language plpgsql security invoker
set search_path=pg_catalog as $$
declare ids uuid[]; earned bigint; spent bigint; dollars bigint; held bigint; active_hold bigint; r record;
begin
 -- Only cash operations take this account lock. Existing sale/capture locks
 -- stay unchanged, avoiding order->capture->account inversions during bulk edits.
 perform pg_advisory_xact_lock(hashtextextended('points-cash-account:'||p_beneficiary::text,0));
 -- Exact-reversal FK checks take KEY SHARE on the positive movement. UPDATE
 -- locks fence those debits without changing the immutable earnings book.
 -- NOWAIT is essential: a bulk reversal may hold credit keys in another order.
 select coalesce(array_agg(id),'{}'::uuid[]) into ids from
  (select id from pth_points.movements where beneficiary_id=p_beneficiary and points>0 order by id for update nowait) locked;
 -- Exclude positive credits committed after the lock scan; they weren't fenced.
 select coalesce(sum(points),0) into earned from pth_points.movements where id=any(ids) or reversal_of=any(ids);
 select coalesce(sum(points),0),coalesce(sum(usd),0) into spent,dollars from pth_points.cash_entries where beneficiary_id=p_beneficiary;
 select coalesce(sum(points),0) into held from pth_points.cash_payouts
  where beneficiary_id=p_beneficiary and state in ('requested','approved','in_payment');
 for r in select * from pth_points.cash_payouts where beneficiary_id=p_beneficiary
  and state in ('requested','approved') order by created_at desc,id desc loop
  exit when held<=greatest(earned-spent,0);
  update pth_points.cash_payouts set state='cancelled',revision=revision+1,
   reason='Los puntos que respaldaban esta solicitud se revirtieron.' where id=r.id;
  insert into pth_points.cash_events(payout_id,operation,state,revision,reason)
   values(r.id,'backing_reversed','cancelled',r.revision+1,'Los puntos que respaldaban esta solicitud se revirtieron.');
  held:=held-r.points;
 end loop;
 select coalesce(sum(points),0) into active_hold from pth_points.cash_payouts
  where beneficiary_id=p_beneficiary and state='in_payment';
 return jsonb_build_object('beneficiary',(select jsonb_build_object('id',id,'name',coalesce(nombre,'Cuenta sin identificar')) from public.gestores where id=p_beneficiary),
  'enabled',(select enabled from pth_points.cash_config where singleton),'rate',3,'earnedConfirmed',earned,
  'available',greatest(earned-spent-held,0),'reserved',held,'redeemedPoints',spent,'paidUsd',dollars,
  'deficit',greatest(spent+active_hold-earned,0));
end;$$;

create function public.pth_points_cash(p_actor_id uuid,p_operation text,p_body jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare a public.gestores%rowtype; adm boolean; target uuid; r pth_points.cash_payouts%rowtype;
 previous pth_points.cash_operations%rowtype; k text; allowed text[]; mutating boolean;
 snap jsonb; result jsonb; page jsonb; amount integer; v_reason text; v_reference text;
 offset_n integer:=0; state_filter text; search_text text; v_method text; account_ids uuid[]; account uuid;
 checked_accounts uuid[]:='{}'::uuid[];
begin
 select * into a from public.gestores where id=p_actor_id;
 if not found or a.estado is distinct from 'activo' or a.activo is false
  or lower(coalesce(a.rol,'')) not in ('gestor','subgestor','admin','administrador','superadmin')
  then raise sqlstate 'PT403' using message='Cuenta no autorizada para cobros';end if;
 adm:=a.parent_id is null and lower(a.rol) in ('admin','administrador','superadmin');
 if jsonb_typeof(p_body) is distinct from 'object' or p_operation is null then raise sqlstate 'PT400' using message='Operación no válida';end if;
 allowed:=case p_operation
  when 'summary' then array['beneficiaryId'] when 'list' then array['beneficiaryId','state','search','offset']
  when 'detail' then array['requestId','offset'] when 'request' then array['usd','idempotencyKey']
  when 'approve' then array['requestId','revision','idempotencyKey'] when 'start_payment' then array['requestId','revision','idempotencyKey']
  when 'reject' then array['requestId','revision','reason','idempotencyKey'] when 'cancel' then array['requestId','revision','reason','idempotencyKey']
  when 'record_payment' then array['requestId','revision','usd','method','reference','confirmPaid','idempotencyKey']
  when 'release_payment' then array['requestId','revision','reason','reference','confirmNotPaid','idempotencyKey']
  when 'refund' then array['requestId','revision','usd','reason','reference','confirmReturned','idempotencyKey'] end;
 if allowed is null or exists(select 1 from jsonb_object_keys(p_body) x where not(x=any(allowed))) then raise sqlstate 'PT400' using message='Datos no válidos';end if;
 mutating:=p_operation not in ('summary','list','detail');
 if p_operation not in ('summary','list','detail','request','cancel') and not adm then raise sqlstate 'PT403' using message='Acción administrativa';end if;
 if p_body?'offset' then
  if jsonb_typeof(p_body->'offset')<>'number' or (p_body->>'offset')!~'^[0-9]{1,7}$' or (p_body->>'offset')::numeric>1000000 then raise sqlstate 'PT400' using message='Página no válida';end if;
  offset_n:=(p_body->>'offset')::integer;
 end if;
 if p_body?'search' and (jsonb_typeof(p_body->'search')<>'string' or length(p_body->>'search')>120) then raise sqlstate 'PT400' using message='Búsqueda no válida';end if;
 search_text:=btrim(coalesce(p_body->>'search',''));state_filter:=coalesce(p_body->>'state','all');
 if state_filter not in ('all','requested','approved','in_payment','paid','rejected','cancelled','refunded') then raise sqlstate 'PT400' using message='Estado no válido';end if;
 if mutating then
  k:=p_body->>'idempotencyKey';if coalesce(k,'')!~'^[a-f0-9]{64}$' then raise sqlstate 'PT400' using message='Clave de intento no válida';end if;
  perform pg_advisory_xact_lock(hashtextextended('points-cash-key:'||k,0));
  select * into previous from pth_points.cash_operations where request_key=k;
  if found then
   if previous.actor_id<>a.id or previous.operation<>p_operation or previous.payload<>p_body then raise sqlstate 'PT409' using message='Intento ya utilizado';end if;
   return previous.response;
  end if;
 end if;
 if p_operation in ('summary','list') then
  target:=(p_body->>'beneficiaryId')::uuid;
  if not adm then
   if target is not null and target<>a.id then raise sqlstate 'PT403' using message='Solo tu billetera';end if;
   target:=a.id;
  elsif p_operation='summary' then target:=coalesce(target,a.id);
  end if;
  if target is not null and not exists(select 1 from public.gestores where id=target) then raise sqlstate 'PT400' using message='Cuenta no válida';end if;
  if p_operation='summary' then return pth_points.cash_snapshot(target);end if;
  -- Cancelling unbacked claims can shift previously unseen accounts onto a
  -- filtered page. Reselect until every returned candidate was rebalanced.
  loop
   select array_agg(distinct beneficiary_id order by beneficiary_id) into account_ids from
    (select p.beneficiary_id from pth_points.cash_payouts p left join public.gestores g on g.id=p.beneficiary_id
     where (target is null or p.beneficiary_id=target) and (state_filter='all' or p.state=state_filter)
     and strpos(lower(coalesce(g.nombre,'')),lower(search_text))>0 order by p.created_at desc,p.id desc limit 51 offset offset_n) x
    where not(beneficiary_id=any(checked_accounts));
   exit when account_ids is null;
   foreach account in array account_ids loop
    -- The first account can wait: this RPC holds no other cash account/credit
    -- locks yet. Later batches need not be globally UUID-ordered, so never
    -- wait for another account while retaining the previous one's locks.
    if cardinality(checked_accounts)>0 then
     if not pg_try_advisory_xact_lock(hashtextextended('points-cash-account:'||account::text,0))
      then raise sqlstate '55P03' using message='Billetera en actualización';end if;
    end if;
    perform pth_points.cash_snapshot(account);
    checked_accounts:=array_append(checked_accounts,account);
   end loop;
  end loop;
  select coalesce(jsonb_agg(pth_points.cash_request_json(id) order by created_at desc,id desc),'[]') into page from
   (select p.id,p.created_at from pth_points.cash_payouts p left join public.gestores g on g.id=p.beneficiary_id
    where (target is null or p.beneficiary_id=target) and (state_filter='all' or p.state=state_filter)
    and strpos(lower(coalesce(g.nombre,'')),lower(search_text))>0 order by p.created_at desc,p.id desc limit 51 offset offset_n) x;
  return jsonb_build_object('rows',(select coalesce(jsonb_agg(value order by ordinality),'[]') from jsonb_array_elements(page) with ordinality where ordinality<=50),
   'nextOffset',case when jsonb_array_length(page)>50 then offset_n+50 end,
   'totals',(select jsonb_build_object('requestedUsd',coalesce(sum(usd) filter(where state='requested'),0),
    'approvedUsd',coalesce(sum(usd) filter(where state='approved'),0),'inPaymentUsd',coalesce(sum(usd) filter(where state='in_payment'),0),
    'paidUsd',coalesce(sum(usd) filter(where state='paid'),0)) from pth_points.cash_payouts p left join public.gestores g on g.id=p.beneficiary_id
    where (target is null or p.beneficiary_id=target) and strpos(lower(coalesce(g.nombre,'')),lower(search_text))>0));
 end if;
 if p_operation='request' then target:=a.id;
 else
  select * into r from pth_points.cash_payouts where id=(p_body->>'requestId')::uuid;
  if not found or (not adm and r.beneficiary_id<>a.id) then raise sqlstate 'PT403' using message='Solicitud no disponible';end if;
  target:=r.beneficiary_id;
 end if;
 snap:=pth_points.cash_snapshot(target);
 if p_operation='detail' then
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'operation',e.operation,'state',e.state,'revision',e.revision,
   'actorId',e.actor_id,'actorName',case when e.actor_id is not null then coalesce(g.nombre,'Cuenta sin identificar') end,'reason',e.reason,'reference',e.reference,'createdAt',e.created_at) order by e.revision),'[]') into page
   from (select * from pth_points.cash_events where payout_id=r.id order by revision limit 51 offset offset_n) e
   left join public.gestores g on g.id=e.actor_id;
  return jsonb_build_object('request',pth_points.cash_request_json(r.id),
   'events',(select coalesce(jsonb_agg(value order by ordinality),'[]') from jsonb_array_elements(page) with ordinality where ordinality<=50),
   'nextOffset',case when jsonb_array_length(page)>50 then offset_n+50 end);
 end if;
 if p_operation in ('request','record_payment','refund') then
  if jsonb_typeof(p_body->'usd') is distinct from 'number' or coalesce(p_body->>'usd','')!~'^[0-9]{1,9}$'
   or (p_body->>'usd')::numeric not between 1 and 715827882 then raise sqlstate 'PT400' using message='Indica USD enteros válidos';end if;
  amount:=(p_body->>'usd')::integer;
 end if;
 if p_operation in ('reject','cancel','release_payment','refund') then
  if jsonb_typeof(p_body->'reason') is distinct from 'string' or length(btrim(p_body->>'reason')) not between 1 and 1000 then raise sqlstate 'PT400' using message='Indica un motivo válido';end if;
  v_reason:=btrim(p_body->>'reason');
 end if;
 if p_operation in ('record_payment','release_payment','refund') then
  if jsonb_typeof(p_body->'reference') is distinct from 'string' or length(btrim(p_body->>'reference')) not between 1 and 200 then raise sqlstate 'PT400' using message='Indica constancia del pago o comprobación';end if;
  v_reference:=btrim(p_body->>'reference');
 end if;
 if p_operation='request' then
  if not (snap->>'enabled')::boolean then raise sqlstate 'PT503' using message='La solicitud de nuevos cobros está desactivada';end if;
  if amount::bigint*3>(snap->>'available')::bigint then raise sqlstate 'PT409' using message='Saldo de puntos insuficiente';end if;
  insert into pth_points.cash_payouts(beneficiary_id,usd,points) values(a.id,amount,amount::bigint*3) returning * into r;
 else
  select * into strict r from pth_points.cash_payouts where id=r.id for update;
  if jsonb_typeof(p_body->'revision') is distinct from 'number' or coalesce(p_body->>'revision','')!~'^[1-9][0-9]{0,9}$'
   or (p_body->>'revision')::numeric<>r.revision then raise sqlstate 'PT409' using message='La solicitud cambió; actualiza su estado';end if;
  if p_operation='approve' then
   if r.state<>'requested' then raise sqlstate 'PT409' using message='Solicitud no aprobable';end if;
   update pth_points.cash_payouts set state='approved',revision=revision+1,reason=null where id=r.id returning * into r;
  elsif p_operation='start_payment' then
   if r.state<>'approved' then raise sqlstate 'PT409' using message='Solicitud no disponible para pago';end if;
   update pth_points.cash_payouts set state='in_payment',claimed_by=a.id,revision=revision+1,reason=null where id=r.id returning * into r;
  elsif p_operation in ('reject','cancel') then
   if p_operation='reject' and r.state<>'requested' or p_operation='cancel' and
    (r.state not in ('requested','approved') or (not adm and r.state<>'requested')) then raise sqlstate 'PT409' using message='No se puede liberar esta reserva';end if;
   update pth_points.cash_payouts set state=case when p_operation='reject' then 'rejected' else 'cancelled' end,
    revision=revision+1,reason=v_reason where id=r.id returning * into r;
  elsif p_operation='record_payment' then
   v_method:=p_body->>'method';
   if r.state<>'in_payment' or r.claimed_by<>a.id then raise sqlstate 'PT403' using message='El pago pertenece a otro administrador o estado';end if;
   if amount<>r.usd or p_body->'confirmPaid' is distinct from 'true'::jsonb or coalesce(v_method,'') not in ('efectivo','transferencia','otro') then raise sqlstate 'PT400' using message='Confirma el pago real y completo';end if;
   update pth_points.cash_payouts set state='paid',revision=revision+1,payment_method=v_method,payment_reference=v_reference,paid_at=clock_timestamp(),reason=null where id=r.id returning * into r;
   insert into pth_points.cash_entries(payout_id,beneficiary_id,kind,usd,points,actor_id,reference) values(r.id,r.beneficiary_id,'payment',r.usd,r.points,a.id,v_reference);
  elsif p_operation='release_payment' then
   if r.state<>'in_payment' or p_body->'confirmNotPaid' is distinct from 'true'::jsonb then raise sqlstate 'PT409' using message='Comprueba primero que no se pagó';end if;
   update pth_points.cash_payouts set state='approved',revision=revision+1,claimed_by=null,reason=v_reason where id=r.id returning * into r;
  elsif p_operation='refund' then
   if r.state<>'paid' or amount<>r.usd or p_body->'confirmReturned' is distinct from 'true'::jsonb then raise sqlstate 'PT409' using message='Confirma la devolución íntegra del dinero';end if;
   update pth_points.cash_payouts set state='refunded',revision=revision+1,reason=v_reason where id=r.id returning * into r;
   insert into pth_points.cash_entries(payout_id,beneficiary_id,kind,usd,points,actor_id,reference) values(r.id,r.beneficiary_id,'refund',-r.usd,-r.points,a.id,v_reference);
  end if;
 end if;
 insert into pth_points.cash_events(payout_id,operation,state,revision,actor_id,reason,reference)
  values(r.id,p_operation,r.state,r.revision,a.id,v_reason,v_reference);
 result:=jsonb_build_object('request',pth_points.cash_request_json(r.id));
 insert into pth_points.cash_operations(request_key,actor_id,operation,payload,response) values(k,a.id,p_operation,p_body,result);
 return result;
end;$$;

do $$declare t text;begin
 foreach t in array array['cash_config','cash_payouts','cash_events','cash_entries','cash_operations'] loop
  execute format('alter table pth_points.%I enable row level security',t);
  execute format('revoke all on table pth_points.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on table pth_points.%I to service_role',t);
 end loop;
end$$;
grant insert on pth_points.cash_payouts,pth_points.cash_events,pth_points.cash_entries,pth_points.cash_operations to service_role;
grant update on pth_points.cash_payouts to service_role;
-- SELECT FOR UPDATE requires UPDATE permission, but the existing immutable
-- statement trigger still rejects all actual UPDATEs, even of id alone.
grant update(id) on pth_points.movements to service_role;
revoke all on function pth_points.cash_payout_guard(),pth_points.cash_book_guard(),pth_points.cash_complete_guard(),
 pth_points.cash_request_json(uuid),pth_points.cash_snapshot(uuid) from public,anon,authenticated;
grant execute on function pth_points.cash_payout_guard(),pth_points.cash_book_guard(),pth_points.cash_complete_guard(),
 pth_points.cash_request_json(uuid),pth_points.cash_snapshot(uuid) to service_role;
revoke all on function public.pth_points_cash(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.pth_points_cash(uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
