-- Migration: promotes "detailed" from a free-text field on muscle_taxonomy
-- into its own table, so all three naming tiers (generic/detailed/
-- scientific) are independently addable, editable, and deletable instead
-- of detailed being locked to whatever string a scientific row happened
-- to be seeded with. New hierarchy: muscle_groups (generic) <-
-- muscle_detailed (detailed, FK to a generic) <- muscle_taxonomy
-- (scientific, FK to a detailed). generic_group on muscle_taxonomy is
-- now derived through detailed_key instead of being set independently,
-- so it can no longer drift out of sync with its detailed parent.

-- muscle_groups had insert/delete admin policies but no update policy --
-- renaming a generic label wasn't possible before. Fixing that here.
create policy "muscle_groups_update_admin" on muscle_groups for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

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

-- Seed muscle_detailed from whatever distinct detailed labels already
-- exist in muscle_taxonomy -- one row per unique label, keyed by a slug
-- of that label.
insert into muscle_detailed (key, label, generic_group)
select distinct on (detailed_name)
  lower(regexp_replace(trim(detailed_name), '[^a-zA-Z0-9]+', '_', 'g')),
  detailed_name,
  generic_group
from muscle_taxonomy
on conflict (key) do nothing;

-- Point each scientific entry at its detailed row.
alter table muscle_taxonomy add column if not exists detailed_key text references muscle_detailed(key);

update muscle_taxonomy mt
set detailed_key = md.key
from muscle_detailed md
where md.label = mt.detailed_name and mt.detailed_key is null;

-- detailed_key is now the source of truth; the old free-text detailed_name
-- and the denormalized generic_group (now derived via
-- detailed_key -> muscle_detailed.generic_group) are redundant.
alter table muscle_taxonomy alter column detailed_key set not null;
alter table muscle_taxonomy drop column detailed_name;
alter table muscle_taxonomy drop column generic_group;
