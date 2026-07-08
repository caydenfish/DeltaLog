-- Migration: real percentile ranking against other users' strength scores.
--
-- This computes an actual percentile (not a qualitative band) by comparing
-- the caller's all-time best DOTS score against every other eligible
-- user's all-time best DOTS score. It's exposed as a single RPC,
-- get_dots_percentile(), that takes no arguments and only ever returns a
-- number for the CALLING user (via auth.uid()) — it never returns or
-- exposes any other user's raw data, lift numbers, or identity. The
-- underlying per-user data stays behind RLS as normal; this function is
-- security definer specifically so it can compute the aggregate without
-- each user needing read access to everyone else's rows.
--
-- Privacy floor: returns null unless at least 5 users are in the
-- comparison pool, so a percentile is never computed against a handful of
-- identifiable people.

-- Mirrors the e1RM estimate used client-side (src/SetLogger.jsx e1RM()).
create or replace function public.e1rm(weight numeric, reps numeric, rir numeric)
returns numeric
language sql
immutable
as $$
  select
    case
      when weight is null or reps is null then 0
      when weight <= 0 or (reps + coalesce(rir, 0)) <= 0 then 0
      when (reps + coalesce(rir, 0)) = 1 then weight
      when (reps + coalesce(rir, 0)) <= 6 then weight / (1.0278 - 0.0278 * (reps + coalesce(rir, 0)))
      else weight * (1 + (reps + coalesce(rir, 0)) / 30.0)
    end;
$$;

-- Mirrors the DOTS formula used client-side (src/lib/dots.js computeDOTS()).
create or replace function public.dots_score(lift_lb numeric, bodyweight_lb numeric, gender text)
returns numeric
language sql
immutable
as $$
  with coeff as (
    select
      case lower(gender) when 'male' then -0.000001093 when 'female' then -0.0000010706 end as a,
      case lower(gender) when 'male' then 0.0007391293 when 'female' then 0.0005158568 end as b,
      case lower(gender) when 'male' then -0.1918759221 when 'female' then -0.1126655495 end as c,
      case lower(gender) when 'male' then 24.0900756 when 'female' then 13.6175032 end as d,
      case lower(gender) when 'male' then -307.75076 when 'female' then 57.96288 end as e
  ),
  conv as (
    select
      least(greatest(bodyweight_lb * 0.45359237, 40), 200) as bw,
      lift_lb * 0.45359237 as lift
  )
  select
    case
      when lower(gender) not in ('male', 'female') then null
      when lift_lb is null or bodyweight_lb is null or lift_lb <= 0 or bodyweight_lb <= 0 then null
      when (coeff.a * conv.bw ^ 4 + coeff.b * conv.bw ^ 3 + coeff.c * conv.bw ^ 2 + coeff.d * conv.bw + coeff.e) <= 0 then null
      else round((conv.lift * 500) / (coeff.a * conv.bw ^ 4 + coeff.b * conv.bw ^ 3 + coeff.c * conv.bw ^ 2 + coeff.d * conv.bw + coeff.e), 1)
    end
  from coeff, conv;
$$;

-- Returns the calling user's percentile (0-100) among all users' all-time
-- best DOTS scores, or null if they're not eligible (no gender/weight, no
-- qualifying lift) or the comparison pool is too small to be meaningful.
create or replace function public.get_dots_percentile()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with best_lift as (
    select w.user_id, max(public.e1rm(s.weight, s.reps, s.rir)) as best_e1rm
    from sets s
    join workout_exercises we on we.id = s.workout_exercise_id
    join workouts w on w.id = we.workout_id
    where w.completed_at is not null
    group by w.user_id
  ),
  pool as (
    select p.id as user_id, public.dots_score(bl.best_e1rm, p.weight, p.gender) as dots
    from best_lift bl
    join profiles p on p.id = bl.user_id
    where p.gender is not null and p.weight is not null
  ),
  valid as (
    select * from pool where dots is not null
  ),
  me as (
    select dots from valid where user_id = auth.uid()
  )
  select
    case
      when (select dots from me) is null then null
      when (select count(*) from valid) < 5 then null
      else round(
        100.0 * (select count(*) from valid where dots <= (select dots from me))
        / (select count(*) from valid),
        1
      )
    end;
$$;

revoke all on function public.get_dots_percentile() from public;
revoke all on function public.get_dots_percentile() from anon;
grant execute on function public.get_dots_percentile() to authenticated;
