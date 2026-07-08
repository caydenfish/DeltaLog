-- Migration: privacy-request feedback type, admin "new submissions"
-- tracking, and full self-service account deletion.

-- Allow a third feedback category alongside bug/feature.
alter table feedback drop constraint if exists feedback_type_check;
alter table feedback add constraint feedback_type_check check (type in ('bug', 'feature', 'privacy'));

-- Tracks when an admin last opened the Feedback & Bugs screen, so the
-- app can show a "new submissions" badge for anything since then.
alter table profiles add column if not exists feedback_last_viewed_at timestamptz;

-- Full account deletion, callable by the signed-in user on themselves
-- only (auth.uid() is read server-side from their own JWT, never passed
-- in as an argument, so there's no way to target another account).
-- Runs as SECURITY DEFINER so it can delete the auth.users row itself,
-- which a normal authenticated role can't do directly. Deleting that row
-- cascades automatically to profiles, feedback, and progress_photos
-- (all declared "on delete cascade" against auth.users); the tables
-- below are cleaned up explicitly first because their foreign keys to
-- auth.users are NOT cascading, so deleting auth.users first would
-- otherwise fail outright.
--
-- Note: this does not delete files sitting in Storage (progress photos,
-- custom exercise media) — the app deletes those via the Storage API
-- client-side, right before calling this function. See
-- deleteOwnAccount() in src/lib/queries.js.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from workouts where user_id = uid;            -- cascades to workout_exercises, sets
  delete from workout_templates where user_id = uid;    -- cascades to template_exercises
  delete from exercise_defaults where user_id = uid;
  delete from exercises where created_by = uid;         -- only this user's private custom exercises; shared/promoted ones (created_by null) are untouched

  delete from auth.users where id = uid;                -- cascades to profiles, feedback, progress_photos
end;
$$;

revoke all on function public.delete_own_account() from public;
revoke all on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;
