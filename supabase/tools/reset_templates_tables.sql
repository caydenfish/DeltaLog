-- reset_templates_tables.sql (moved from migration_003_templates_reset.sql
-- during the July 2026 migration-history cleanup — content unchanged).
-- This is a break-glass recovery utility for migration_003_templates.sql,
-- NOT a distinct migration in the numbered sequence — it never gets a
-- migration_NNN number, and there is no "migration 003b." Only run this
-- if migration_003 landed badly and you need to blow away and recreate
-- workout_templates/template_exercises cleanly. See ../README.md.
--
-- Safe to re-run: drops and recreates the template tables cleanly.
-- Use this ONLY if you want to reset/verify the templates schema.
-- If workout_templates and template_exercises already show up correctly
-- in Table Editor, you don't need to run this at all.

drop table if exists template_exercises;
drop table if exists workout_templates;

create table workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,
  created_at timestamptz not null default now()
);

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
