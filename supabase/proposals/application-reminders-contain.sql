-- PRIVATE REVIEW-ONLY containment. No production action has been taken.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
update public.pth_application_reminder_config set enabled=false where singleton;
update public.pth_push_deliveries d set state='expired',lease_until=null
from public.pth_push_events e
where d.event_id=e.id and e.kind='application_reminders'
 and d.state in ('pending','sending');
update public.pth_push_events set expires_at=least(expires_at,now())
where kind='application_reminders';
-- Leave additive schema/CHECKs/ledger, existing topics, triggers, job and secrets.
-- A provider-accepted/in-flight push cannot be retracted universally.
commit;
