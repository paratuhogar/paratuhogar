-- Applied as 20261002004640_admin_push_applications_activate_verified_source; do not reapply.
-- Apply only after secure-data and dispatcher support applications.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
alter table public.gestores enable trigger pth_push_new_application;
commit;
