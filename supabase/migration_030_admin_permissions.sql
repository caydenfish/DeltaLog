-- Migration: admin user-permission management.
-- profiles' RLS is intentionally locked to "own row only," so an admin
-- can't see or edit other users' profile rows directly through the
-- client. These two functions are the narrow, audited exception:
-- security definer (so they can see across all users) but each checks
-- the CALLER is already an admin before doing anything, and each only
-- exposes/touches exactly what's needed for permission management
-- (id, email, name, is_admin) — not full profile access.

create or replace function admin_search_users(query text)
returns table (id uuid, email text, first_name text, last_name text, is_admin boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'Not authorized';
  end if;

  return query
    select u.id, u.email, p.first_name, p.last_name, coalesce(p.is_admin, false)
    from auth.users u
    join profiles p on p.id = u.id
    where query is null or query = '' or u.email ilike '%' || query || '%'
       or p.first_name ilike '%' || query || '%'
       or p.last_name ilike '%' || query || '%'
    order by u.email
    limit 25;
end;
$$;

create or replace function admin_set_is_admin(target_user_id uuid, make_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'Not authorized';
  end if;
  update profiles set is_admin = make_admin where id = target_user_id;
end;
$$;

grant execute on function admin_search_users(text) to authenticated;
grant execute on function admin_set_is_admin(uuid, boolean) to authenticated;
