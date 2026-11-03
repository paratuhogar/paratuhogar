-- Activate before the new gateway. Does not edit historical orders or counters.
begin;
grant usage on schema pth_private to service_role;
grant select,insert,update on pth_private.pedido_consecutivos to service_role;

create or replace function public.pth_insert_checkout(p_table text,p_rows jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
 item jsonb; k text; attempt_key text; supplier text; next_number bigint;
 highest bigint; existing jsonb; answer jsonb:='[]'::jsonb; reference text;
 allowed text[]:=array['id','submission_token','proveedor','cliente','telefono','ci',
  'direccion','municipio','producto','total','costo_mensajeria','comision_total',
  'estado','garantia_venta','garantia_dias'];
begin
 if p_table is null or p_table not in ('pedidos','pedidos_subgestores')
  or jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Lote no válido';end if;
 if jsonb_array_length(p_rows) not between 1 and 30 then raise exception 'Lote no válido';end if;
 if p_table='pedidos' then allowed:=allowed||array['gestor','origen','pago_gestor'];
 else allowed:=allowed||array['subgestor_id','subgestor_nombre','parent_gestor_id','parent_gestor_nombre','comision_subgestor'];end if;
 attempt_key:=p_rows->0->>'submission_token';
 if attempt_key is null or length(attempt_key)>600 or attempt_key !~ '^pthn[12]\.'
 then raise exception 'Clave no válida';end if;
 for item in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(item) is distinct from 'object' then raise exception 'Fila no válida';end if;
  for k in select jsonb_object_keys(item) loop
   if not k=any(allowed) then raise exception 'Columna no válida';end if;
  end loop;
  if item->>'submission_token' is distinct from attempt_key or item->>'id' is null
   or item->>'proveedor' is null or upper(item->>'proveedor') !~ '^[A-Z0-9]{1,12}$'
  then raise exception 'Identidad no válida';end if;
  perform (item->>'id')::uuid;
 end loop;
 if (select count(distinct upper(value->>'proveedor')) from jsonb_array_elements(p_rows))<>jsonb_array_length(p_rows)
  or (select count(distinct value->>'id') from jsonb_array_elements(p_rows))<>jsonb_array_length(p_rows)
 then raise exception 'Lote repetido';end if;

 -- The nonce is stable for one draft, even if its signed payload was changed.
 perform pg_advisory_xact_lock(hashtextextended('checkout-insert:'||split_part(attempt_key,'.',5),0));
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'orden_dia',s.orden_dia,'proveedor',s.proveedor)),'[]'::jsonb)
 into existing from (
  select id,orden_dia,proveedor from public.pedidos where submission_token=attempt_key
  union all select id,orden_dia,proveedor from public.pedidos_subgestores where submission_token=attempt_key
 ) s;
 if jsonb_array_length(existing)>0 then
  if jsonb_array_length(existing)<>jsonb_array_length(p_rows) or exists(
   select 1 from jsonb_array_elements(p_rows) r where not exists(
    select 1 from jsonb_array_elements(existing) e where e->>'id'=r->>'id'
     and e->>'proveedor'=r->>'proveedor' and nullif(e->>'orden_dia','') is not null
   )
  ) then raise exception 'Resultado parcial o incompatible; revisa el recibo';end if;
  select jsonb_agg(e.value order by r.ordinality) into answer
   from jsonb_array_elements(p_rows) with ordinality r
   join jsonb_array_elements(existing) e on e.value->>'id'=r.value->>'id';
  return answer;
 end if;
 if exists(select 1 from public.pedidos where id in(select (value->>'id')::uuid from jsonb_array_elements(p_rows)))
  or exists(select 1 from public.pedidos_subgestores where id in(select (value->>'id')::uuid from jsonb_array_elements(p_rows)))
 then raise exception 'Identidad ya utilizada; revisa el recibo';end if;

 -- Same namespace as the legacy reservation, always sorted across a batch.
 for supplier in select upper(value->>'proveedor') from jsonb_array_elements(p_rows) order by 1 loop
  perform pg_advisory_xact_lock(hashtext('pedido-consecutivo:'||supplier));
 end loop;
 for item in select value from jsonb_array_elements(p_rows) loop
  supplier:=upper(item->>'proveedor');
  select coalesce(max(n),0) into highest from (
   select substring(trim(orden_dia) from '^[^-]+-([0-9]+)$')::bigint n from public.pedidos where upper(trim(proveedor))=supplier
   union all
   select substring(trim(orden_dia) from '^[^-]+-([0-9]+)$')::bigint n from public.pedidos_subgestores where upper(trim(proveedor))=supplier
  ) stored;
  insert into pth_private.pedido_consecutivos(proveedor,ultimo_numero) values(supplier,highest)
   on conflict(proveedor) do update set ultimo_numero=greatest(pedido_consecutivos.ultimo_numero,excluded.ultimo_numero);
  update pth_private.pedido_consecutivos set ultimo_numero=ultimo_numero+1,actualizado_en=now()
   where proveedor=supplier returning ultimo_numero into next_number;
  reference:=supplier||'-'||next_number;
  if p_table='pedidos' then
   insert into public.pedidos(id,submission_token,proveedor,cliente,telefono,ci,direccion,municipio,producto,
    total,costo_mensajeria,comision_total,estado,garantia_venta,garantia_dias,gestor,origen,pago_gestor,orden_dia)
   values((item->>'id')::uuid,attempt_key,item->>'proveedor',item->>'cliente',item->>'telefono',item->>'ci',
    item->>'direccion',item->>'municipio',item->>'producto',(item->>'total')::numeric,
    (item->>'costo_mensajeria')::numeric,(item->>'comision_total')::numeric,item->>'estado',
    item->>'garantia_venta',(item->>'garantia_dias')::integer,item->>'gestor',item->>'origen',item->>'pago_gestor',reference);
  else
   insert into public.pedidos_subgestores(id,submission_token,proveedor,cliente,telefono,ci,direccion,municipio,producto,
    total,costo_mensajeria,comision_total,estado,garantia_venta,garantia_dias,subgestor_id,subgestor_nombre,
    parent_gestor_id,parent_gestor_nombre,comision_subgestor,orden_dia)
   values((item->>'id')::uuid,attempt_key,item->>'proveedor',item->>'cliente',item->>'telefono',item->>'ci',
    item->>'direccion',item->>'municipio',item->>'producto',(item->>'total')::numeric,
    (item->>'costo_mensajeria')::numeric,(item->>'comision_total')::numeric,item->>'estado',
    item->>'garantia_venta',(item->>'garantia_dias')::integer,(item->>'subgestor_id')::uuid,item->>'subgestor_nombre',
    (item->>'parent_gestor_id')::uuid,item->>'parent_gestor_nombre',(item->>'comision_subgestor')::numeric,reference);
  end if;
  answer:=answer||jsonb_build_array(jsonb_build_object('id',item->>'id','orden_dia',reference,'proveedor',item->>'proveedor'));
 end loop;
 return answer;
end;
$$;
revoke all on function public.pth_insert_checkout(text,jsonb) from public,anon,authenticated;
grant execute on function public.pth_insert_checkout(text,jsonb) to service_role;
commit;
