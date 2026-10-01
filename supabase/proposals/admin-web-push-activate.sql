-- ACTIVATION ONLY, DO NOT RUN until user has entered secrets and personally
-- opted in and confirmed the pilot notification. Contains no secret values.
begin;
set local lock_timeout='3s';
do $$ begin
 if not exists(select 1 from vault.secrets where name='pth_push_dispatch_secret') then
  raise exception 'Required Vault entry is missing';
 end if;
end $$;
select cron.schedule('pth-admin-push-dispatch','* * * * *',$job$
 select net.http_post(
  url:='https://ljqwaovevfatkiigirhf.supabase.co/functions/v1/admin-push-dispatch',
  headers:=jsonb_build_object('Content-Type','application/json','x-pth-push-secret',
    (select decrypted_secret from vault.decrypted_secrets where name='pth_push_dispatch_secret')),
  body:='{"mode":"dispatch"}'::jsonb,
  timeout_milliseconds:=80000
 )
 where exists(select 1 from vault.secrets where name='pth_push_dispatch_secret');
$job$);
alter table public.pedidos enable trigger pth_push_new_order;
alter table public.pth_feedback enable trigger pth_push_new_suggestion;
commit;
