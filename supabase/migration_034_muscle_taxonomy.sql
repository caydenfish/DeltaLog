-- Migration: scientific muscle taxonomy.
-- The admin tagging workflow: pick the correct SCIENTIFIC muscle name for
-- an exercise's primary/secondary muscles, and every display mode
-- (generic/detailed) derives automatically from that one tag, instead of
-- being set independently and risking drift. This replaces the
-- hardcoded ALIASES map in muscleNomenclature.js with an admin-editable
-- table — same three-tier idea (scientific -> detailed -> generic), now
-- something Cayden can actually go correct row by row.
--
-- scientific_name is what gets stored in exercises.primary_muscles /
-- secondary_muscles going forward. generic_group must be one of the
-- admin-managed muscle_groups (migration_029) — the broad bucket that
-- still drives the heatmap and coloring.
create table muscle_taxonomy (
  scientific_name text primary key,
  detailed_name text not null,
  generic_group text not null references muscle_groups(key),
  created_at timestamptz not null default now()
);

alter table muscle_taxonomy enable row level security;

create policy "muscle_taxonomy_select_all" on muscle_taxonomy for select using (true);
create policy "muscle_taxonomy_insert_admin" on muscle_taxonomy for insert
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
create policy "muscle_taxonomy_update_admin" on muscle_taxonomy for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
create policy "muscle_taxonomy_delete_admin" on muscle_taxonomy for delete
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- Seeded from the existing hardcoded ALIASES/SCIENTIFIC_NAMES/DETAILED_NAMES
-- maps as a starting point — not perfectly clean (a couple of scientific
-- names had inconsistent detailed labels across different raw aliases in
-- the old data, e.g. Latissimus Dorsi was tagged both "Lats" and "Upper
-- Back" depending on which alias produced it; this seed picks one),
-- which is exactly the kind of thing the new admin screen exists to fix.
insert into muscle_taxonomy (scientific_name, detailed_name, generic_group) values
  ('Anterior Deltoid', 'Front Delts', 'Shoulders'),
  ('Biceps Brachii', 'Biceps', 'Biceps'),
  ('Biceps Femoris', 'Hamstrings', 'Hamstrings'),
  ('Brachialis', 'Brachialis', 'Biceps'),
  ('Brachioradialis', 'Forearms', 'Forearms'),
  ('Erector Spinae', 'Lower Back', 'Back'),
  ('Full Body', 'Full Body', 'Full Body'),
  ('Gastrocnemius', 'Calves', 'Calves'),
  ('Gluteus Maximus', 'Glutes', 'Glutes'),
  ('Hip Adductors', 'Adductors', 'Quads'),
  ('Iliopsoas', 'Hip Flexors', 'Quads'),
  ('Lateral Deltoid', 'Side Delts', 'Shoulders'),
  ('Latissimus Dorsi', 'Lats', 'Back'),
  ('Levator Scapulae', 'Traps', 'Traps'),
  ('Lower Pectoralis Major', 'Lower Chest', 'Chest'),
  ('Lower Trapezius', 'Lower Traps', 'Traps'),
  ('Middle Trapezius', 'Mid Traps', 'Traps'),
  ('Obliques', 'Obliques', 'Core'),
  ('Pectoralis Major', 'Chest', 'Chest'),
  ('Posterior Deltoid', 'Rear Delts', 'Rear Delts'),
  ('Quadriceps Femoris', 'Quads', 'Quads'),
  ('Rectus Abdominis', 'Abs', 'Core'),
  ('Rhomboids', 'Upper Back', 'Back'),
  ('Rotator Cuff', 'Rotator Cuff', 'Shoulders'),
  ('Serratus Anterior', 'Serratus', 'Chest'),
  ('Soleus', 'Soleus', 'Calves'),
  ('Tensor Fasciae Latae', 'Glute Medius', 'Glutes'),
  ('Teres Major', 'Lats', 'Back'),
  ('Transverse Abdominis', 'Deep Core', 'Core'),
  ('Trapezius', 'Traps', 'Traps'),
  ('Triceps Brachii', 'Triceps', 'Triceps'),
  ('Triceps Brachii (Long Head)', 'Triceps', 'Triceps'),
  ('Upper Pectoralis Major', 'Upper Chest', 'Chest'),
  ('Upper Trapezius', 'Upper Traps', 'Traps')
on conflict (scientific_name) do nothing;
