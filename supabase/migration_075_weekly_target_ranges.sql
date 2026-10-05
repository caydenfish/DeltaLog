-- migration_075: weekly volume target ranges (app v1.14.0)
-- weekly_target_sets becomes the range minimum; this adds the maximum.
-- Existing goals get max = 2x their minimum. A minimum of 0 still means
-- "not tracked". Safe to run more than once.
alter table public.muscle_group_targets
  add column if not exists weekly_target_max integer;

update public.muscle_group_targets
  set weekly_target_max = weekly_target_sets * 2
  where weekly_target_max is null and weekly_target_sets > 0;
