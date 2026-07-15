-- Migration: fix sync_exercise_muscle_group().
--
-- This trigger function existed live on `exercises` (fires BEFORE INSERT
-- and BEFORE UPDATE) with no corresponding file anywhere in this repo --
-- found via a live-vs-migrations reconciliation, not something anyone
-- remembered writing down. It's the actual root cause of the original
-- "45-degree incline dumbbell bench press shows as Full Body" report:
-- old behavior forced muscle_group to 'Full Body' any time an exercise's
-- primary_muscles resolved to 3+ distinct generic buckets, and joined
-- exactly-2-bucket cases into a literal "Chest / Shoulders"-style string
-- that isn't one of the 8 real buckets at all.
--
-- New behavior, keeping everything else identical:
--   - muscle_group_full_body_override still forces 'Full Body' for any
--     exercise_id explicitly listed there -- unchanged, that's a
--     deliberate per-exercise admin decision.
--   - The "3+ buckets -> auto Full Body" rule is gone entirely. Multi-
--     bucket exercises no longer get auto-relabeled Full Body just for
--     having several primary muscles -- browsing/filtering already finds
--     them under every real bucket they belong to (see the
--     exerciseMatchesOption additive fix from the prior patch), so
--     forcing the single stored bucket to Full Body was never buying
--     anything except hiding them from their real categories.
--   - Multi-bucket exercises with no override now take the generic
--     bucket of their FIRST-listed primary muscle, exactly matching
--     CustomExerciseModal.jsx's existing rule for user-created exercises
--     (genericBucket(primaryMuscles[0])) -- so an exercise gets the same
--     single-bucket treatment whether it was tagged by this trigger or
--     created by hand, instead of the two paths disagreeing.
create or replace function public.sync_exercise_muscle_group()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  groups text[];
  first_group text;
begin
  if NEW.primary_muscles is null or array_length(NEW.primary_muscles, 1) is null then
    return NEW;
  end if;

  select array_agg(distinct md.generic_group) into groups
  from unnest(NEW.primary_muscles) as pm(scientific_name)
  join muscle_taxonomy mt on mt.scientific_name = pm.scientific_name
  join muscle_detailed md on md.key = mt.detailed_key;

  if groups is null then
    return NEW; -- primary_muscles set but none resolve to taxonomy yet
  end if;

  -- First-listed primary muscle's own bucket -- the fallback for
  -- multi-bucket exercises with no override, matching
  -- CustomExerciseModal.jsx's rule for hand-created exercises.
  select md.generic_group into first_group
  from muscle_taxonomy mt
  join muscle_detailed md on md.key = mt.detailed_key
  where mt.scientific_name = NEW.primary_muscles[1]
  limit 1;

  if exists (select 1 from muscle_group_full_body_override where exercise_id = NEW.id) then
    NEW.muscle_group := 'Full Body';
  elsif array_length(groups, 1) = 1 then
    NEW.muscle_group := groups[1];
  elsif first_group is not null then
    NEW.muscle_group := first_group;
  else
    NEW.muscle_group := groups[1]; -- fallback if the first primary muscle somehow didn't resolve
  end if;

  return NEW;
end;
$$;

-- Backfill: the trigger only runs on INSERT/UPDATE, so existing rows
-- tagged under the old rules need to be touched once to re-run through
-- the new logic. A no-op self-update on the primary key is enough to
-- fire the BEFORE UPDATE trigger for every row that has primary_muscles
-- set, without changing anything else about the row. Confirmed safe:
-- the only other triggers on `exercises`
-- (trg_auto_dismiss_known_alias, trg_log_exercise_submission) are both
-- AFTER INSERT only, so this UPDATE-only backfill can't re-fire either
-- of them.
update exercises set id = id where array_length(primary_muscles, 1) is not null;
