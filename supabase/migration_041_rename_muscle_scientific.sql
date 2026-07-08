-- Migration: renaming a scientific muscle name used to be blocked
-- entirely, since exercises store primary_muscles/secondary_muscles as
-- raw text arrays rather than a real foreign key -- a bare UPDATE on
-- muscle_taxonomy.scientific_name would silently orphan every exercise
-- already tagged with the old name. This RPC does the rename and the
-- cascade in one transaction: the taxonomy row's key changes, and every
-- exercise referencing the old name in either muscle array gets
-- repointed to the new one, so nothing goes stale.
create or replace function admin_rename_muscle_scientific(old_name text, new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  trimmed_new text := trim(new_name);
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'Not authorized';
  end if;

  if trimmed_new = '' then
    raise exception 'Name cannot be empty';
  end if;

  if trimmed_new = old_name then
    return;
  end if;

  if exists (select 1 from muscle_taxonomy where scientific_name = trimmed_new) then
    raise exception 'A scientific entry named "%" already exists', trimmed_new;
  end if;

  update muscle_taxonomy set scientific_name = trimmed_new where scientific_name = old_name;

  update exercises set primary_muscles = array_replace(primary_muscles, old_name, trimmed_new)
    where old_name = any(primary_muscles);

  update exercises set secondary_muscles = array_replace(secondary_muscles, old_name, trimmed_new)
    where old_name = any(secondary_muscles);
end;
$$;

grant execute on function admin_rename_muscle_scientific(text, text) to authenticated;
