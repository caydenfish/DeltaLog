-- Migration 073: per-set rep targets ("rep schemes").
--
-- A rep scheme is an ordered JSON array, one entry per working set:
--   [{"low": 8, "high": 12}, {"low": 8, "high": 12}, {"low": 15, "high": 18}]
-- NULL means "no custom scheme -- use the training focus range for every
-- set", which is exactly how every existing row behaves today, so this is
-- purely additive and needs no backfill.
--
-- Lives on template_exercises (the plan) and workout_exercises (the copy
-- a live workout runs from, so a resumed or edited-mid-workout scheme
-- survives a reload). shared_templates.exercises is already jsonb, so the
-- scheme rides along inside each exercise object with no schema change.
--
-- Run this BEFORE deploying v1.13.0. The app falls back gracefully if the
-- column is missing (reads retry without it, writes drop it), but schemes
-- won't persist until this has run.

alter table template_exercises add column if not exists rep_scheme jsonb;
alter table workout_exercises add column if not exists rep_scheme jsonb;

-- Shape guard: array of {low, high} ints, 1..100, low <= high, at most 20
-- sets. Kept deliberately loose on extra keys so future fields (e.g. RIR
-- targets per set) don't need a constraint change.
create or replace function valid_rep_scheme(s jsonb) returns boolean
language sql immutable set search_path = public as $$
  select s is null or (
    jsonb_typeof(s) = 'array'
    and jsonb_array_length(s) between 1 and 20
    and not exists (
      select 1 from jsonb_array_elements(s) e
      where jsonb_typeof(e) <> 'object'
         or jsonb_typeof(e->'low') <> 'number'
         or jsonb_typeof(e->'high') <> 'number'
         or (e->>'low')::numeric < 1
         or (e->>'high')::numeric > 100
         or (e->>'low')::numeric > (e->>'high')::numeric
    )
  )
$$;

alter table template_exercises drop constraint if exists template_exercises_rep_scheme_valid;
alter table template_exercises add constraint template_exercises_rep_scheme_valid check (valid_rep_scheme(rep_scheme));
alter table workout_exercises drop constraint if exists workout_exercises_rep_scheme_valid;
alter table workout_exercises add constraint workout_exercises_rep_scheme_valid check (valid_rep_scheme(rep_scheme));

notify pgrst, 'reload schema';
