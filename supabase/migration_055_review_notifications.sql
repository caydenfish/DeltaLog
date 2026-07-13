-- Migration: admin review notifications + notified merge-as-alias.
--
-- 1. Every new custom exercise submission now also notifies every admin
--    via the existing personal user_notifications system (surfaced in
--    the Announcements panel, same place promotion notices show up) --
--    there was previously no signal at all that something was waiting
--    in the review queue short of opening the screen and checking.
--    Excludes the submitter themselves in the (rare) case an admin
--    submits their own custom exercise.
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

    insert into user_notifications (user_id, message)
    select p.id, 'New custom exercise submitted: "' || new.name || '" is waiting for review.'
    from profiles p
    where p.is_admin and p.id <> new.created_by;
  end if;
  return new;
end;
$$;

-- 2. Merging a submission as an alias of an existing library exercise
-- used to be three separate client-side calls with no notification to
-- the submitter at all -- unlike promotion, which always tells them.
-- Folded into one security-definer function so it's atomic and can
-- notify them the same way. Behavior is otherwise unchanged: the
-- submission's own exercise row is untouched (the submitter keeps using
-- their own copy), it's just recorded as a search alias of the target
-- and marked reviewed so it drops out of the queue.
create or replace function admin_merge_exercise_alias(submission_id uuid, target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sub_name text;
  sub_creator uuid;
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'Not authorized';
  end if;

  select name, created_by into sub_name, sub_creator from exercises where id = submission_id;
  if sub_name is null then
    raise exception 'Submission not found';
  end if;

  -- Fold the submitted name in as a search alias of the target,
  -- case/whitespace-insensitive de-duped so re-merging the same name
  -- twice doesn't pile up duplicate aliases.
  update exercises
  set aliases = case
    when exists (select 1 from unnest(coalesce(aliases, array[]::text[])) a where lower(trim(a)) = lower(trim(sub_name))) then aliases
    else coalesce(aliases, array[]::text[]) || array[sub_name]
  end
  where id = target_id;

  update exercises set admin_reviewed = true where id = submission_id;

  update exercise_submissions
  set status = 'merged', current_exercise_id = target_id, resolved_at = now()
  where current_exercise_id = submission_id;

  if sub_creator is not null then
    insert into user_notifications (user_id, message)
    values (sub_creator, 'Your custom exercise "' || sub_name || '" is now recognized as part of the shared library — it was combined with an existing exercise, so anyone searching for either name will find it.');
  end if;
end;
$$;

grant execute on function admin_merge_exercise_alias(uuid, uuid) to authenticated;

-- 3. Dismissible notifications and announcements. Personal notifications
-- (user_notifications) are owned outright by the recipient, so dismiss
-- is just a delete -- there was previously no delete policy at all,
-- only select/update (for marking read).
create policy "user_notifications_delete_own" on user_notifications for delete
  using (auth.uid() = user_id);

-- Announcements are a single shared row broadcast to everyone, so one
-- user dismissing it can't touch the row itself -- it needs its own
-- per-user tracking table, mirroring the read_at pattern but scoped
-- per (announcement, user) instead of being a single column on a
-- shared row.
create table announcement_dismissals (
  announcement_id uuid not null references announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

alter table announcement_dismissals enable row level security;

create policy "announcement_dismissals_select_own" on announcement_dismissals for select
  using (auth.uid() = user_id);
create policy "announcement_dismissals_insert_own" on announcement_dismissals for insert
  with check (auth.uid() = user_id);

create index idx_announcement_dismissals_user on announcement_dismissals(user_id);

