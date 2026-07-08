-- Migration: adds post-workout capture fields and speeds up dashboard queries.
-- Run this after schema.sql + seed_exercises.sql.

alter table workouts add column if not exists body_weight numeric;
alter table workouts add column if not exists session_notes text default '';

-- Speeds up the volume-over-time chart and calendar heatmap, which both
-- query completed workouts within a date range.
create index if not exists idx_workouts_user_completed_range
  on workouts(user_id, completed_at)
  where completed_at is not null;
