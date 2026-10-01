-- PROPOSAL ONLY. Requires explicit approval before applying to production.
-- Additive: no modifications to customers, money, roles, or existing policies.
begin;
create table public.pth_feedback (
 id uuid primary key,
 author_id uuid not null references public.gestores(id),
 team_id uuid not null references public.gestores(id),
 kind text not null check(kind in ('problema','mejora')),
 title text not null check(length(title) between 1 and 160),
 need text not null check(length(need) between 1 and 2000),
 workflow text not null check(length(workflow) between 1 and 2000),
 benefit text not null default '' check(length(benefit)<=2000),
 page text not null check(page ~ '^/(index[.]html|subgestores[.]html|gestores[.]html|studio[.]html|master[.]html|feedback[.]html)?$'),
 screenshot text check(length(screenshot)<=110000 and screenshot ~ '^data:image/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$'),
 status text not null default 'nuevo' check(status in ('nuevo','en_revision','pendiente_informacion','planificado','resuelto','descartado','duplicado')),
 priority text not null default 'normal' check(priority in ('baja','normal','alta')),
 response text not null default '' check(length(response)<=2000),
 owner_note text not null default '' check(length(owner_note)<=4000),
 duplicate_of uuid references public.pth_feedback(id),
 revision integer not null default 0 check(revision>=0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(duplicate_of is null or duplicate_of<>id),
 check((status='duplicado')=(duplicate_of is not null)),
 check(kind<>'mejora' or length(benefit)>0)
);
create index pth_feedback_author_date on public.pth_feedback(author_id,created_at desc,id);
create index pth_feedback_date on public.pth_feedback(created_at desc,id);
create index pth_feedback_duplicate on public.pth_feedback(duplicate_of) where duplicate_of is not null;
alter table public.pth_feedback enable row level security;
revoke all on public.pth_feedback from public,anon,authenticated;
revoke all on public.pth_feedback from service_role;
grant select,insert,update on public.pth_feedback to service_role;
-- Serialize changes to the duplicate graph, including connector updates.
create function public.pth_feedback_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 if row(new.id,new.author_id,new.team_id,new.kind,new.title,new.need,new.workflow,new.benefit,new.page,new.screenshot,new.created_at)
    is distinct from row(old.id,old.author_id,old.team_id,old.kind,old.title,old.need,old.workflow,old.benefit,old.page,old.screenshot,old.created_at) then
  raise exception 'Submitted feedback is immutable';
 end if;
 if new.revision <> old.revision + 1 then raise exception 'Increment revision by one'; end if;
 if new.duplicate_of is distinct from old.duplicate_of then
  perform pg_catalog.pg_advisory_xact_lock(70101339);
  if new.duplicate_of is not null and (
   exists(select 1 from public.pth_feedback where duplicate_of=new.id) or
   not exists(select 1 from public.pth_feedback where id=new.duplicate_of and kind=new.kind and duplicate_of is null)
  ) then raise exception 'Duplicate must reference an original of the same kind, without chains'; end if;
 end if;
 new.updated_at=pg_catalog.now();
 return new;
end;
$$;
revoke all on function public.pth_feedback_guard() from public,anon,authenticated;
grant execute on function public.pth_feedback_guard() to service_role;
create trigger pth_feedback_guard before update on public.pth_feedback
for each row execute function public.pth_feedback_guard();
commit;
