-- Fix: the admin "Dismiss" button on a custom-exercise submission could
-- silently do nothing. admin_dismiss_exercise_submission (migration_061)
-- never checked whether its update actually touched a row — a Postgres
-- UPDATE ... WHERE id = <no match> is not an error, it's just zero rows
-- affected. The client optimistically removed the row from view either
-- way (see AdminExercises.jsx's dismiss()), so it looked dismissed for
-- that session but nothing was actually committed, and it reappeared on
-- the next fetch/reload. Now raises an explicit exception if the target
-- row wasn't found so a genuine failure surfaces instead of hiding
-- behind the optimistic UI update.
create or replace function admin_dismiss_exercise_submission(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int;
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'Not authorized';
  end if;

  update exercises set admin_reviewed = true where id = target_id;
  get diagnostics affected = row_count;
  if affected = 0 then
    raise exception 'Exercise not found — it may have already been resolved.';
  end if;

  update exercise_submissions
  set status = 'dismissed', resolved_at = now()
  where current_exercise_id = target_id
    and status = 'pending';

  delete from user_notifications where related_exercise_id = target_id;
end;
$$;

grant execute on function admin_dismiss_exercise_submission(uuid) to authenticated;
