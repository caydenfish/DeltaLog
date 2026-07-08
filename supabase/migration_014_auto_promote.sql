-- Migration: auto-promotion. If 3+ different users independently create
-- a custom exercise with the same name, that's a strong enough signal
-- it belongs in the shared library — promote it automatically instead
-- of waiting on manual review. To change the threshold, edit the "3" in
-- the function body below and rerun this file.

create or replace function auto_promote_custom_exercise()
returns trigger as $$
declare
  distinct_creators integer;
begin
  if new.created_by is null then
    return new;
  end if;

  select count(distinct created_by) into distinct_creators
  from exercises
  where created_by is not null
    and lower(trim(name)) = lower(trim(new.name));

  if distinct_creators >= 3 then
    -- Promote this submission into the shared library.
    update exercises set created_by = null, admin_reviewed = true where id = new.id;

    -- The other independent copies are left completely alone (their
    -- creators keep using them exactly as before) — just marked
    -- reviewed so they stop cluttering the admin queue, since an
    -- equivalent now already exists in the shared library.
    update exercises
    set admin_reviewed = true
    where created_by is not null
      and lower(trim(name)) = lower(trim(new.name));
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_auto_promote_custom_exercise on exercises;
create trigger trg_auto_promote_custom_exercise
after insert on exercises
for each row execute function auto_promote_custom_exercise();
