-- REVIEW ONLY: do not apply to production without release approval.
-- Nullable columns preserve every historical application and legacy clients.
begin;
alter table public.gestores add column questionnaire jsonb;
alter table public.gestores add column application_token uuid;
alter table public.gestores add constraint gestores_questionnaire_object
 check (questionnaire is null or (jsonb_typeof(questionnaire)='object' and coalesce(questionnaire->>'version'='1',false) and octet_length(questionnaire::text)<=10000));
create unique index gestores_application_token_unique on public.gestores(application_token) where application_token is not null;
commit;
-- No changes to grants, RLS, roles, authentication, decisions or existing rows.
-- Rollback: revert the frontend and secure-data deployment first. Keep the two
-- nullable columns to preserve submitted answers; they are ignored by old code.
-- Only after an authorized private backup and retention decision, optionally:
-- begin;
-- drop index public.gestores_application_token_unique;
-- alter table public.gestores drop constraint gestores_questionnaire_object;
-- alter table public.gestores drop column questionnaire, drop column application_token;
-- commit;
