-- Migration: admin-managed muscle group taxonomy.
-- muscle_group/primary_muscle/secondary_muscles on `exercises` were
-- always free text with no DB-level constraint — muscleLabel() and
-- MUSCLE_COLORS already fall back gracefully for any value they don't
-- recognize. What was missing was a persistent, reusable list of known
-- groups to pick from (and add to) instead of ad hoc typing every time.
create table muscle_groups (
  key text primary key,
  label text not null,
  created_at timestamptz not null default now()
);

alter table muscle_groups enable row level security;

create policy "muscle_groups_select_all" on muscle_groups for select using (true);
create policy "muscle_groups_insert_admin" on muscle_groups for insert
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
create policy "muscle_groups_delete_admin" on muscle_groups for delete
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

insert into muscle_groups (key, label) values
  ('Chest', 'Chest'), ('Back', 'Back'), ('Quads', 'Quads'), ('Shoulders', 'Shoulders'),
  ('Core', 'Core'), ('Triceps', 'Triceps'), ('Biceps', 'Biceps'), ('Glutes', 'Glutes'),
  ('Hamstrings', 'Hamstrings'), ('Full Body', 'Full Body'), ('Calves', 'Calves'),
  ('Forearms', 'Forearms'), ('Rear Delts', 'Rear Delts'), ('Traps', 'Traps')
on conflict (key) do nothing;
