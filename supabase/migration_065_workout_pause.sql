-- Adds pause / save-for-later support to in-progress workouts.
--
-- paused_at: set when the user explicitly pauses (vs. just backgrounding
-- the app, which leaves this null and relies on the existing
-- fetchActiveWorkout auto-resume safety net). Non-null means the workout
-- timer and rest timer are frozen and Home should NOT auto-force the
-- "Resume Workout" button — it offers a normal "Start Workout" instead,
-- with the paused workout surfaced as a "Resume previous workout" option.
--
-- paused_total_sec: cumulative seconds spent paused across every
-- pause/resume cycle for this workout so far (NOT including the current
-- active pause, if any). Used to shift the effective start time forward
-- so elapsed-time math excludes time spent paused.
alter table workouts
  add column if not exists paused_at timestamptz,
  add column if not exists paused_total_sec integer not null default 0;
