-- Migration: admin-managed workout splits (Push/Pull/Legs/Upper/Lower/
-- Full Body), replacing the hardcoded SPLITS constant in lib/splits.js.
-- Two tables: `splits` holds the split itself (name + display order),
-- `split_muscles` is the many-to-many join to muscle_groups -- a muscle
-- can belong to more than one split (e.g. Shoulders under both Push and
-- Pull), and a split can have any number of muscles. Seeded from the
-- current SPLITS constant so existing behavior is unchanged until an
-- admin edits something.

create table splits (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table splits enable row level security;

create policy "splits_select_all" on splits for select using (true);
create policy "splits_insert_admin" on splits for insert
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
create policy "splits_update_admin" on splits for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
create policy "splits_delete_admin" on splits for delete
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

create table split_muscles (
  split_id uuid not null references splits(id) on delete cascade,
  muscle_group text not null references muscle_groups(key),
  primary key (split_id, muscle_group)
);

alter table split_muscles enable row level security;

create policy "split_muscles_select_all" on split_muscles for select using (true);
create policy "split_muscles_insert_admin" on split_muscles for insert
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
create policy "split_muscles_delete_admin" on split_muscles for delete
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

insert into splits (name, sort_order) values
  ('Push', 0), ('Pull', 1), ('Legs', 2), ('Upper', 3), ('Lower', 4), ('Full Body', 5)
on conflict (name) do nothing;

insert into split_muscles (split_id, muscle_group)
select s.id, v.muscle
from splits s
join (values
  ('Push', 'Chest'), ('Push', 'Shoulders'), ('Push', 'Arms'),
  ('Pull', 'Back'), ('Pull', 'Shoulders'), ('Pull', 'Arms'),
  ('Legs', 'Legs'),
  ('Upper', 'Chest'), ('Upper', 'Back'), ('Upper', 'Shoulders'), ('Upper', 'Arms'),
  ('Lower', 'Legs'),
  ('Full Body', 'Chest'), ('Full Body', 'Back'), ('Full Body', 'Shoulders'), ('Full Body', 'Legs'), ('Full Body', 'Core'), ('Full Body', 'Arms')
) as v(split_name, muscle) on v.split_name = s.name
on conflict do nothing;
