-- Set Logger schema
-- Run this in Supabase SQL Editor (Project > SQL Editor > New query)

-- ── Exercises (library) ─────────────────────────────────────────────
-- Seeded from the exercise database spreadsheet; users can add their own
-- (created_by set). equipment_type is a derived bucket (Barbell/Dumbbell/
-- Cable/Machine/Kettlebell/Bodyweight/Other) that powers the existing
-- filter chips; `equipment` holds the full original list per exercise.
create table exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short text,
  equipment text[] not null default '{}',
  equipment_type text not null default 'Other',
  primary_muscle text not null,
  secondary_muscles text[] not null default '{}',
  muscle_group text not null,
  mechanism text not null,
  pattern text not null,
  target_weight numeric not null default 0,
  setup_fields jsonb not null default '[]',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ── Workouts (one row per session) ──────────────────────────────────
create table workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  ideology text not null default 'Hypertrophy',
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ── Workout exercises (an exercise slot within a session) ───────────
create table workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  position int not null,
  planned_sets int not null default 3,
  ideology_override text,
  notes text default ''
);

-- ── Sets (the actual logged reps/weight/rir) ────────────────────────
create table sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references workout_exercises(id) on delete cascade,
  set_number int not null,
  weight numeric not null,
  reps int not null,
  rir int not null,
  created_at timestamptz not null default now()
);

-- ── Per-user exercise defaults (setup + notes that persist across sessions) ──
-- Replaces the in-memory `exerciseMeta` state in the prototype.
create table exercise_defaults (
  user_id uuid not null references auth.users(id),
  exercise_id uuid not null references exercises(id),
  setup jsonb not null default '{}',
  notes text default '',
  primary key (user_id, exercise_id)
);

-- ── Indexes for the "last session" comparison query ─────────────────
create index idx_workouts_user_completed on workouts(user_id, completed_at desc);
create index idx_workout_exercises_workout on workout_exercises(workout_id);
create index idx_workout_exercises_exercise on workout_exercises(exercise_id);
create index idx_sets_workout_exercise on sets(workout_exercise_id, set_number);

-- ── Row Level Security ───────────────────────────────────────────────
alter table exercises enable row level security;
alter table workouts enable row level security;
alter table workout_exercises enable row level security;
alter table sets enable row level security;
alter table exercise_defaults enable row level security;

-- Exercises: everyone can read the library; users can only insert/edit their own custom ones
create policy "exercises_select_all" on exercises for select using (true);
create policy "exercises_insert_own" on exercises for insert with check (auth.uid() = created_by);
create policy "exercises_update_own" on exercises for update using (auth.uid() = created_by);

-- Workouts: strictly owner-only
create policy "workouts_all_own" on workouts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Workout exercises: scoped via parent workout's owner
create policy "workout_exercises_all_own" on workout_exercises for all
  using (exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid()))
  with check (exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid()));

-- Sets: scoped via workout_exercise -> workout's owner
create policy "sets_all_own" on sets for all
  using (exists (
    select 1 from workout_exercises we join workouts w on w.id = we.workout_id
    where we.id = workout_exercise_id and w.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from workout_exercises we join workouts w on w.id = we.workout_id
    where we.id = workout_exercise_id and w.user_id = auth.uid()
  ));

-- Exercise defaults: owner-only
create policy "exercise_defaults_all_own" on exercise_defaults for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Starter library ──────────────────────────────────────────────────
-- Run supabase/seed_exercises.sql after this file to load the full
-- 252-exercise database.
