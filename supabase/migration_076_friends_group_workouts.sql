-- migration_076: friends, user IDs and group workouts (app v1.17.0)
--
-- profiles.handle      the public user ID people search by (@handle)
-- friendships          one row per pair, pending -> accepted
-- friend_groups        saved groups of friends, private to their owner
-- group_sessions       one live group workout
-- group_session_members  who was invited / joined / finished
-- group_session_lifts  per member, per exercise snapshot of logged sets;
--                      the live feed friends read (Realtime)
--
-- Profiles stay own-row-only under RLS. Everything that has to show
-- another person's name or handle goes through the security definer
-- functions below, which return only first name, last initial and handle,
-- never body stats. Safe to run more than once.

-- ── Handles ─────────────────────────────────────────────────────────
alter table public.profiles add column if not exists handle text;
alter table public.profiles add column if not exists handle_changed_at timestamptz;
create unique index if not exists profiles_handle_unique on public.profiles (lower(handle));

-- Sets or changes the caller's handle. 3-20 chars, a-z 0-9 _ and .,
-- starting with a letter or digit. After the first pick, changes are
-- limited to one per 7 days so a freed-up handle can't be grabbed and
-- worn by someone else mid-conversation.
create or replace function public.set_my_handle(p_handle text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v text := lower(ltrim(trim(p_handle), '@'));
  cur record;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if v !~ '^[a-z0-9][a-z0-9_.]{2,19}$' then
    raise exception 'IDs are 3-20 characters: letters, numbers, _ and .';
  end if;
  select handle, handle_changed_at into cur from profiles where id = auth.uid();
  if cur.handle is not null and lower(cur.handle) = v then return v; end if;
  if cur.handle is not null and cur.handle_changed_at > now() - interval '7 days' then
    raise exception 'You can change your ID once a week';
  end if;
  if exists (select 1 from profiles where lower(handle) = v and id <> auth.uid()) then
    raise exception 'That ID is taken';
  end if;
  update profiles
    set handle = v,
        handle_changed_at = case when cur.handle is null then null else now() end
    where id = auth.uid();
  return v;
end $$;

-- ── Friendships ─────────────────────────────────────────────────────
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);
create unique index if not exists friendships_pair_unique
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
alter table public.friendships enable row level security;
drop policy if exists friendships_select_own on public.friendships;
create policy friendships_select_own on public.friendships for select
  using (auth.uid() in (requester_id, addressee_id));
drop policy if exists friendships_delete_own on public.friendships;
create policy friendships_delete_own on public.friendships for delete
  using (auth.uid() in (requester_id, addressee_id));
-- Inserts and accepts go through the functions below.

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and least(requester_id, addressee_id) = least(a, b)
      and greatest(requester_id, addressee_id) = greatest(a, b)
  );
$$;

-- Prefix search by handle. Leading @ is ignored.
create or replace function public.search_users_by_handle(p_query text)
returns table (id uuid, handle text, first_name text, last_initial text, friendship_status text, friendship_direction text)
language sql stable security definer set search_path = public as $$
  select p.id, p.handle, p.first_name, left(coalesce(p.last_name, ''), 1),
         f.status,
         case when f.id is null then null when f.requester_id = auth.uid() then 'outgoing' else 'incoming' end
  from profiles p
  left join friendships f
    on least(f.requester_id, f.addressee_id) = least(p.id, auth.uid())
   and greatest(f.requester_id, f.addressee_id) = greatest(p.id, auth.uid())
  where auth.uid() is not null
    and p.id <> auth.uid()
    and p.handle is not null
    and length(ltrim(lower(trim(p_query)), '@')) >= 2
    and lower(p.handle) like ltrim(lower(trim(p_query)), '@') || '%'
  order by length(p.handle), p.handle
  limit 8;
$$;

-- Sends a request, or accepts one if the other person already asked.
create or replace function public.send_friend_request(p_target uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare f record;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_target = auth.uid() then raise exception 'That''s you'; end if;
  select * into f from friendships
    where least(requester_id, addressee_id) = least(p_target, auth.uid())
      and greatest(requester_id, addressee_id) = greatest(p_target, auth.uid());
  if found then
    if f.status = 'accepted' then return 'accepted'; end if;
    if f.addressee_id = auth.uid() then
      update friendships set status = 'accepted', responded_at = now() where id = f.id;
      return 'accepted';
    end if;
    return 'pending';
  end if;
  insert into friendships (requester_id, addressee_id) values (auth.uid(), p_target);
  return 'pending';
end $$;

create or replace function public.respond_friend_request(p_friendship uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_accept then
    update friendships set status = 'accepted', responded_at = now()
      where id = p_friendship and addressee_id = auth.uid() and status = 'pending';
  else
    delete from friendships
      where id = p_friendship and addressee_id = auth.uid() and status = 'pending';
  end if;
end $$;

-- Friends, incoming and outgoing requests in one list.
create or replace function public.get_my_friends()
returns table (friendship_id uuid, user_id uuid, handle text, first_name text, last_initial text, status text, direction text, last_workout_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.id, p.id, p.handle, p.first_name, left(coalesce(p.last_name, ''), 1), f.status,
         case when f.requester_id = auth.uid() then 'outgoing' else 'incoming' end,
         case when f.status = 'accepted'
              then (select max(w.completed_at) from workouts w where w.user_id = p.id)
              else null end
  from friendships f
  join profiles p on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where auth.uid() in (f.requester_id, f.addressee_id);
$$;

-- ── Saved friend groups ─────────────────────────────────────────────
create table if not exists public.friend_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  member_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.friend_groups enable row level security;
drop policy if exists friend_groups_own on public.friend_groups;
create policy friend_groups_own on public.friend_groups for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ── Group sessions ──────────────────────────────────────────────────
create table if not exists public.group_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.group_session_members (
  session_id uuid not null references public.group_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'joined', 'finished', 'declined')),
  workout_id uuid references public.workouts(id) on delete set null,
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  primary key (session_id, user_id)
);
create index if not exists group_session_members_user on public.group_session_members (user_id, status);
create index if not exists group_session_members_workout on public.group_session_members (workout_id);

create table if not exists public.group_session_lifts (
  session_id uuid not null references public.group_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  sets jsonb not null default '[]',  -- [{w: lb, r, rir, warm}] in logged order
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id, exercise_id)
);

-- Membership check used by RLS. Security definer so the policies on
-- group_session_members don't recurse into themselves.
create or replace function public.is_group_member(p_session uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_session_members
    where session_id = p_session and user_id = auth.uid() and status in ('invited', 'joined', 'finished')
  );
$$;

alter table public.group_sessions enable row level security;
alter table public.group_session_members enable row level security;
alter table public.group_session_lifts enable row level security;

drop policy if exists group_sessions_select on public.group_sessions;
create policy group_sessions_select on public.group_sessions for select
  using (public.is_group_member(id));
drop policy if exists group_session_members_select on public.group_session_members;
create policy group_session_members_select on public.group_session_members for select
  using (public.is_group_member(session_id));
drop policy if exists group_session_lifts_select on public.group_session_lifts;
create policy group_session_lifts_select on public.group_session_lifts for select
  using (public.is_group_member(session_id));
drop policy if exists group_session_lifts_write on public.group_session_lifts;
create policy group_session_lifts_write on public.group_session_lifts for insert
  with check (auth.uid() = user_id and exists (
    select 1 from public.group_session_members m
    where m.session_id = group_session_lifts.session_id and m.user_id = auth.uid() and m.status = 'joined'));
drop policy if exists group_session_lifts_update on public.group_session_lifts;
create policy group_session_lifts_update on public.group_session_lifts for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Host creates a session and invites friends in one call.
create or replace function public.create_group_session(p_friend_ids uuid[])
returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid; fid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if coalesce(array_length(p_friend_ids, 1), 0) = 0 then raise exception 'Pick at least one friend'; end if;
  if array_length(p_friend_ids, 1) > 7 then raise exception 'Groups are limited to 8 people'; end if;
  insert into group_sessions (host_id) values (auth.uid()) returning id into sid;
  insert into group_session_members (session_id, user_id, status, joined_at) values (sid, auth.uid(), 'joined', now());
  foreach fid in array p_friend_ids loop
    if not public.are_friends(auth.uid(), fid) then raise exception 'You can only invite friends'; end if;
    insert into group_session_members (session_id, user_id) values (sid, fid) on conflict do nothing;
  end loop;
  return sid;
end $$;

-- Accept an invite (and optionally attach the workout being logged).
create or replace function public.join_group_session(p_session uuid, p_workout uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update group_session_members
    set status = 'joined', joined_at = coalesce(joined_at, now()), workout_id = coalesce(p_workout, workout_id)
    where session_id = p_session and user_id = auth.uid() and status in ('invited', 'joined');
  if not found then raise exception 'That group workout has ended'; end if;
end $$;

create or replace function public.attach_group_workout(p_session uuid, p_workout uuid)
returns void
language sql security definer set search_path = public as $$
  update group_session_members set workout_id = p_workout
    where session_id = p_session and user_id = auth.uid()
      and exists (select 1 from workouts w where w.id = p_workout and w.user_id = auth.uid());
$$;

-- p_status: 'finished' (done lifting) or 'declined' (said no / left early).
-- The session ends once nobody is still joined or invited.
create or replace function public.leave_group_session(p_session uuid, p_status text default 'finished')
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('finished', 'declined') then raise exception 'Bad status'; end if;
  update group_session_members set status = p_status
    where session_id = p_session and user_id = auth.uid();
  if not exists (select 1 from group_session_members where session_id = p_session and status in ('joined', 'invited')) then
    update group_sessions set status = 'ended', ended_at = now() where id = p_session and status = 'active';
  end if;
end $$;

-- Who is in a session, with display names. Members only.
create or replace function public.get_group_session_members(p_session uuid)
returns table (user_id uuid, handle text, first_name text, last_initial text, status text, is_host boolean)
language sql stable security definer set search_path = public as $$
  select m.user_id, p.handle, p.first_name, left(coalesce(p.last_name, ''), 1), m.status, s.host_id = m.user_id
  from group_session_members m
  join group_sessions s on s.id = m.session_id
  join profiles p on p.id = m.user_id
  where m.session_id = p_session and public.is_group_member(p_session)
  order by m.invited_at;
$$;

-- Open invites for the caller (sessions under 6 hours old, still active).
create or replace function public.get_my_group_invites()
returns table (session_id uuid, host_first_name text, host_handle text, member_count int, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, p.first_name, p.handle,
         (select count(*)::int from group_session_members x where x.session_id = s.id and x.status in ('joined', 'invited')),
         s.created_at
  from group_session_members m
  join group_sessions s on s.id = m.session_id
  join profiles p on p.id = s.host_id
  where m.user_id = auth.uid() and m.status = 'invited'
    and s.status = 'active' and s.created_at > now() - interval '6 hours'
  order by s.created_at desc;
$$;

-- The session a workout belongs to, if it's still live (used on resume).
create or replace function public.get_group_session_for_workout(p_workout uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select m.session_id from group_session_members m
  join group_sessions s on s.id = m.session_id
  where m.workout_id = p_workout and m.user_id = auth.uid() and m.status = 'joined' and s.status = 'active'
  limit 1;
$$;

grant execute on function public.set_my_handle(text), public.search_users_by_handle(text),
  public.send_friend_request(uuid), public.respond_friend_request(uuid, boolean), public.get_my_friends(),
  public.create_group_session(uuid[]), public.join_group_session(uuid, uuid), public.attach_group_workout(uuid, uuid),
  public.leave_group_session(uuid, text), public.get_group_session_members(uuid), public.get_my_group_invites(),
  public.get_group_session_for_workout(uuid)
  to authenticated;

-- ── Realtime ────────────────────────────────────────────────────────
do $$ begin
  begin alter publication supabase_realtime add table public.group_session_lifts; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.group_session_members; exception when duplicate_object then null; end;
end $$;
