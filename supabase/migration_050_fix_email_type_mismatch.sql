-- Fixes "structure of query does not match function result type" on both
-- admin_search_users() and admin_get_user_activity().
--
-- Root cause: auth.users.email is `character varying`, not `text`. Both
-- functions declare their return column as `email text` but selected
-- u.email straight through with no cast, so Postgres rejected the query
-- shape at call time. Only fix needed is casting u.email::text in each.

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
    select u.id, u.email::text, p.first_name, p.last_name, coalesce(p.is_admin, false), coalesce(p.is_creator, false)
    from auth.users u
    join profiles p on p.id = u.id
    where query is null or query = '' or u.email ilike '%' || query || '%'
       or p.first_name ilike '%' || query || '%'
       or p.last_name ilike '%' || query || '%'
    order by u.email
    limit 25;
end;
$$;

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
      u.email::text,
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

grant execute on function admin_search_users(text) to authenticated;
grant execute on function admin_get_user_activity() to authenticated;
