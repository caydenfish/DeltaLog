-- Fix: "Submitted by a user" instead of the real name, for any custom
-- exercise submission not made by the admin themself.
--
-- profiles has exactly one RLS policy (profiles_all_own, migration_005):
-- auth.uid() = id, for every operation, with no admin carve-out ever
-- added. fetchCustomExercisesForReview and fetchAllExerciseSubmissions
-- both do a plain client-side `.from("profiles").select(...).in("id", …)`
-- to resolve submitter names — which RLS silently filters down to just
-- the querying admin's own row (if present at all), not an error, just
-- quietly fewer rows than asked for. Every other submitter's name comes
-- back missing, and the UI's fallback ("a user") papers over exactly
-- that. Fixed with a narrow security-definer RPC, admin-gated, that
-- returns only first/last name for the requested ids — mirroring the
-- same pattern already used for every other admin-only cross-user read
-- in this schema (admin_search_users, admin_get_user_activity, etc.)
-- rather than opening profiles itself up to admin reads more broadly.
create or replace function admin_get_profile_names(ids uuid[])
returns table (id uuid, first_name text, last_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.first_name, p.last_name
  from profiles p
  where p.id = any(ids)
    and exists (select 1 from profiles a where a.id = auth.uid() and a.is_admin);
$$;

revoke all on function admin_get_profile_names(uuid[]) from public;
grant execute on function admin_get_profile_names(uuid[]) to authenticated;
