-- Migration: follow-up hardening from a second Advisor scan (run after
-- migration_057-059). Three things:

-- ── 1. e1rm() / dots_score(): pin search_path ──────────────────────────
-- Both flagged function_search_path_mutable. Lower risk than a SECURITY
-- DEFINER function missing it (these run as SECURITY INVOKER, the
-- default, so they don't run with elevated privilege) but still best
-- practice, and a one-line fix.
alter function public.e1rm(numeric, numeric, numeric) set search_path = public;
alter function public.dots_score(numeric, numeric, text) set search_path = public;

-- ── 2. exercise-media bucket: stop allowing full listing ───────────────
-- exercise_media_public_read's `using (bucket_id = 'exercise-media')`
-- has no other condition, so it doesn't just let someone fetch a known
-- file — it lets anyone list every file in the entire bucket via the
-- Storage API. That's not needed: photo display in the app goes through
-- getPublicUrl() (queries.js uploadExerciseMedia), which serves public
-- buckets directly and doesn't consult this SELECT policy at all. The
-- ONLY place the app actually calls .list() on this bucket is
-- emptyUserStorageFolder() during account deletion, and it only ever
-- lists the calling user's own folder (.list(userId)). So: narrow the
-- policy to owner-only, matching the update/delete policies this bucket
-- already has -- nothing observable changes (photos still load exactly
-- the same way), the only thing that goes away is the ability for
-- anyone to enumerate the whole bucket's file list.
drop policy if exists "exercise_media_public_read" on storage.objects;
create policy "exercise_media_owner_select" on storage.objects for select
  using (bucket_id = 'exercise-media' and owner = auth.uid());

-- ── 3. Re-apply migration_057's function grants, explicitly ────────────
-- This scan still shows admin_search_users, admin_set_is_admin,
-- admin_set_is_creator, admin_get_user_activity,
-- admin_get_referral_sources, admin_promote_exercise,
-- admin_merge_exercise_alias, auto_dismiss_known_alias, and
-- get_shared_template_by_code as callable by `anon` -- migration_057
-- revoked all of these from `public` and (for the admin/creator ones,
-- plus get_shared_template_by_code) granted only to `authenticated`.
-- Whether that didn't take effect, or the Advisor snapshot just hadn't
-- refreshed yet, this re-applies the same intent but names `anon` and
-- `authenticated` explicitly instead of going through the PUBLIC
-- pseudo-role, to remove any ambiguity. Safe/idempotent to run even if
-- migration_057's version already took.
revoke execute on function public.admin_search_users(text) from public, anon, authenticated;
revoke execute on function public.admin_set_is_admin(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.admin_set_is_creator(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.admin_get_user_activity() from public, anon, authenticated;
revoke execute on function public.admin_get_referral_sources() from public, anon, authenticated;
revoke execute on function public.admin_promote_exercise(uuid) from public, anon, authenticated;
revoke execute on function public.admin_merge_exercise_alias(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.admin_rename_muscle_scientific(text, text) from public, anon, authenticated;
revoke execute on function public.auto_dismiss_known_alias() from public, anon, authenticated;
revoke execute on function public.log_exercise_submission() from public, anon, authenticated;
revoke execute on function public.get_shared_template_by_code(text) from public, anon, authenticated;
revoke execute on function public.get_shared_workout_by_code(text) from public, anon, authenticated;

grant execute on function public.admin_search_users(text) to authenticated;
grant execute on function public.admin_set_is_admin(uuid, boolean) to authenticated;
grant execute on function public.admin_set_is_creator(uuid, boolean) to authenticated;
grant execute on function public.admin_get_user_activity() to authenticated;
grant execute on function public.admin_get_referral_sources() to authenticated;
grant execute on function public.admin_promote_exercise(uuid) to authenticated;
grant execute on function public.admin_merge_exercise_alias(uuid, uuid) to authenticated;
grant execute on function public.admin_rename_muscle_scientific(text, text) to authenticated;
grant execute on function public.get_shared_template_by_code(text) to authenticated;

-- auto_dismiss_known_alias and log_exercise_submission are trigger
-- functions (fired by Postgres itself on insert, never called directly
-- by the app) -- they don't need EXECUTE granted to any client role at
-- all. Deliberately not re-granted to anyone.

-- get_shared_workout_by_code is the one deliberately public function --
-- share links must work for signed-out visitors (see migration_057's
-- own comment on this).
grant execute on function public.get_shared_workout_by_code(text) to anon, authenticated;
