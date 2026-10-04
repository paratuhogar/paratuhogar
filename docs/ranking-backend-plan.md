# Ranking aggregates and closed recognition — implementation plan

Goal: extend the approved private summary and record only reliable closed-month recognition.
Architecture: retain service-only SECURITY INVOKER aggregate; one private results table and a manually invoked finalizer. No new cron or client table access.
Spec: the backend proposal approved by Marcel, Sentinel_4c0301415144819180a2b0f93cd8aa4d, 2026-10-04 10:19 UTC, summarized in ranking-redesign-review.md.

Constraints: no frontend publication, deployment or real closure; no orders/auth/money permissions changed. November 2026 is the first candidate, not automatically eligible. All tied winners retained internally, response bounded to three aliases per month and six months; UUID of historical other winners never returned. Service receives SELECT/INSERT only on new private table. Anonymous/authenticated receive neither schema/table nor RPC access.

1. Write Node DTO tests for leaderCount, exact nextHigherCount, bounded closed history and own badges; watch them fail. Implement strict optional fields so older backend remains usable and malformed present fields fail closed.
2. Generate migration using Supabase CLI. Add private results table (month primary key, period bounds, closure time, quality, winners JSON with internal UUIDs), RLS and exact service grants. Add service-only SECURITY INVOKER finalizer(text); reject pre-November/open months, return existing result idempotently; require reliable in-period attribution/dates and a manual coverage assertion before persisting. No runtime/generic gateway close action.
3. Reuse current attribution/count/rank expressions for closure; freeze aliases/counts of all rank1 winners. Add leaderCount and nextHigherCount to current summary and bounded histories/self badges from persisted results.
4. Local PostgreSQL-engine tests: denied anon/authenticated SQL/RPC, service select+insert only, closed/no empty prizes, all ties persisted, idempotency, open/October rejected, missing/ambiguous coverage rejected, six-month/three-alias projection, no foreign historical IDs. Test clock may be substituted only in isolated SQL fixture to exercise future November; production has server clock only.
5. Wire UI fields with backwards fallback, history/own badge and provisional label. Validate browser mobile/desktop and static bundle. Commit reviewed changes locally and save updated Library package; no deploy.

Finalizer coverage decision: reliable dates cannot be inferred from old undated orders. A mandatory explicit boolean coverage approval argument would widen the approved one-argument interface; instead finalization must conservatively reject any undated/invalid delivered order created in the target period and any in-period attribution ambiguity, and document that operator must verify coverage and execution timing before invocation. Historical undated rows outside the target period remain unassigned and do not disqualify every future month.
