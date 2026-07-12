-- Fixes: POST rpc/log_app_open returning 403 with
-- "new row violates row-level security policy for table user_activity_log"
-- for any returning user (confirmed via a HAR capture on load).
--
-- Root cause: migration_048 enabled RLS on user_activity_log with only
-- INSERT and UPDATE policies, deliberately leaving out a SELECT policy so
-- bulk reads stay admin-only (routed through the security-definer
-- admin_get_user_activity function instead). But log_app_open's upsert —
-- `insert ... on conflict (user_id) do update` — needs to find and
-- evaluate the pre-existing row to run its UPDATE path, and Postgres
-- resolves that lookup through the table's own RLS SELECT policy, not
-- through the calling function's security context. With no SELECT policy
-- at all, a first-time INSERT works fine (nothing to conflict with yet),
-- but every subsequent call hits the conflict, can't see the row it needs
-- to update, and Postgres raises a row-security violation instead of
-- silently no-op'ing.
--
-- Fix: let a user see (only) their own row. This doesn't loosen the
-- "admin-only bulk read" goal — that was always about hiding one user's
-- activity from every OTHER user, never about hiding it from themselves.
create policy "users can view own activity log"
  on public.user_activity_log
  for select
  using (auth.uid() = user_id);
