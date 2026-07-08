-- Migration: lets a user delete their own custom exercise (previously
-- only admins could delete exercise rows). If the exercise has been used
-- in a logged workout, the delete will fail on the exercise_id foreign
-- key in workout_exercises -- that's existing, intentional protection
-- against silently orphaning logged history, and the app surfaces a
-- friendly message for that case rather than a raw DB error.

drop policy if exists "exercises_delete_own" on exercises;
create policy "exercises_delete_own" on exercises for delete
  using (auth.uid() = created_by);
