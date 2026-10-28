-- Deploy before the gateway/UI. No historical orders are changed.
begin;
create table public.pth_subgestor_review_events (
 id uuid primary key default gen_random_uuid(),
 pedido_id uuid not null,
 decision text not null check(decision in ('edit','approve','reject')),
 actor_id uuid not null,
 actor_name text not null,
 parent_id uuid,
 reference text,
 reason text,
 snapshot jsonb not null,
 changes jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create unique index pth_subgestor_review_final on public.pth_subgestor_review_events(pedido_id) where decision in ('approve','reject');
create index pth_subgestor_review_recent on public.pth_subgestor_review_events(created_at desc,id);
alter table public.pth_subgestor_review_events enable row level security;
revoke all on public.pth_subgestor_review_events from public,anon,authenticated,service_role;
grant select,insert on public.pth_subgestor_review_events to service_role;

create function public.pth_review_subgestor(
 p_actor_id uuid,p_operation text,p_id uuid default null,p_expected text default null,
 p_changes jsonb default '{}'::jsonb,p_reason text default null,p_search text default '',p_offset integer default 0
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
 a public.gestores%rowtype; p public.pedidos_subgestores%rowtype;
 e public.pth_subgestor_review_events%rowtype;
 is_admin boolean; result jsonb; final_operation text; k text; v text;
begin
 select * into a from public.gestores where id=p_actor_id;
 if not found or a.parent_id is not null or a.estado is distinct from 'activo' or a.activo=false or lower(coalesce(a.rol,''))='mensajero' then raise exception 'Acceso no autorizado';end if;
 is_admin:=lower(coalesce(a.rol,'')) in ('admin','administrador','superadmin','logistica');
 if p_operation not in ('list','history','edit','approve','reject') or p_operation is null then raise exception 'Operación no válida';end if;
 if p_offset is null or p_offset<0 or p_offset>1000000 or length(coalesce(p_search,''))>120 then raise exception 'Consulta no válida';end if;
 if p_operation='history' then
  if not is_admin then raise exception 'Historial reservado a administración';end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (
   select ev.id,ev.pedido_id,ev.decision,ev.actor_name,ev.reference,ev.reason,ev.created_at,
    ev.snapshot->>'cliente' as cliente,ev.snapshot->>'parent_gestor_nombre' as parent_gestor_nombre,ev.snapshot->>'subgestor_nombre' as subgestor_nombre
   from public.pth_subgestor_review_events ev
   where strpos(lower(concat_ws(' ',ev.reference,ev.snapshot->>'cliente',ev.snapshot->>'parent_gestor_nombre',ev.snapshot->>'subgestor_nombre')),lower(coalesce(p_search,'')))>0
   order by ev.created_at desc,ev.id limit 51 offset p_offset
  ) x;
 elsif p_operation='list' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (
   select s.*,md5(to_jsonb(s)::text) as review_version from public.pedidos_subgestores s
   where s.estado='Pendiente Aprobacion' and (is_admin or s.parent_gestor_id=a.id)
    and strpos(lower(concat_ws(' ',s.orden_dia,s.cliente,s.parent_gestor_nombre,s.subgestor_nombre)),lower(coalesce(p_search,'')))>0
   order by s.created_at desc nulls last,s.id limit 51 offset p_offset
  ) x;
 end if;
 if p_operation in ('list','history') then
  return jsonb_build_object('rows',(select coalesce(jsonb_agg(value order by ordinality),'[]') from jsonb_array_elements(result) with ordinality where ordinality<=50),'hasMore',jsonb_array_length(result)>50);
 end if;
 if p_id is null then raise exception 'Falta el pedido';end if;
 -- Serializes decisions even after the source row has been removed.
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 final_operation:=p_operation;
 select * into e from public.pth_subgestor_review_events where pedido_id=p_id and decision in ('approve','reject');
 if found then
  if not is_admin and e.parent_id is distinct from a.id then raise exception 'Pedido no autorizado';end if;
  if e.decision=final_operation then return jsonb_build_object('id',p_id,'reference',e.reference,'decision',e.decision,'replayed',true);end if;
  raise exception 'El pedido ya fue revisado. Actualiza la lista';
 end if;
 select * into p from public.pedidos_subgestores where id=p_id for update;
 if not found then raise exception 'No se encontró el pedido pendiente. Actualiza la lista';end if;
 if not is_admin and p.parent_gestor_id is distinct from a.id then raise exception 'Pedido no autorizado';end if;
 if p.estado is distinct from 'Pendiente Aprobacion' then raise exception 'El pedido ya no está pendiente';end if;
 if exists(select 1 from public.pedidos where id=p.id) then raise exception 'Este pedido ya existe en logística. Requiere conciliación antes de editar o decidir';end if;
 if p_expected is null or p_expected is distinct from md5(to_jsonb(p)::text) then raise exception 'El pedido cambió. Actualiza y revisa antes de continuar';end if;
 if final_operation='edit' then
  if p_changes is null or jsonb_typeof(p_changes)<>'object' or p_changes='{}'::jsonb then raise exception 'No hay cambios válidos';end if;
  for k,v in select key,value from jsonb_each_text(p_changes) loop
   if k not in ('cliente','telefono','ci','direccion','municipio') or v is null or length(v)>4000 then raise exception 'Solo puedes editar datos de entrega';end if;
   if k<>'ci' and length(trim(v))=0 then raise exception 'Completa los datos de entrega';end if;
   if k='ci' and v<>'' and v is distinct from p.ci and v!~'^[0-9]{11}$' then raise exception 'El carnet debe tener 11 dígitos';end if;
  end loop;
  update public.pedidos_subgestores set
   cliente=coalesce(p_changes->>'cliente',p.cliente),telefono=coalesce(p_changes->>'telefono',p.telefono),
   ci=coalesce(p_changes->>'ci',p.ci),direccion=coalesce(p_changes->>'direccion',p.direccion),municipio=coalesce(p_changes->>'municipio',p.municipio)
  where id=p_id;
 elsif final_operation='reject' then
  if length(trim(coalesce(p_reason,'')))=0 or length(p_reason)>1000 then raise exception 'Indica el motivo del rechazo';end if;
 elsif final_operation='approve' then
  if p.comision_total is null or p.comision_subgestor is null or p.comision_subgestor<0 or p.comision_subgestor>p.comision_total then raise exception 'Revisa el reparto de comisiones';end if;
  if p.orden_dia is null or trim(p.orden_dia)='' then raise exception 'El pedido no tiene referencia verificable';end if;
   insert into public.pedidos(id,gestor,cliente,ci,telefono,direccion,municipio,producto,total,costo_mensajeria,
    comision_total,comision_subgestor,comision_parent,estado,pago_gestor,pago_subgestor,proveedor,origen,
    orden_dia,submission_token,subgestor_nombre,garantia_venta,garantia_dias)
   values(p.id,p.parent_gestor_nombre,p.cliente,p.ci,p.telefono,p.direccion,p.municipio,p.producto,p.total,p.costo_mensajeria,
    p.comision_total,p.comision_subgestor,p.comision_total-p.comision_subgestor,'Pendiente','Pendiente','Pendiente',p.proveedor,'Subgestor',
    p.orden_dia,p.submission_token,p.subgestor_nombre,p.garantia_venta,p.garantia_dias);
 end if;
 insert into public.pth_subgestor_review_events(pedido_id,decision,actor_id,actor_name,parent_id,reference,reason,snapshot,changes)
 values(p.id,final_operation,a.id,a.nombre,p.parent_gestor_id,p.orden_dia,nullif(trim(p_reason),''),to_jsonb(p),coalesce(p_changes,'{}'));
 if final_operation='approve' then delete from public.pedidos_subgestores where id=p.id;
 elsif final_operation='reject' then update public.pedidos_subgestores set estado='Rechazado' where id=p.id;
 end if;
 return jsonb_build_object('id',p.id,'reference',p.orden_dia,'decision',final_operation,'replayed',false);
end;$$;
revoke all on function public.pth_review_subgestor(uuid,text,uuid,text,jsonb,text,text,integer) from public,anon,authenticated;
grant execute on function public.pth_review_subgestor(uuid,text,uuid,text,jsonb,text,text,integer) to service_role;
commit;
