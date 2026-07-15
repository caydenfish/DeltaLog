-- Migration: security hardening.
--
-- Triggered by two Supabase Security Advisor findings (auth_users_exposed
-- on `user_activity`, security_definer_view on `user_activity` and
-- `exercise_muscle_groups`) but expanded into a full pass over the
-- schema while in here, per request. Five independent fixes below, each
-- safe to run on its own and safe to run all together.

-- ── 1. Drop the orphaned `user_activity` view ──────────────────────────
-- SECURITY DEFINER and exposed to `anon` — meaning any unauthenticated
-- request could read straight into auth.users (email, etc.) through it
-- with RLS fully bypassed. Nothing in the app queries this view (grep
-- confirms queries.js only ever calls admin_get_user_activity(), the
-- safe Creator-gated RPC from migration_048/049) — this was almost
-- certainly an earlier draft left behind once that RPC replaced it.
drop view if exists public.user_activity;

-- ── 2. exercise_muscle_groups: SECURITY DEFINER -> security_invoker ────
-- This one IS actively used (queries.js fetchMuscleGroups) and is
-- non-sensitive (public exercise-library metadata, no PII) — but it was
-- also flagged SECURITY DEFINER, meaning it silently bypasses RLS
-- regardless of what policies `exercises` has now or ever gets later.
-- That's bad practice on principle even though nothing sensitive
-- currently leaks through it. Rebuilt as security_invoker (respects the
-- querying user's own RLS, like every other view/table in this schema),
-- preserving its exact current definition via pg_get_viewdef so this
-- doesn't require knowing/guessing its SQL by hand.
do $$
declare
  view_def text;
begin
  select pg_get_viewdef('public.exercise_muscle_groups'::regclass, true) into view_def;
  execute 'drop view if exists public.exercise_muscle_groups';
  execute format('create view public.exercise_muscle_groups with (security_invoker = true) as %s', view_def);
  grant select on public.exercise_muscle_groups to anon, authenticated;
end $$;

-- ── 3. auto_dismiss_known_alias(): pin search_path ──────────────────────
-- Live SECURITY DEFINER trigger function (migration_024) missing
-- `set search_path`. Without it, an unqualified identifier/function call
-- inside the body resolves against whatever search_path the CALLING
-- role currently has set, which a malicious caller could manipulate
-- (e.g. creating a same-named object earlier in their own search_path)
-- to hijack code running inside this elevated-privilege context. Every
-- other security definer function in this schema already pins
-- `set search_path = public`; this was the one straggler still live
-- (the other one like it, auto_promote_custom_exercise, was already
-- dropped entirely in migration_031). Pinning, not dropping — this
-- trigger still does its job (auto-dismissing known-alias submissions
-- from the review queue).
alter function public.auto_dismiss_known_alias() set search_path = public;

-- ── 4. Defense-in-depth: explicit PUBLIC revoke on admin/creator RPCs ──
-- Each of these already checks is_admin/is_creator internally and
-- raises if the caller isn't authorized, so this changes no behavior —
-- but Postgres grants EXECUTE to PUBLIC (which includes `anon`) by
-- default on function creation unless explicitly revoked, and none of
-- the original migrations did that. Revoking means an unauthorized
-- caller is rejected by Postgres's own grant system before the function
-- body even runs, instead of relying solely on the internal check being
-- bug-free forever.
revoke execute on function public.admin_search_users(text) from public;
revoke execute on function public.admin_set_is_admin(uuid, boolean) from public;
revoke execute on function public.admin_set_is_creator(uuid, boolean) from public;
revoke execute on function public.admin_get_user_activity() from public;
revoke execute on function public.admin_get_referral_sources() from public;
revoke execute on function public.admin_promote_exercise(uuid) from public;
revoke execute on function public.admin_merge_exercise_alias(uuid, uuid) from public;
grant execute on function public.admin_search_users(text) to authenticated;
grant execute on function public.admin_set_is_admin(uuid, boolean) to authenticated;
grant execute on function public.admin_set_is_creator(uuid, boolean) to authenticated;
grant execute on function public.admin_get_user_activity() to authenticated;
grant execute on function public.admin_get_referral_sources() to authenticated;
grant execute on function public.admin_promote_exercise(uuid) to authenticated;
grant execute on function public.admin_merge_exercise_alias(uuid, uuid) to authenticated;

-- ── 5. shared_templates / shared_workouts: close full-table enumeration ─
-- Both currently allow `select using (true)` — meaning the share code
-- isn't actually an access control, it's decorative. Anyone hitting the
-- REST API directly (no code needed, no login needed) can list every
-- row in either table. For shared_workouts specifically that's real
-- training data (exercises, weights, sets, reps) for every workout
-- anyone has ever shared — scrapable in bulk. The code was only ever
-- enforced client-side via `.eq("code", ...)`; RLS has no concept of
-- "did the caller filter by code," it only filters rows against the
-- policy predicate, and `true` matches every row regardless.
--
-- Fix: tighten each table's own SELECT policy to owner-only (a creator
-- can still see their own past shares; nobody else can list or scan the
-- table), and move the by-code lookup into a narrow SECURITY DEFINER
-- function that only ever returns the single row matching an exact code
-- — there's no way to ask it for "everything" the way a table select
-- allows. The insert/create-code path doesn't need read access to other
-- people's codes for uniqueness — it already retries on the unique-
-- constraint violation (see generateShareCode/exportTemplate/
-- shareWorkout in queries.js) — so nothing else about that path changes.
drop policy if exists "shared_templates_select_all" on shared_templates;
create policy "shared_templates_select_own" on shared_templates for select using (auth.uid() = created_by);

drop policy if exists "shared_workouts_select_all" on shared_workouts;
create policy "shared_workouts_select_own" on shared_workouts for select using (auth.uid() = created_by);

create or replace function public.get_shared_template_by_code(p_code text)
returns table (id uuid, name text, exercises jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select id, name, exercises
  from shared_templates
  where code = upper(trim(p_code))
  limit 1;
$$;

-- Deliberately the one function here granted to anon: share links are
-- meant to work for signed-out visitors too (see migration_028's own
-- comment — "no login required"), matching SharedWorkoutView.jsx.
create or replace function public.get_shared_workout_by_code(p_code text)
returns table (snapshot jsonb, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select snapshot, created_at
  from shared_workouts
  where code = upper(trim(p_code))
  limit 1;
$$;

revoke all on function public.get_shared_template_by_code(text) from public;
grant execute on function public.get_shared_template_by_code(text) to authenticated;

revoke all on function public.get_shared_workout_by_code(text) from public;
grant execute on function public.get_shared_workout_by_code(text) to anon, authenticated;
