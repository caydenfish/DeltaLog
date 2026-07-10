-- Adds a Creator tier above Admin.
--
-- Problem this solves: admin_set_is_admin only checked "is the caller
-- already an admin," which means any admin could grant admin to anyone,
-- including themselves via someone else's session, with no single
-- source of truth for who's allowed to hand out that access. Creator
-- is a narrower, higher tier: the only role that can grant/revoke
-- Admin, and the only role that can read the user-activity dashboard
-- (migration_048). Regular admins keep everything else they had
-- (Custom Exercises, Feedback, Splits, Simulate New User, Version
-- History) — only the "grant admin" and "view usage logs" powers move
-- up to Creator.
--
-- Bootstrapping: this can't grant itself the first Creator (nothing
-- would be authorized to do it), so after running this, manually run
-- once, for your own account:
--   update profiles set is_creator = true where id = '<your-auth-uid>';

alter table public.profiles add column if not exists is_creator boolean not null default false;

-- Replaces migration_030's version: now returns is_creator too, and
-- requires the caller be an admin (unchanged) — this function is just
-- for looking people up, not granting anything, so it stays open to
-- any admin the way it already was.
create or replace function admin_search_users(query text)
returns table (id uuid, email text, first_name text, last_name text, is_admin boolean, is_creator boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'Not authorized';
  end if;

  return query
    select u.id, u.email, p.first_name, p.last_name, coalesce(p.is_admin, false), coalesce(p.is_creator, false)
    from auth.users u
    join profiles p on p.id = u.id
    where query is null or query = '' or u.email ilike '%' || query || '%'
       or p.first_name ilike '%' || query || '%'
       or p.last_name ilike '%' || query || '%'
    order by u.email
    limit 25;
end;
$$;

-- Replaces migration_030's version: caller must now be a CREATOR, not
-- just an admin, to grant or revoke admin access.
create or replace function admin_set_is_admin(target_user_id uuid, make_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_creator) then
    raise exception 'Not authorized — only a Creator can grant or remove admin access';
  end if;
  update profiles set is_admin = make_admin where id = target_user_id;
end;
$$;

-- New: grant or revoke Creator status. Creator-only, and blocks
-- removing the last remaining Creator so the account can't get locked
-- out of its own role management.
create or replace function admin_set_is_creator(target_user_id uuid, make_creator boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_creator) then
    raise exception 'Not authorized — only a Creator can grant or remove Creator access';
  end if;

  if not make_creator and (select count(*) from profiles where is_creator) <= 1 then
    raise exception 'Cannot remove the last remaining Creator';
  end if;

  update profiles set is_creator = make_creator where id = target_user_id;
end;
$$;

grant execute on function admin_search_users(text) to authenticated;
grant execute on function admin_set_is_admin(uuid, boolean) to authenticated;
grant execute on function admin_set_is_creator(uuid, boolean) to authenticated;

-- Lock down the usage dashboard from migration_048 to Creator-only.
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
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_creator) then
    raise exception 'Not authorized — Creator access required';
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
