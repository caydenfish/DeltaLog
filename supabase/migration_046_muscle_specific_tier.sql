-- Migration: fourth taxonomy tier ("Specific" -- e.g. "Triceps Long
-- Head") sitting between Detailed and Scientific. Full hierarchy after
-- this migration:
--
--   muscle_groups (General: Chest, Back, Legs...)
--   <- muscle_detailed (Detailed: Triceps, Biceps, Quads...)
--   <- muscle_specific (Specific: Triceps Long Head, Triceps Short Head...) [NEW]
--   <- muscle_taxonomy (Scientific: exact anatomical name, what actually
--       gets stored in exercises.primary_muscles/secondary_muscles)
--
-- Defensive/idempotent: whether migration_040 (the 3-tier split) has
-- actually been applied to this database yet is unconfirmed as of this
-- writing, on top of an even older flat shape (migration_034/036,
-- detailed_name/generic_group directly on muscle_taxonomy). This
-- migration detects whichever shape is currently live and brings it up
-- to the full 4-tier structure in one pass, so it's safe to run
-- regardless of which earlier migrations actually landed.

-- Step 1: if muscle_detailed doesn't exist yet, this DB is still on the
-- old flat shape -- bring it up to 3-tier first (this is exactly what
-- migration_040 does).
do $$
begin
  if not exists (select 1 from information_schema.tables where table_name = 'muscle_detailed') then
    create table muscle_detailed (
      key text primary key,
      label text not null,
      generic_group text not null references muscle_groups(key),
      created_at timestamptz not null default now()
    );
    alter table muscle_detailed enable row level security;
    create policy "muscle_detailed_select_all" on muscle_detailed for select using (true);
    create policy "muscle_detailed_insert_admin" on muscle_detailed for insert
      with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
    create policy "muscle_detailed_update_admin" on muscle_detailed for update
      using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
    create policy "muscle_detailed_delete_admin" on muscle_detailed for delete
      using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

    insert into muscle_detailed (key, label, generic_group)
    select distinct on (detailed_name)
      lower(regexp_replace(trim(detailed_name), '[^a-zA-Z0-9]+', '_', 'g')),
      detailed_name,
      generic_group
    from muscle_taxonomy
    on conflict (key) do nothing;

    alter table muscle_taxonomy add column if not exists detailed_key text references muscle_detailed(key);

    update muscle_taxonomy mt
    set detailed_key = md.key
    from muscle_detailed md
    where md.label = mt.detailed_name and mt.detailed_key is null;

    alter table muscle_taxonomy alter column detailed_key set not null;
    alter table muscle_taxonomy drop column if exists detailed_name;
    alter table muscle_taxonomy drop column if exists generic_group;
  end if;
end $$;

-- Step 2: the new Specific tier, nested under Detailed.
create table if not exists muscle_specific (
  key text primary key,
  label text not null,
  detailed_key text not null references muscle_detailed(key),
  created_at timestamptz not null default now()
);

alter table muscle_specific enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'muscle_specific' and policyname = 'muscle_specific_select_all') then
    create policy "muscle_specific_select_all" on muscle_specific for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'muscle_specific' and policyname = 'muscle_specific_insert_admin') then
    create policy "muscle_specific_insert_admin" on muscle_specific for insert
      with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'muscle_specific' and policyname = 'muscle_specific_update_admin') then
    create policy "muscle_specific_update_admin" on muscle_specific for update
      using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'muscle_specific' and policyname = 'muscle_specific_delete_admin') then
    create policy "muscle_specific_delete_admin" on muscle_specific for delete
      using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
  end if;
end $$;

-- Step 3: seed one default "General" Specific bucket per existing
-- Detailed group, so every current Scientific entry has somewhere to
-- point without being orphaned. These are placeholders, not real
-- subdivisions -- the whole point of this migration is to give you a
-- clean structure to split real ones out of (e.g. pull "Triceps Long
-- Head" and "Triceps Short Head" out of "Triceps (General)") by hand
-- from the admin screen, exercise by exercise, at your own pace.
insert into muscle_specific (key, label, detailed_key)
select md.key || '_general', md.label || ' (General)', md.key
from muscle_detailed md
on conflict (key) do nothing;

alter table muscle_taxonomy add column if not exists specific_key text references muscle_specific(key);

update muscle_taxonomy mt
set specific_key = (mt.detailed_key || '_general')
where mt.specific_key is null;

alter table muscle_taxonomy alter column specific_key set not null;
alter table muscle_taxonomy drop column if exists detailed_key;

-- Step 4: repair the rename RPC regardless -- reported missing from
-- PostgREST's schema cache; this is a safe no-op if it's already fine,
-- and supersedes migration_045 (harmless to also run that one first).
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

notify pgrst, 'reload schema';
