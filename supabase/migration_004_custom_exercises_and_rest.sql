-- Migration: custom exercises + persistent per-exercise rest timers.

-- Custom exercises (created_by set) should only be visible to their creator,
-- not added to the shared library everyone else sees. System exercises
-- (created_by is null) remain visible to everyone.
drop policy if exists "exercises_select_all" on exercises;
create policy "exercises_select_own_or_system" on exercises for select
  using (created_by is null or created_by = auth.uid());

-- Per-exercise rest timer, saved alongside notes/setup so it carries over
-- session to session automatically.
alter table exercise_defaults add column if not exists rest_seconds integer;
