-- Forward-only cutover. Existing captures, pending obligations and immutable
-- movements are untouched. Deploy the channel-aware gateway before this file.
-- No browser role receives permissions, and no order/financial fields change.
create or replace function pth_points.capture_order(p_source text,p_order jsonb,p_capture jsonb)
returns void language plpgsql security invoker set search_path=pg_catalog as $$
declare v_id uuid; v_beneficiary uuid; v_line jsonb; v_product jsonb; v_rule pth_points.rules%rowtype;
 v_lines jsonb:='[]'; v_points integer; v_quantity integer; v_total bigint:=0; v_issue text;
 v_order_id uuid:=(p_order->>'id')::uuid;
begin
 if exists(select 1 from pth_points.captures where order_id=v_order_id) then return;end if;
 if not exists(select 1 from pth_points.config where enabled and started_at<=clock_timestamp()) then return;end if;
 -- Only the gateway supplies this field after resolving an unauthenticated
 -- customer's seller. Manual, direct and unknown/old gateway channels earn no
 -- automatic points and create no misleading pending balance or issue.
 if p_capture->>'sales_channel' is distinct from 'referral_link' then return;end if;
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

create or replace function public.pth_insert_checkout_points(p_table text,p_rows jsonb,p_captures jsonb,p_tariff jsonb default null)
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
 perform pg_advisory_xact_lock(hashtextextended('checkout-insert:'||split_part(p_rows->0->>'submission_token','.',5),0));
 select coalesce(array_agg(id),'{}'::uuid[]) into v_existing from (
  select id from public.pedidos where id in(select (r->>'id')::uuid from jsonb_array_elements(p_rows) r)
  union select id from public.pedidos_subgestores where id in(select (r->>'id')::uuid from jsonb_array_elements(p_rows) r)
 ) x;
 for v_capture in select value from jsonb_array_elements(p_captures) loop
  select * into v_stored from pth_points.captures where order_id=(v_capture->>'pedido_id')::uuid;
  -- A pre-cutover capture has no sales_channel. Ignore only that newly-added
  -- field on its receipt retry, without modifying the immutable snapshot.
  -- All original data, and every recorded post-cutover channel, must match.
  if found and ((v_stored.request_snapshot-'sales_channel') is distinct from (v_capture-'sales_channel')
   or (v_stored.request_snapshot?'sales_channel'
    and v_stored.request_snapshot->'sales_channel' is distinct from v_capture->'sales_channel'))
  then raise exception 'La captura no coincide con la solicitud original';end if;
 end loop;
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
