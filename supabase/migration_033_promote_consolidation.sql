-- Migration: personal notifications + full promotion consolidation.
--
-- Personal, per-user notices — distinct from `announcements` (broadcast
-- to everyone). Used for things that only matter to one person, like
-- "your custom exercise was just promoted."
create table user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table user_notifications enable row level security;

create policy "user_notifications_select_own" on user_notifications for select
  using (auth.uid() = user_id);
create policy "user_notifications_update_own" on user_notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- No insert/delete policy for regular users — rows are only ever created
-- by the security-definer function below (or other admin server-side
-- logic), never directly by a client.

create index idx_user_notifications_user on user_notifications(user_id, created_at desc);

-- Promoting a custom exercise used to only touch the one row an admin
-- clicked "Promote" on. If two or three other users had separately
-- created their own copy of the same exercise (very common — that's
-- exactly the case the old auto-promote trigger used to catch), those
-- copies just sat there afterward as orphaned duplicates of something
-- now in the shared library, silently invisible to their owners.
--
-- This does the full job in one transaction: every other custom exercise
-- with the same name gets its workout history, templates, and
-- rest-timer/favorite defaults repointed to the promoted exercise, its
-- name/aliases folded into the promoted exercise's alias list, the
-- duplicate row itself removed, and its creator notified. The original
-- submitter gets a notification too.
create or replace function admin_promote_exercise(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_name text;
  target_creator uuid;
  dup record;
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'Not authorized';
  end if;

  select name, created_by into target_name, target_creator from exercises where id = target_id;
  if target_name is null then
    raise exception 'Exercise not found';
  end if;

  for dup in
    select id, created_by, name, aliases from exercises
    where id <> target_id
      and created_by is not null
      and lower(trim(name)) = lower(trim(target_name))
  loop
    update workout_exercises set exercise_id = target_id where exercise_id = dup.id;
    update template_exercises set exercise_id = target_id where exercise_id = dup.id;

    insert into exercise_defaults (user_id, exercise_id, setup, notes, rest_seconds, is_favorite)
    select user_id, target_id, setup, notes, rest_seconds, is_favorite
    from exercise_defaults where exercise_id = dup.id
    on conflict (user_id, exercise_id) do nothing;
    delete from exercise_defaults where exercise_id = dup.id;

    update exercises
    set aliases = array(select distinct unnest(aliases || dup.aliases || array[dup.name]))
    where id = target_id;

    delete from exercises where id = dup.id;

    insert into user_notifications (user_id, message)
    values (dup.created_by, 'Your custom exercise "' || dup.name || '" is now part of the shared library. Your workout history and templates have been updated to use the shared version automatically.');
  end loop;

  update exercises set created_by = null, admin_reviewed = true where id = target_id;

  if target_creator is not null then
    insert into user_notifications (user_id, message)
    values (target_creator, 'Your custom exercise "' || target_name || '" was added to the shared library — nice catch! Everyone can use it now.');
  end if;
end;
$$;

grant execute on function admin_promote_exercise(uuid) to authenticated;
