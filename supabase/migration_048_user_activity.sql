-- User activity tracking for the admin dashboard.
--
-- Two independent signals, deliberately not conflated:
--   1. last_opened_at  — the app loaded in their browser/PWA. Fires on
--      every mount regardless of what they do inside. Tracked here via
--      user_activity_log, upserted client-side on load.
--   2. last_set_at     — the most recent row in `sets`. Means they were
--      actually mid-workout entering weight/reps. The strongest signal
--      of real usage. Derived, not stored — always computed live from
--      the sets table via the join below.
--
-- auth.users isn't exposed to PostgREST, so reading it (for email/
-- display name) has to go through a security-definer function, same
-- pattern as admin_search_users in migration_030.

create table if not exists public.user_activity_log (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_opened_at timestamptz not null default now()
);

alter table public.user_activity_log enable row level security;

-- Anyone can upsert their own row (and only their own) — this is what
-- the client calls on app load. No admin check needed here since it's
-- self-service logging, not reading other people's data.
create policy "users can upsert own activity log"
  on public.user_activity_log
  for insert
  with check (auth.uid() = user_id);

create policy "users can update own activity log"
  on public.user_activity_log
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No select policy — reading is admin-only, done through the function
-- below, which runs as security definer and bypasses RLS entirely.

create or replace function admin_get_user_activity()
returns table (
  id uuid,
  display_name text,
  email text,
  created_at timestamptz,
  last_opened_at timestamptz,
  last_set_at timestamptz,
  total_sets bigint,
  total_workouts bigint,
  days_since_last_used int,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'Not authorized';
  end if;

  return query
    select
      u.id,
      coalesce(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        split_part(u.email, '@', 1)
      ) as display_name,
      u.email,
      u.created_at,
      ual.last_opened_at,
      max(s.created_at) as last_set_at,
      count(s.id) as total_sets,
      count(distinct w.id) filter (where w.completed_at is not null) as total_workouts,
      extract(day from now() - max(s.created_at))::int as days_since_last_used,
      case
        when max(s.created_at) is null then 'never used'
        when now() - max(s.created_at) <= interval '7 days' then 'active'
        when now() - max(s.created_at) <= interval '30 days' then 'at risk'
        else 'churned'
      end as status
    from auth.users u
    left join user_activity_log ual on ual.user_id = u.id
    left join workouts w on w.user_id = u.id
    left join workout_exercises we on we.workout_id = w.id
    left join sets s on s.workout_exercise_id = we.id
    group by u.id, u.raw_user_meta_data, u.email, u.created_at, ual.last_opened_at
    order by days_since_last_used asc nulls last;
end;
$$;

grant execute on function admin_get_user_activity() to authenticated;

-- Client calls this once per app load to stamp "last opened."
create or replace function log_app_open()
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into user_activity_log (user_id, last_opened_at)
  values (auth.uid(), now())
  on conflict (user_id) do update set last_opened_at = now();
end;
$$;

grant execute on function log_app_open() to authenticated;
