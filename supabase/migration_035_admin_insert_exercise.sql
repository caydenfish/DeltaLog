-- Migration: lets an admin create a new exercise straight into the
-- shared library (created_by null) instead of only being able to
-- promote something a user already submitted. The existing insert
-- policy only allows auth.uid() = created_by, which a null created_by
-- can never satisfy.
create policy "exercises_insert_admin" on exercises for insert
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
