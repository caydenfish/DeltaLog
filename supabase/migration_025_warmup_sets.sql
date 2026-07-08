-- Migration: warmup sets.
-- Warmup sets are tagged, not a separate table — they're full sets
-- (weight/reps/rir all still recorded) that display as W1, W2, etc.
-- instead of counting toward working-set numbering, volume, or PRs.
alter table sets add column if not exists is_warmup boolean not null default false;

-- Planned warmup-set counts, mirroring the existing planned_sets column,
-- on both an in-progress workout's exercise slots and on templates —
-- these are the two places warmup counts get configured (template
-- creation, and per-exercise in the live workout's Manage screen).
alter table workout_exercises add column if not exists planned_warmup_sets int not null default 0;
alter table template_exercises add column if not exists planned_warmup_sets int not null default 0;
