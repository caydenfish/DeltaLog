-- Migration: supersets. Exercises sharing the same superset_group are
-- performed back-to-back with no full rest between them, then rested as
-- a pair. Null means "not in a superset" (the default, unchanged
-- behavior for every existing row).

alter table workout_exercises add column if not exists superset_group integer;
alter table template_exercises add column if not exists superset_group integer;
