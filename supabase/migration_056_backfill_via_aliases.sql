-- Migration: broaden the exercise_submissions backfill.
--
-- migration_054's backfill only matched a promotion notification to a
-- current exercise by exact name. That's right for the exercise that
-- was directly promoted (its name at promotion time is still its name
-- now, notification and all), but wrong for a duplicate that got folded
-- into a *different* target during that same promotion's consolidation
-- step: the duplicate's own row is deleted, its name never becomes the
-- surviving exercise's name -- it only survives as one entry in that
-- exercise's aliases array. Matching on e.name alone can never find
-- those, so anyone whose submission got folded in as a duplicate before
-- migration_054 shipped stayed invisible in Promoted Exercises, and
-- couldn't be found by name in the merge-target search either (that
-- search now checks aliases too, but the exercise_submissions row
-- backing "Promoted Exercises" still needs to exist in the first
-- place).
--
-- This re-runs backfill with an OR'd match against the alias array,
-- and also picks up the "is now recognized as part of the shared
-- library" notification text (migration_055's new merge-as-alias
-- notification), which the original backfill's pattern list didn't
-- include. Safe to run alongside migration_054's version -- the
-- not-exists guard means already-backfilled rows aren't duplicated,
-- so this only adds what the first pass missed.
insert into exercise_submissions (user_id, submitted_name, muscle_group, equipment, status, current_exercise_id, created_at, resolved_at)
select
  n.user_id,
  matched.submitted_name,
  e.muscle_group,
  e.equipment,
  'promoted',
  e.id,
  n.created_at,
  n.created_at
from user_notifications n
cross join lateral (
  select coalesce(
    substring(n.message from 'Your custom exercise "(.*)" was added to the shared library'),
    substring(n.message from 'Your custom exercise "(.*)" is now part of the shared library'),
    substring(n.message from 'Your custom exercise "(.*)" is now recognized as part of the shared library')
  ) as submitted_name
) matched
join exercises e
  on e.created_by is null
  and (
    lower(trim(e.name)) = lower(trim(matched.submitted_name))
    or exists (
      select 1 from unnest(coalesce(e.aliases, array[]::text[])) a
      where lower(trim(a)) = lower(trim(matched.submitted_name))
    )
  )
where matched.submitted_name is not null
  and not exists (
    select 1 from exercise_submissions es
    where es.user_id = n.user_id and es.current_exercise_id = e.id
  );
