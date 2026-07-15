-- migration_063_program_generator.sql
--
-- Adds the multi-week program generator: a `programs` header row per
-- generated block (training focus, experience level, duration, split),
-- `program_exercises` holding the exercise list and any per-exercise
-- progression-model override, and a handful of nullable columns on the
-- existing `workout_exercises` table so a session created from an active
-- program carries its prescription (and the plain-language reason for it)
-- forward into the logger. Non-program workouts are completely
-- unaffected -- those columns just stay null and targetFor() in
-- SetLogger.jsx falls back to the existing ideology-based math exactly
-- as it does today.
--
-- Progress through a program is tracked by *sessions completed*, not
-- calendar time -- deliberately no "week started on" date math anywhere.
-- program_week on workout_exercises is stamped at session-creation time
-- from a count of prior completed sessions tied to the program, so a
-- missed week doesn't desync the block; it just waits for the next
-- session tied to that program.

-- ── Programs (one row per generated block) ───────────────────────────
create table programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  training_focus text not null,               -- Strength / Hypertrophy / Endurance
  experience_level text not null,             -- Beginner / Intermediate / Advanced
  duration_weeks int not null,
  days_per_week int not null,
  split_name text,
  status text not null default 'active',      -- active | completed | abandoned
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

-- ── Program exercises (the generated exercise list for the block) ────
create table program_exercises (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  position int not null,
  day_index int not null default 0,           -- which day of the split rotation this belongs to (0 for single-day splits like Full Body)
  planned_sets int not null default 3,
  progression_model text,                     -- double_progression | percent_e1rm | rir_autoregulation; null = use the training-focus default
  created_at timestamptz not null default now()
);

create index idx_program_exercises_program on program_exercises(program_id);

-- ── Program linkage + prescription on workout_exercises ──────────────
-- prescribed_weight/prescribed_reps are the program engine's computed
-- target for that slot at the moment the session was generated (already
-- unit-adjusted); progression_reason is the plain-language "why" shown
-- next to the target in the logger (e.g. "Hit top of rep range, adding
-- weight" / "Deload week, volume and intensity reduced").
alter table workout_exercises
  add column program_id uuid references programs(id) on delete set null,
  add column program_week int,
  add column prescribed_weight numeric,
  add column prescribed_reps int,
  add column progression_reason text;

create index idx_workout_exercises_program on workout_exercises(program_id) where program_id is not null;

-- ── Row Level Security ────────────────────────────────────────────────
alter table programs enable row level security;
alter table program_exercises enable row level security;

create policy "programs_all_own" on programs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "program_exercises_all_own" on program_exercises for all
  using (exists (select 1 from programs p where p.id = program_id and p.user_id = auth.uid()))
  with check (exists (select 1 from programs p where p.id = program_id and p.user_id = auth.uid()));
