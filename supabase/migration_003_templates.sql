-- Migration: workout templates.
-- Run after migration_002_workout_summary.sql.

create table workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,
  created_at timestamptz not null default now()
);

-- One row per exercise in a template. planned_sets/notes/setup are only
-- meaningful if the person chose "include details" when saving — otherwise
-- they're left at defaults and the exercise loads in fresh.
create table template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references workout_templates(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  position int not null,
  planned_sets int not null default 3,
  notes text default '',
  setup jsonb default '{}'
);

create index idx_template_exercises_template on template_exercises(template_id, position);

alter table workout_templates enable row level security;
alter table template_exercises enable row level security;

create policy "workout_templates_all_own" on workout_templates for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "template_exercises_all_own" on template_exercises for all
  using (exists (select 1 from workout_templates t where t.id = template_id and t.user_id = auth.uid()))
  with check (exists (select 1 from workout_templates t where t.id = template_id and t.user_id = auth.uid()));
