-- migration_077: group workout lobby (app v1.20.0)
--
-- Group workouts used to drop everyone straight into their own empty
-- workout. Now a session starts in a lobby: the host picks a plan (from
-- scratch or one of their templates), friends join and show as Ready, and
-- the host starts it for everyone. Everyone who joined gets the same
-- exercises loaded. While it's live, exercises the host adds are pushed to
-- everyone else (host-led sync); members can still add their own.
--
-- group_sessions.status   'lobby' -> 'active' -> 'ended'
-- group_sessions.plan     {kind: 'scratch'} or {kind: 'template', template_id,
--                         name, exercises: [{exercise_id, planned_sets,
--                         planned_warmup_sets, superset_group, rep_scheme}]}.
--                         A snapshot, so members never need to read the
--                         host's templates.
-- group_sessions.host_exercises  the host's live exercise list once the
--                         workout is running: [{exercise_id, planned_sets,
--                         planned_warmup_sets}] in workout order.
--
-- Requires migration_076. Safe to run more than once.

alter table public.group_sessions drop constraint if exists group_sessions_status_check;
alter table public.group_sessions add constraint group_sessions_status_check
  check (status in ('lobby', 'active', 'ended'));
alter table public.group_sessions alter column status set default 'lobby';
alter table public.group_sessions add column if not exists plan jsonb not null default '{"kind": "scratch"}';
alter table public.group_sessions add column if not exists host_exercises jsonb not null default '[]';
alter table public.group_sessions add column if not exists started_at timestamptz;

-- Host creates a session (in the lobby) and invites friends in one call.
create or replace function public.create_group_session(p_friend_ids uuid[])
returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid; fid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if coalesce(array_length(p_friend_ids, 1), 0) = 0 then raise exception 'Pick at least one friend'; end if;
  if array_length(p_friend_ids, 1) > 7 then raise exception 'Groups are limited to 8 people'; end if;
  -- One open lobby per host: close any older one they walked away from.
  update group_sessions set status = 'ended', ended_at = now()
    where host_id = auth.uid() and status = 'lobby';
  insert into group_sessions (host_id, status) values (auth.uid(), 'lobby') returning id into sid;
  insert into group_session_members (session_id, user_id, status, joined_at) values (sid, auth.uid(), 'joined', now());
  foreach fid in array p_friend_ids loop
    if not public.are_friends(auth.uid(), fid) then raise exception 'You can only invite friends'; end if;
    insert into group_session_members (session_id, user_id) values (sid, fid) on conflict do nothing;
  end loop;
  return sid;
end $$;

-- Host adds more friends from the lobby or mid-workout.
create or replace function public.invite_to_group_session(p_session uuid, p_friend_ids uuid[])
returns void
language plpgsql security definer set search_path = public as $$
declare fid uuid; s record; n int;
begin
  select * into s from group_sessions where id = p_session;
  if not found or s.host_id <> auth.uid() then raise exception 'Only the host can invite'; end if;
  if s.status = 'ended' then raise exception 'That group workout has ended'; end if;
  foreach fid in array coalesce(p_friend_ids, '{}') loop
    if not public.are_friends(auth.uid(), fid) then raise exception 'You can only invite friends'; end if;
    -- Re-inviting someone who declined puts them back to invited.
    insert into group_session_members (session_id, user_id) values (p_session, fid)
      on conflict (session_id, user_id) do update set status = 'invited', invited_at = now()
      where group_session_members.status = 'declined';
  end loop;
  select count(*) into n from group_session_members where session_id = p_session and status in ('invited', 'joined');
  if n > 8 then raise exception 'Groups are limited to 8 people'; end if;
end $$;

-- Host sets the plan while still in the lobby.
create or replace function public.set_group_plan(p_session uuid, p_plan jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_plan->>'kind', '') not in ('scratch', 'template') then raise exception 'Bad plan'; end if;
  update group_sessions set plan = p_plan
    where id = p_session and host_id = auth.uid() and status = 'lobby';
  if not found then raise exception 'The plan can only be changed in the lobby'; end if;
end $$;

-- Host starts the workout for everyone who's in.
create or replace function public.start_group_session(p_session uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare p jsonb;
begin
  update group_sessions set status = 'active', started_at = now()
    where id = p_session and host_id = auth.uid() and status = 'lobby'
    returning plan into p;
  if not found then raise exception 'That lobby is closed'; end if;
  return p;
end $$;

-- Host's live exercise list, read by everyone else for host-led sync.
create or replace function public.set_group_host_exercises(p_session uuid, p_exercises jsonb)
returns void
language sql security definer set search_path = public as $$
  update group_sessions set host_exercises = coalesce(p_exercises, '[]')
    where id = p_session and host_id = auth.uid() and status = 'active';
$$;

-- Accept an invite (and optionally attach the workout being logged).
-- Works in the lobby or once the workout is running. Now returns the
-- session status, so the return type changed: drop first.
drop function if exists public.join_group_session(uuid, uuid);
create function public.join_group_session(p_session uuid, p_workout uuid default null)
returns text
language plpgsql security definer set search_path = public as $$
declare st text;
begin
  select status into st from group_sessions where id = p_session;
  if st is null or st = 'ended' then raise exception 'That group workout has ended'; end if;
  update group_session_members
    set status = 'joined', joined_at = coalesce(joined_at, now()), workout_id = coalesce(p_workout, workout_id)
    where session_id = p_session and user_id = auth.uid() and status in ('invited', 'joined');
  if not found then raise exception 'That group workout has ended'; end if;
  return st;
end $$;

-- p_status: 'finished' (done lifting) or 'declined' (said no / left early).
-- The host leaving the lobby closes it for everyone. Otherwise the session
-- ends once nobody is still joined or invited.
create or replace function public.leave_group_session(p_session uuid, p_status text default 'finished')
returns void
language plpgsql security definer set search_path = public as $$
declare s record;
begin
  if p_status not in ('finished', 'declined') then raise exception 'Bad status'; end if;
  update group_session_members set status = p_status
    where session_id = p_session and user_id = auth.uid();
  select * into s from group_sessions where id = p_session;
  if s.status = 'lobby' and s.host_id = auth.uid() then
    update group_sessions set status = 'ended', ended_at = now() where id = p_session;
    return;
  end if;
  if not exists (select 1 from group_session_members where session_id = p_session and status in ('joined', 'invited')) then
    update group_sessions set status = 'ended', ended_at = now() where id = p_session and status <> 'ended';
  end if;
end $$;

-- Open invites for the caller, lobby or running (under 6 hours old).
-- Return type changed, so drop first.
drop function if exists public.get_my_group_invites();
create function public.get_my_group_invites()
returns table (session_id uuid, host_id uuid, host_first_name text, host_handle text, member_count int,
               session_status text, plan_name text, plan_exercise_count int, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, s.host_id, p.first_name, p.handle,
         (select count(*)::int from group_session_members x where x.session_id = s.id and x.status = 'joined'),
         s.status,
         case when s.plan->>'kind' = 'template' then s.plan->>'name' else null end,
         coalesce(jsonb_array_length(s.plan->'exercises'), 0),
         s.created_at
  from group_session_members m
  join group_sessions s on s.id = m.session_id
  join profiles p on p.id = s.host_id
  where m.user_id = auth.uid() and m.status = 'invited'
    and s.status in ('lobby', 'active') and s.created_at > now() - interval '6 hours'
  order by s.created_at desc;
$$;

-- A lobby the caller is sitting in (so a reload puts them back in it).
create or replace function public.get_my_open_lobby()
returns uuid
language sql stable security definer set search_path = public as $$
  select s.id from group_session_members m
  join group_sessions s on s.id = m.session_id
  where m.user_id = auth.uid() and m.status = 'joined' and m.workout_id is null
    and s.status = 'lobby' and s.created_at > now() - interval '6 hours'
  order by s.created_at desc
  limit 1;
$$;

grant execute on function public.create_group_session(uuid[]), public.invite_to_group_session(uuid, uuid[]),
  public.set_group_plan(uuid, jsonb), public.start_group_session(uuid), public.set_group_host_exercises(uuid, jsonb),
  public.join_group_session(uuid, uuid), public.leave_group_session(uuid, text), public.get_my_group_invites(),
  public.get_my_open_lobby()
  to authenticated;

-- ── Realtime ────────────────────────────────────────────────────────
-- Lobby status, plan changes and host exercises reach members live.
do $$ begin
  begin alter publication supabase_realtime add table public.group_sessions; exception when duplicate_object then null; end;
end $$;
