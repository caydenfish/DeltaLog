-- Lost-workout diagnostic (v1.23.0). Run in the Supabase SQL editor.
-- Shows your 15 most recent workouts with how many exercise slots and
-- sets each one still has, so you can tell whether the data from a
-- "vanished" workout is still on the server or was deleted.
--
-- Change the handle below if you're checking someone else's account.

with me as (
  select id from public.profiles where handle = 'deltalogdev'
)
select
  w.id,
  w.started_at at time zone 'America/Denver'   as started_local,
  w.completed_at at time zone 'America/Denver' as completed_local,
  w.paused_at is not null                      as is_paused,
  count(distinct we.id)                        as exercise_slots,
  count(s.id)                                  as sets,
  max(s.created_at) at time zone 'America/Denver' as last_set_local
from public.workouts w
left join public.workout_exercises we on we.workout_id = w.id
left join public.sets s on s.workout_exercise_id = we.id
where w.user_id = (select id from me)
group by w.id
order by w.started_at desc
limit 15;

-- How to read it:
--   * An unfinished row (completed_local is null) with sets > 0 is the
--     lost workout, still intact. After v1.23.0 deploys, opening the app
--     picks it up and offers to resume it.
--   * An unfinished row with exercise_slots = 0 is an empty start. Before
--     v1.23.0 one of these sitting on top hid the real workout.
--   * No row from the lift with sets > 0 means it was deleted (cascade),
--     not hidden. That points at the old delete-everything-unfinished
--     call, triggered by "Resume previous workout" or backing out of the
--     empty "Start a workout" screen.
