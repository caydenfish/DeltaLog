-- Migration: primary muscles as a multi-value array, matching the
-- structure secondary_muscles already uses. `primary_muscle` (singular)
-- was legacy — set on creation but never actually read anywhere in the
-- app. Existing single values are carried over into the new array
-- before the old column is dropped, so nothing is silently lost.
alter table exercises add column if not exists primary_muscles text[] not null default '{}';

update exercises
set primary_muscles = array[primary_muscle]
where primary_muscle is not null and trim(primary_muscle) <> ''
  and (primary_muscles is null or primary_muscles = '{}');

alter table exercises drop column if exists primary_muscle;

-- seed_exercises.sql is historical (already applied) and still refers to
-- the old singular column — it's not meant to be rerun against a live
-- database, so it's left as-is rather than rewritten.
