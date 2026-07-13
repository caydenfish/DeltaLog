-- Migration: exercise submission history log.
--
-- Until now, a custom exercise's row WAS its submission record. That
-- works fine while it's pending, but two resolution paths destroy the
-- paper trail: promoting sets created_by to null (the row still exists
-- but is no longer queryable as "theirs" anywhere), and consolidating
-- duplicate submissions during promotion deletes the duplicate row
-- outright. Neither the submitter's own library nor the admin review
-- screen can tell afterward whose work a shared-library entry actually
-- came from, or browse anything already resolved.
--
-- This table is an independent, append-only log: one row per custom
-- exercise ever submitted, snapshotting name/muscle/equipment at
-- submission time (so it still reads sensibly even if the row it
-- pointed at is later deleted), tracking status across every
-- resolution path (dismissed / promoted / merged-as-alias), and
-- pointing at whatever the current shared exercise is once resolved.
create table exercise_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  submitted_name text not null,
  muscle_group text,
  equipment text[],
  status text not null default 'pending' check (status in ('pending', 'dismissed', 'promoted', 'merged')),
  current_exercise_id uuid references exercises(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table exercise_submissions enable row level security;

create policy "exercise_submissions_select_own" on exercise_submissions for select
  using (auth.uid() = user_id);
create policy "exercise_submissions_select_admin" on exercise_submissions for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
create policy "exercise_submissions_update_admin" on exercise_submissions for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
-- No client insert policy -- rows are only ever written by the trigger
-- below (on submission) or the security-definer promote function.

create index idx_exercise_submissions_user on exercise_submissions(user_id, created_at desc);
create index idx_exercise_submissions_current_exercise on exercise_submissions(current_exercise_id);
create index idx_exercise_submissions_created on exercise_submissions(created_at desc);

-- Auto-log every custom exercise the instant it's created, so the log
-- can never drift out of sync with what actually got submitted -- no
-- client code path has to remember a second insert.
create or replace function log_exercise_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into exercise_submissions (user_id, submitted_name, muscle_group, equipment, current_exercise_id)
    values (new.created_by, new.name, new.muscle_group, new.equipment, new.id);
  end if;
  return new;
end;
$$;

create trigger trg_log_exercise_submission
  after insert on exercises
  for each row execute function log_exercise_submission();

-- Promotion now also resolves the submission log: the target's own
-- pending entry, plus (repointed to the target, since the row itself
-- is about to be deleted) every duplicate folded in alongside it. Same
-- transaction as before, only the added exercise_submissions upkeep.
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

    update exercise_submissions
    set status = 'promoted', current_exercise_id = target_id, resolved_at = now()
    where current_exercise_id = dup.id;

    delete from exercises where id = dup.id;

    insert into user_notifications (user_id, message)
    values (dup.created_by, 'Your custom exercise "' || dup.name || '" is now part of the shared library. Your workout history and templates have been updated to use the shared version automatically.');
  end loop;

  update exercises set created_by = null, admin_reviewed = true where id = target_id;

  update exercise_submissions
  set status = 'promoted', resolved_at = now()
  where current_exercise_id = target_id and status = 'pending';

  if target_creator is not null then
    insert into user_notifications (user_id, message)
    values (target_creator, 'Your custom exercise "' || target_name || '" was added to the shared library — nice catch! Everyone can use it now.');
  end if;
end;
$$;

grant execute on function admin_promote_exercise(uuid) to authenticated;
grant select on exercise_submissions to authenticated;

-- Backfill: promotions that already happened before this migration have
-- no exercise_submissions row (the trigger only fires on new inserts),
-- but the promotion notification text still records who submitted what
-- and when. Reconstruct what we can so exercises promoted before today
-- (e.g. an already-promoted "Machine Seated Hip Adduction") show up
-- under Promoted Exercises retroactively instead of staying invisible.
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
    substring(n.message from 'Your custom exercise "(.*)" is now part of the shared library')
  ) as submitted_name
) matched
join exercises e on lower(trim(e.name)) = lower(trim(matched.submitted_name))
where matched.submitted_name is not null
  and e.created_by is null
  and not exists (
    select 1 from exercise_submissions es
    where es.user_id = n.user_id and es.current_exercise_id = e.id
  );
