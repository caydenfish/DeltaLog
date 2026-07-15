-- Migration: auto-dismiss the "New custom exercise submitted" admin
-- notification once that submission has been addressed (promoted,
-- merged, or dismissed), instead of leaving it sitting in the
-- Announcements panel for every admin to clear by hand.
--
-- 1. Tag the notification with which exercise it's about, so it can be
--    found and removed later. Nullable + ON DELETE SET NULL since the
--    row it points at is sometimes deleted outright (promotion removes
--    duplicate rows), and a null tag just means "not a submission
--    notice" or "the exercise it pointed to is long gone."
alter table user_notifications
  add column related_exercise_id uuid references exercises(id) on delete set null;

create index idx_user_notifications_related_exercise on user_notifications(related_exercise_id);

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

    insert into user_notifications (user_id, message, related_exercise_id)
    select p.id, 'New custom exercise submitted: "' || new.name || '" is waiting for review.', new.id
    from profiles p
    where p.is_admin and p.id <> new.created_by;
  end if;
  return new;
end;
$$;

-- 2. Promoting resolves the target row (and any same-name duplicates
-- folded into it) — clear every admin's review notice for all of them.
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
  resolved_ids uuid[] := array[target_id];
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
    resolved_ids := resolved_ids || dup.id;

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

  delete from user_notifications where related_exercise_id = any(resolved_ids);
end;
$$;

grant execute on function admin_promote_exercise(uuid) to authenticated;

-- 3. Merging-as-alias resolves just the one submission row.
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

  delete from user_notifications where related_exercise_id = submission_id;
end;
$$;

grant execute on function admin_merge_exercise_alias(uuid, uuid) to authenticated;

-- 4. Dismissing a submission (not promoting or merging it — just
-- clearing it from the queue as-is) used to be two plain client-side
-- updates with no notification cleanup at all. Folded into a
-- security-definer RPC, matching the other two review actions, so the
-- review-notice cleanup happens the same way everywhere.
create or replace function admin_dismiss_exercise_submission(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'Not authorized';
  end if;

  update exercises set admin_reviewed = true where id = target_id;

  update exercise_submissions
  set status = 'dismissed', resolved_at = now()
  where current_exercise_id = target_id
    and status = 'pending';

  delete from user_notifications where related_exercise_id = target_id;
end;
$$;

grant execute on function admin_dismiss_exercise_submission(uuid) to authenticated;
