-- ============================================================================
-- migration_074_library_rebuild.sql
--
-- Rebuilds the muscle taxonomy and exercise library per the v1.13.1 review
-- sheet (no vetoes; default merges for the six custom exercises flagged
-- "Confirm"). One transaction: any failure, including the self-check at
-- the bottom, rolls everything back.
--
-- Order:
--   1. Backups (_backup_074_*), kept if you re-run so they always hold the
--      pre-migration state
--   2. mechanism / pattern columns re-added (dropped by migration_037)
--   3. Taxonomy: regions + anatomy upserted, references re-pointed
--   4. Merges: every table with a foreign key to exercises is re-pointed
--      automatically; shared_templates' jsonb too
--   5. Updates, promotions, private retags, mechanism/pattern for all rows
--   6. 44 new exercises
--   7. Full Body overrides, then every row re-touched so the existing
--      triggers recompute muscle_group and muscle_region
--   8. Old region keys deleted, legacy spreadsheet columns dropped
--   9. Self-check
--
-- Run in the Supabase SQL editor. Takes a few seconds.
-- ============================================================================

begin;

-- 1. Backups ------------------------------------------------------------------
create table if not exists _backup_074_exercises as table exercises;
create table if not exists _backup_074_muscle_groups as table muscle_groups;
create table if not exists _backup_074_muscle_detailed as table muscle_detailed;
create table if not exists _backup_074_muscle_taxonomy as table muscle_taxonomy;
create table if not exists _backup_074_body_map_region_muscles as table body_map_region_muscles;
create table if not exists _backup_074_split_muscle_exclusions as table split_muscle_exclusions;
create table if not exists _backup_074_muscle_group_targets as table muscle_group_targets;
create table if not exists _backup_074_muscle_group_full_body_override as table muscle_group_full_body_override;
-- Every row a merge re-points or drops, from any table, as jsonb.
create table if not exists _backup_074_merge_refs (
  table_name text, column_name text, old_exercise_id uuid, new_exercise_id uuid,
  outcome text, row_data jsonb, at timestamptz default now()
);

-- 2. Columns --------------------------------------------------------------------
alter table exercises add column if not exists mechanism text;
alter table exercises add column if not exists pattern text;

-- 3. Taxonomy -------------------------------------------------------------------
insert into muscle_groups (key, label) values ('Full Body', 'Full Body') on conflict (key) do nothing;

insert into muscle_detailed (key, label, generic_group) values ('upper_chest', 'Upper Chest', 'Chest') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('chest', 'Mid Chest', 'Chest') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('lower_chest', 'Lower Chest', 'Chest') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('serratus', 'Serratus', 'Chest') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('lats', 'Lats', 'Back') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('upper_traps', 'Upper Traps', 'Back') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('mid_traps', 'Mid Traps', 'Back') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('rhomboids', 'Rhomboids', 'Back') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('lower_back', 'Lower Back', 'Back') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('front_delts', 'Front Delts', 'Shoulders') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('side_delts', 'Side Delts', 'Shoulders') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('rear_delts', 'Rear Delts', 'Shoulders') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('rotator_cuff', 'Rotator Cuff', 'Shoulders') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('biceps', 'Biceps', 'Arms') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('brachialis', 'Brachialis', 'Arms') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('triceps', 'Triceps', 'Arms') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('forearms', 'Forearms', 'Arms') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('quads', 'Quads', 'Legs') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('hamstrings', 'Hamstrings', 'Legs') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('glutes', 'Glutes', 'Legs') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('adductors', 'Adductors', 'Legs') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('hip_flexors', 'Hip Flexors', 'Legs') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('calves', 'Calves', 'Legs') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('shins', 'Shins', 'Legs') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('abs', 'Abs', 'Core') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('obliques', 'Obliques', 'Core') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('deep_core', 'Deep Core', 'Core') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;
insert into muscle_detailed (key, label, generic_group) values ('neck', 'Neck', 'Neck') on conflict (key) do update set label = excluded.label, generic_group = excluded.generic_group;

insert into muscle_taxonomy (scientific_name, detailed_key) values ('Pectoralis Major (Clavicular)', 'upper_chest') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Pectoralis Major (Sternal)', 'chest') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Pectoralis Minor', 'chest') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Pectoralis Major (Costal)', 'lower_chest') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Serratus Anterior', 'serratus') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Latissimus Dorsi', 'lats') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Teres Major', 'lats') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Trapezius (Superior)', 'upper_traps') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Levator Scapulae', 'upper_traps') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Trapezius (Middle)', 'mid_traps') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Trapezius (Inferior)', 'mid_traps') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Rhomboid Major', 'rhomboids') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Rhomboid Minor', 'rhomboids') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Erector Spinae', 'lower_back') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Quadratus Lumborum', 'lower_back') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Deltoid (Anterior)', 'front_delts') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Deltoid (Lateral)', 'side_delts') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Deltoid (Posterior)', 'rear_delts') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Infraspinatus', 'rotator_cuff') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Teres Minor', 'rotator_cuff') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Supraspinatus', 'rotator_cuff') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Subscapularis', 'rotator_cuff') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Biceps Brachii', 'biceps') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Brachialis', 'brachialis') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Triceps (Long)', 'triceps') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Triceps (Lateral)', 'triceps') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Triceps (Medial)', 'triceps') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Brachioradialis', 'forearms') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Flexor Carpi Radialis', 'forearms') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Flexor Carpi Ulnaris', 'forearms') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Flexor Digitorum', 'forearms') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Extensor Carpi Radialis', 'forearms') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Rectus Femoris', 'quads') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Vastus Lateralis', 'quads') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Vastus Medialis', 'quads') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Vastus Intermedius', 'quads') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Biceps Femoris (Long)', 'hamstrings') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Biceps Femoris (Short)', 'hamstrings') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Semitendinosus', 'hamstrings') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Semimembranosus', 'hamstrings') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Gluteus Maximus', 'glutes') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Gluteus Medius', 'glutes') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Gluteus Minimus', 'glutes') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Tensor Fasciae Latae', 'glutes') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Adductor Magnus', 'adductors') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Adductor Longus', 'adductors') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Iliopsoas', 'hip_flexors') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Gastrocnemius (Medial)', 'calves') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Gastrocnemius (Lateral)', 'calves') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Soleus', 'calves') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Tibialis Anterior', 'shins') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Rectus Abdominis (Superior)', 'abs') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Rectus Abdominis (Inferior)', 'abs') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('External Obliques', 'obliques') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Internal Obliques', 'obliques') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Transverse Abdominis', 'deep_core') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Sternocleidomastoid', 'neck') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;
insert into muscle_taxonomy (scientific_name, detailed_key) values ('Splenius Capitis', 'neck') on conflict (scientific_name) do update set detailed_key = excluded.detailed_key;

-- Old region keys -> new. Body map and split exclusions get the new key
-- (skipping rows that already exist), then the old rows go.
create temp table _region_remap (old_key text primary key, new_key text not null) on commit drop;
insert into _region_remap values ('triceps_lateral', 'triceps'), ('forearm_extensors', 'forearms'), ('neck_flexors', 'neck'), ('teres_major', 'lats'), ('deep_stabilizer', 'chest');

insert into body_map_region_muscles (view, slug, muscle_detailed_key)
select distinct b.view, b.slug, r.new_key from body_map_region_muscles b join _region_remap r on r.old_key = b.muscle_detailed_key
where not exists (select 1 from body_map_region_muscles x where x.view = b.view and x.slug = b.slug and x.muscle_detailed_key = r.new_key);
delete from body_map_region_muscles where muscle_detailed_key in (select old_key from _region_remap);
-- The old Deep Chest mapping was really Serratus, and Upper Traps is new.
insert into body_map_region_muscles (view, slug, muscle_detailed_key)
select v.view, v.slug, v.k from (values ('front','chest','serratus'), ('front','trapezius','upper_traps'), ('back','trapezius','upper_traps')) as v(view, slug, k)
where not exists (select 1 from body_map_region_muscles x where x.view = v.view and x.slug = v.slug and x.muscle_detailed_key = v.k);

insert into split_muscle_exclusions (split_id, muscle_detailed_key)
select distinct s.split_id, r.new_key from split_muscle_exclusions s join _region_remap r on r.old_key = s.muscle_detailed_key
where not exists (select 1 from split_muscle_exclusions x where x.split_id = s.split_id and x.muscle_detailed_key = r.new_key);
delete from split_muscle_exclusions where muscle_detailed_key in (select old_key from _region_remap);

update exercises set muscle_region = r.new_key from _region_remap r where exercises.muscle_region = r.old_key;

-- Weekly Set Goals in Region/Anatomy mode are keyed by region label.
create temp table _label_remap (old_label text primary key, new_label text not null) on commit drop;
insert into _label_remap values ('Traps', 'Mid Traps'), ('Deep Chest', 'Mid Chest'), ('Teres Major', 'Lats'), ('Neck Flexors', 'Neck');
insert into muscle_group_targets (user_id, muscle_group, weekly_target_sets, updated_at)
select t.user_id, l.new_label, t.weekly_target_sets, now() from muscle_group_targets t join _label_remap l on l.old_label = t.muscle_group
on conflict (user_id, muscle_group) do nothing;
delete from muscle_group_targets where muscle_group in (select old_label from _label_remap);

-- 4. Merges ---------------------------------------------------------------------
create temp table _merges (old_id uuid primary key, new_id uuid not null, old_name text) on commit drop;
insert into _merges values
  ('0577c4fd-8a54-4f11-8daf-c61402a528f3', 'cdf843a3-edd0-4340-bfac-38596eb2250c', 'Glute-Ham Raise (GHR)'),
  ('0ff62814-4db7-45d5-b810-4c380dff9896', 'ae2d9355-bfed-4b47-8dd8-55408965c22f', 'Singe Arm Overhead Dumbbell Tricep Extension'),
  ('140648ba-b58e-4a93-94a0-f85cd4ab586b', '833abade-645f-478c-8159-cd158a03f85e', 'Cable Hammer Curl'),
  ('1d19d35b-da43-4436-88cf-7ccdc3202b27', '75114527-cd71-483a-addb-b27823ad4de2', 'Seated Lateral Raise'),
  ('28131e5d-51e7-44b9-8f15-acf937deaabb', 'e318675e-be3a-437b-9291-6e2127e74ae5', 'Hip Adductor (Machine)'),
  ('3840d7e4-c600-44b1-b390-130ea4a4205b', '49701a92-09ea-45d5-bab9-282d434a93c7', 'Ez-Bar Tricep Pushdown'),
  ('62830a11-d7d9-480d-98de-40ff93188696', '225f9600-42cb-4dc3-84e4-6146a136ee73', 'Tricep Pushdown V-Bar'),
  ('67a89ea1-e77d-4620-a9a0-e3d9d20ac5c8', 'be90f2a7-0cf9-485f-b727-fc238abf758d', 'Single Arm Rear-Delt Fly'),
  ('685b1035-a8b0-4e9a-bfff-f112da82c61d', '48e65051-93bb-4b0e-a8da-9da9e227626f', 'Machine Chest Press'),
  ('7a07a926-b557-4a7c-9f30-c1cfde0690f8', '59fc34a0-06b6-4ab8-9907-d2e017f21ba5', 'Barbell Block Pull'),
  ('7f978666-3e44-44e8-8f02-40340d6443ae', '71bf9ddf-23b0-46e7-b959-a21b6916323b', 'Open-end Close Grip Pulldown'),
  ('81a1154a-b1ab-4532-b159-2e51613317e6', 'f1b8c93d-853e-4d2e-95a3-0201f139cda6', 'Plate Loaded Machine Shoulder Press'),
  ('96a8adc9-c78b-4304-b794-e84eca7188be', 'be90f2a7-0cf9-485f-b727-fc238abf758d', 'Single-Arm Machine Seated Reverse Fly'),
  ('a9858d54-8580-47c3-952b-2538e09b58b1', '9d513f3e-fa3d-47b0-839e-e4f1cfc2dce7', 'Hamstring Curl'),
  ('aa17c8d5-43ba-442c-aa5e-ded8f845ef38', '8f74f40b-384c-48e4-9109-762ad197fcad', 'Iso-Lateral Row'),
  ('b00dce52-9288-40b7-a22f-b05610a9e21f', '7f66eab6-3b6c-46e5-9f03-65315326dcfa', 'V-Bar Bicep Curl'),
  ('b922571d-c41c-41fc-abda-753002317ebb', 'cf042684-812b-47bd-8a2d-093627b7132d', 'Overhead Cable Rope Tricep Extension'),
  ('bbf83b0a-60cb-46a7-8e3a-6f60cafc6660', '099488c2-a1af-4ee0-89be-9dcc42850f0f', 'Tricep extension Single Arm'),
  ('c0d50541-6d13-4d2a-842a-f0104cc11fb5', '150e2555-e7d8-4d6f-b175-a4859dc2b30a', 'Copenhagen Plank'),
  ('c904a981-bdea-40b3-b059-25d4a8f7a46c', 'be90f2a7-0cf9-485f-b727-fc238abf758d', 'Unilateral Machine Reverse Fly'),
  ('cf0634f8-4a22-468d-8dfb-eb1ff5f9d002', 'ddf72ee6-8f64-4680-a6a4-22f1e0bf8c38', 'Overhead Tricep Extension'),
  ('d89d0c92-d6bc-4472-abf4-84453f611082', '536c7077-06ee-493e-ad3a-afb277b53995', 'Cuffed Lateral Raises'),
  ('daac496f-774c-4051-bf26-8d9a672dd38c', '4ceea05f-b906-44a4-851f-d2d1d612f13f', 'Seated Hammer Chrl'),
  ('e5794594-aec3-4389-930c-eb00e72e271c', 'd359f67d-7118-408b-8d2d-3ecd7c6309ad', 'MTS Bicep Curl'),
  ('fb019c57-b15f-434e-b299-174fe42172bb', 'e3ac95bd-3ed7-4ef6-9661-f2c672d9afa6', 'DB Front-Foot Elevated Split'),
  ('fd0b3f84-9961-4a0f-9a22-a434d7d90960', 'd359f67d-7118-408b-8d2d-3ecd7c6309ad', 'Bicep Curl Machine');

do $$
declare
  fk record; m record; rec record; moved int; dropped int;
begin
  for fk in
    select c.conrelid::regclass as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = 'public.exercises'::regclass and array_length(c.conkey, 1) = 1
      and c.conrelid::regclass::text not like '_backup_074%'
  loop
    moved := 0; dropped := 0;
    for m in select * from _merges loop
      for rec in execute format('select ctid as rid, to_jsonb(t) as j from %s t where %I = $1', fk.tbl, fk.col) using m.old_id loop
        begin
          execute format('update %s set %I = $1 where ctid = $2', fk.tbl, fk.col) using m.new_id, rec.rid;
          insert into _backup_074_merge_refs (table_name, column_name, old_exercise_id, new_exercise_id, outcome, row_data)
            values (fk.tbl::text, fk.col, m.old_id, m.new_id, 'moved', rec.j);
          moved := moved + 1;
        exception when unique_violation then
          -- The user already has this row on the target (e.g. a favorite).
          execute format('delete from %s where ctid = $1', fk.tbl) using rec.rid;
          insert into _backup_074_merge_refs (table_name, column_name, old_exercise_id, new_exercise_id, outcome, row_data)
            values (fk.tbl::text, fk.col, m.old_id, m.new_id, 'dropped_duplicate', rec.j);
          dropped := dropped + 1;
        end;
      end loop;
    end loop;
    if moved + dropped > 0 then
      raise notice 'merge: %.% moved %, dropped % duplicates', fk.tbl, fk.col, moved, dropped;
    end if;
  end loop;
end $$;

-- Shared template codes store exercise ids inside jsonb (no foreign key).
do $$
declare m record;
begin
  if to_regclass('public.shared_templates') is not null then
    for m in select * from _merges loop
      update shared_templates set exercises = replace(exercises::text, m.old_id::text, m.new_id::text)::jsonb
      where exercises::text like '%' || m.old_id::text || '%';
    end loop;
  end if;
end $$;

delete from exercises where id in (select old_id from _merges);

-- 5. Existing exercises ------------------------------------------------------------
update exercises set name = 'Cable Face Pull', primary_muscles = array['Deltoid (Posterior)']::text[], secondary_muscles = array['Infraspinatus','Teres Minor','Rhomboid Major','Rhomboid Minor','Trapezius (Middle)']::text[], equipment = array['Cable']::text[], aliases = array['Face Pulls']::text[], mechanism = 'Isolation', pattern = 'fly' where id = '00427f50-3bab-4e94-b14e-c1764149649a';  -- UPDATE: Cable Face Pull
update exercises set name = 'Cable Pallof Press', primary_muscles = array['External Obliques','Internal Obliques','Transverse Abdominis']::text[], secondary_muscles = array['Rectus Abdominis (Superior)']::text[], equipment = array['Cable']::text[], aliases = array['Pallof Press']::text[], mechanism = 'Isolation', pattern = 'core' where id = '0138cea6-d9c8-44d2-ac74-2a5b257316a8';  -- UPDATE: Cable Pallof Press
update exercises set name = 'Machine Seated Dip', primary_muscles = array['Triceps (Long)','Triceps (Lateral)','Triceps (Medial)']::text[], secondary_muscles = array['Pectoralis Major (Costal)','Deltoid (Anterior)']::text[], equipment = array['Machine']::text[], aliases = array['Seated Dip Machine','Tricep Dip Machine']::text[], created_by = null, admin_reviewed = true, mechanism = 'Compound', pattern = 'press' where id = '02708a25-dc50-48b2-b0ff-5fa83bc43964';  -- PROMOTE: Seated Dips
update exercises set mechanism = 'Isolation', pattern = 'raise' where id = '0515d444-501d-4757-973f-f53e80f8ea0c';  -- KEEP: Smith Standing Calf Raise
update exercises set mechanism = 'Isolation', pattern = 'raise' where id = '06122a01-ced6-4a2a-982c-bd318c0ffac2';  -- KEEP: Leg Press Calf Raise
update exercises set mechanism = 'Compound', pattern = 'hinge' where id = '067e8501-f54f-47ac-b2e8-5897f978a036';  -- KEEP: Barbell Stiff-Leg Deadlift
update exercises set mechanism = 'Isolation', pattern = 'hinge' where id = '06c64ee5-7238-4cb7-9e49-93fb79417b00';  -- KEEP: Weighted Back Extension
update exercises set name = 'Bodyweight Crunch', primary_muscles = array['Rectus Abdominis (Superior)']::text[], secondary_muscles = array['External Obliques']::text[], equipment = array['Bodyweight']::text[], aliases = array['Crunches']::text[], mechanism = 'Isolation', pattern = 'core' where id = '072b5e42-86b2-4b24-8db0-81fc4b2b0a0c';  -- UPDATE: Bodyweight Crunch
update exercises set name = 'Frog Pumps', primary_muscles = array['Gluteus Maximus']::text[], secondary_muscles = array['Biceps Femoris (Long)']::text[], equipment = array['Bodyweight']::text[], aliases = array['Frog Bridges']::text[], mechanism = 'Isolation', pattern = 'hinge' where id = '078026b5-fdcf-4f03-83cc-b7031d5ab17b';  -- UPDATE: Frog Pumps
update exercises set name = 'Egyptian Cable Lateral Raise', primary_muscles = array['Deltoid (Lateral)']::text[], secondary_muscles = array['Deltoid (Anterior)','Trapezius (Superior)']::text[], equipment = array['Cable']::text[], aliases = array['Egyptian Raises']::text[], mechanism = 'Isolation', pattern = 'raise' where id = '0894ed36-5d5c-48ec-b545-ac02a21d549c';  -- UPDATE: Egyptian Cable Lateral Raise
update exercises set mechanism = 'Compound', pattern = 'press' where id = '08d6e60a-ec7b-4fe1-a11b-48c3b4396c04';  -- KEEP: Seated Dumbbell Shoulder Press
update exercises set name = 'Bayesian Cable Curl', primary_muscles = array['Biceps Brachii']::text[], secondary_muscles = array['Brachialis','Brachioradialis']::text[], equipment = array['Cable']::text[], aliases = array['Bayesian Curls']::text[], mechanism = 'Isolation', pattern = 'curl' where id = '098a7263-a6c8-4b3e-9c86-ce1b4747c093';  -- UPDATE: Bayesian Cable Curl
update exercises set name = 'Single-Arm Cable Pushdown', primary_muscles = array['Triceps (Lateral)','Triceps (Long)','Triceps (Medial)']::text[], secondary_muscles = '{}'::text[], equipment = array['Cable']::text[], aliases = array['Single-Arm Pushdowns']::text[], mechanism = 'Isolation', pattern = 'extension' where id = '099488c2-a1af-4ee0-89be-9dcc42850f0f';  -- UPDATE: Single-Arm Cable Pushdown
update exercises set mechanism = 'Compound', pattern = 'hinge' where id = '09e7c7cd-388d-40ac-99d3-f68b4711cb55';  -- KEEP: Barbell Good Morning
update exercises set name = 'Weighted Chest Dip', primary_muscles = array['Pectoralis Major (Costal)']::text[], secondary_muscles = array['Triceps (Lateral)','Triceps (Long)','Triceps (Medial)','Deltoid (Anterior)']::text[], equipment = array['Bodyweight','Dip Station','Weight Belt']::text[], aliases = array['Weighted Dips']::text[], mechanism = 'Compound', pattern = 'press' where id = '0a3ce125-9b2c-49c7-bf28-eb00e0a48bc0';  -- UPDATE: Weighted Chest Dip
update exercises set name = 'Farmer''s Walk', primary_muscles = array['Flexor Digitorum','Trapezius (Superior)']::text[], secondary_muscles = array['External Obliques','Transverse Abdominis','Gluteus Medius','Erector Spinae']::text[], equipment = array['Dumbbell','Kettlebell']::text[], aliases = array['Farmer Carries']::text[], mechanism = 'Compound', pattern = 'carry' where id = '0c632675-ddb3-4ef7-a0f3-e8caab27a79a';  -- UPDATE: Farmer's Walk
update exercises set mechanism = 'Compound', pattern = 'press' where id = '0db15ac5-65ec-402f-893b-a91b9b57afd5';  -- KEEP: Smith Machine Flat Press
update exercises set name = 'Smith Machine Bent-Over Row', primary_muscles = array['Latissimus Dorsi']::text[], secondary_muscles = array['Rhomboid Major','Rhomboid Minor','Trapezius (Middle)','Deltoid (Posterior)','Biceps Brachii','Erector Spinae']::text[], equipment = array['Smith Machine']::text[], aliases = array['Smith Row']::text[], created_by = null, admin_reviewed = true, mechanism = 'Compound', pattern = 'row' where id = '0e328839-0535-483e-b7c6-fc4b32152a68';  -- PROMOTE: Bent-Over Row Smith Machine
update exercises set name = 'Hanging Knee Raise', primary_muscles = array['Rectus Abdominis (Inferior)']::text[], secondary_muscles = array['Iliopsoas','External Obliques']::text[], equipment = array['Bodyweight','Pull-Up Bar']::text[], aliases = array['Knee Raises']::text[], mechanism = 'Isolation', pattern = 'core' where id = '0e57b7d2-2567-412f-b870-258e2fcd474f';  -- UPDATE: Hanging Knee Raise
update exercises set name = 'Narrow Grip Seated Cable Row', primary_muscles = array['Latissimus Dorsi']::text[], secondary_muscles = array['Biceps Brachii','Deltoid (Posterior)','Rhomboid Major','Rhomboid Minor','Trapezius (Middle)']::text[], equipment = array['Cable']::text[], aliases = array['Seated Rows']::text[], mechanism = 'Compound', pattern = 'row' where id = '0e72a306-c5be-493b-85d0-f8ddd4e6496a';  -- UPDATE: Narrow Grip Seated Cable Row
update exercises set name = 'Side Plank', primary_muscles = array['External Obliques']::text[], secondary_muscles = array['Transverse Abdominis','Gluteus Medius']::text[], equipment = array['Bodyweight']::text[], aliases = array['Side Planks']::text[], mechanism = 'Isolation', pattern = 'core' where id = '0f6f0727-f12f-4550-8618-a5b912bcb260';  -- UPDATE: Side Plank
update exercises set mechanism = 'Isolation', pattern = 'raise' where id = '10eabb9b-e3fe-415e-bdcb-cf72e7c2ff7c';  -- KEEP: Dumbbell Standing Calf Raise
update exercises set name = 'Cable knee raises', primary_muscles = array['Iliopsoas','Rectus Abdominis (Inferior)']::text[], secondary_muscles = '{}'::text[], equipment = array['Cable']::text[], aliases = '{}'::text[], mechanism = 'Isolation', pattern = 'core' where id = '1157afcd-354b-443d-8833-29505f90432b';  -- PRIVATE: Cable knee raises
update exercises set mechanism = 'Compound', pattern = 'press' where id = '130f6f4a-534e-4d39-946c-2bd8367931d1';  -- KEEP: Landmine Chest Press
update exercises set mechanism = 'Compound', pattern = 'squat' where id = '13f518f6-dd48-4951-8a3a-bbbd464f8914';  -- KEEP: Barbell Pause Squat
update exercises set name = 'Bodyweight Glute Bridge', primary_muscles = array['Gluteus Maximus']::text[], secondary_muscles = array['Biceps Femoris (Long)']::text[], equipment = array['Bodyweight']::text[], aliases = array['Glute Bridges']::text[], mechanism = 'Isolation', pattern = 'hinge' where id = '13f8c86c-93ae-4783-8852-21bfe5e3f4ee';  -- UPDATE: Bodyweight Glute Bridge
update exercises set name = 'Dumbbell Row', primary_muscles = array['Latissimus Dorsi','Teres Major']::text[], secondary_muscles = array['Rhomboid Major','Rhomboid Minor','Trapezius (Middle)','Deltoid (Posterior)','Biceps Brachii','Brachialis','Brachioradialis']::text[], equipment = array['Dumbbell']::text[], aliases = '{}'::text[], mechanism = 'Compound', pattern = 'row' where id = '14daa7ce-c318-4aab-badf-f1a1511c1f3e';  -- UPDATE: Dumbbell Row
update exercises set name = 'Copenhagen Plank', primary_muscles = array['Adductor Longus','Adductor Magnus']::text[], secondary_muscles = array['External Obliques','Transverse Abdominis']::text[], equipment = array['Bodyweight','Bench']::text[], aliases = array['Adductor Plank']::text[], mechanism = 'Isolation', pattern = 'adduction' where id = '150e2555-e7d8-4d6f-b175-a4859dc2b30a';  -- UPDATE: Copenhagen Plank
update exercises set mechanism = 'Isolation', pattern = 'fly' where id = '156aa0d4-22e3-417e-80e5-3904ac2e0838';  -- KEEP: Plate Svend Press
update exercises set name = 'Bodyweight Chin-Up', primary_muscles = array['Latissimus Dorsi']::text[], secondary_muscles = array['Biceps Brachii','Rhomboid Major','Rhomboid Minor','Teres Major']::text[], equipment = array['Bodyweight','Pull-Up Bar']::text[], aliases = array['Chin-Ups']::text[], mechanism = 'Compound', pattern = 'pull' where id = '16be068d-13b5-45b1-a2ce-65b4a94ab68e';  -- UPDATE: Bodyweight Chin-Up
update exercises set name = 'Barbell Conventional Deadlift', primary_muscles = array['Gluteus Maximus','Erector Spinae']::text[], secondary_muscles = array['Latissimus Dorsi','Trapezius (Superior)','Flexor Digitorum','Vastus Lateralis','Vastus Medialis','Vastus Intermedius']::text[], equipment = array['Barbell']::text[], aliases = array['Deadlift']::text[], mechanism = 'Compound', pattern = 'hinge' where id = '17985c8d-7166-4d00-8513-d4b8efd02fae';  -- UPDATE: Barbell Conventional Deadlift
update exercises set name = 'Bodyweight Chest Dip', primary_muscles = array['Pectoralis Major (Costal)']::text[], secondary_muscles = array['Triceps (Lateral)','Triceps (Long)','Triceps (Medial)','Deltoid (Anterior)']::text[], equipment = array['Bodyweight','Dip Station']::text[], aliases = array['Dips']::text[], mechanism = 'Compound', pattern = 'press' where id = '17efc8dd-a7bf-42e7-aff7-9fd85702e4d6';  -- UPDATE: Bodyweight Chest Dip
update exercises set mechanism = 'Compound', pattern = 'press' where id = '199c007a-4b78-4bb9-aba0-ec02adae3709';  -- KEEP: Barbell Incline Bench Press
update exercises set name = 'Smith Machine Romanian Deadlift', primary_muscles = array['Biceps Femoris (Long)','Biceps Femoris (Short)','Semitendinosus','Semimembranosus']::text[], secondary_muscles = array['Gluteus Maximus','Erector Spinae']::text[], equipment = array['Smith Machine']::text[], aliases = '{}'::text[], mechanism = 'Compound', pattern = 'hinge' where id = '1bb205d7-4209-45f8-b6e8-6d3903a8b76f';  -- UPDATE: Smith Machine Romanian Deadlift
update exercises set mechanism = 'Compound', pattern = 'row' where id = '1c56cfc8-ea11-4725-baba-abde718b48c1';  -- KEEP: Renegade Row
update exercises set mechanism = 'Compound', pattern = 'press' where id = '1cb96363-e15b-4ab9-aef3-6fdc4873654c';  -- KEEP: Barbell Decline Bench Press
update exercises set mechanism = 'Isolation', pattern = 'core' where id = '1dee5348-ce41-4316-af43-67801cea7fc7';  -- KEEP: Medicine Ball Woodchopper
update exercises set mechanism = 'Isolation', pattern = 'raise' where id = '1df4f2a0-7e44-4af5-baaf-e60b29050165';  -- KEEP: Machine Lateral Raise
update exercises set name = '45-Degree Incline Dumbbell Bench Press', primary_muscles = array['Pectoralis Major (Clavicular)']::text[], secondary_muscles = array['Deltoid (Anterior)','Pectoralis Major (Sternal)','Triceps (Long)','Triceps (Lateral)','Triceps (Medial)']::text[], equipment = array['Dumbbell']::text[], aliases = array['45 Degree Incline Press']::text[], mechanism = 'Compound', pattern = 'press' where id = '1e300563-831f-4429-843a-94e5dccd727d';  -- UPDATE: 45-Degree Incline Dumbbell Bench Press
update exercises set name = 'Dual-Handle Cable Lat Pulldown', primary_muscles = array['Latissimus Dorsi','Teres Major']::text[], secondary_muscles = array['Rhomboid Major','Rhomboid Minor','Biceps Brachii','Brachialis']::text[], equipment = array['Cable']::text[], aliases = array['Dual Pulley Lat Pulldown']::text[], created_by = null, admin_reviewed = true, mechanism = 'Compound', pattern = 'pull' where id = '1ec1687d-f1c2-4073-9b77-b9ee309b41a3';  -- PROMOTE: Dual Pulley Lat Pulldown
update exercises set name = 'Barbell Snatch', primary_muscles = array['Gluteus Maximus','Vastus Lateralis','Vastus Medialis','Vastus Intermedius','Trapezius (Superior)','Deltoid (Anterior)']::text[], secondary_muscles = array['Erector Spinae','Biceps Femoris (Long)','Deltoid (Lateral)','Trapezius (Middle)','Triceps (Long)','Triceps (Lateral)','Triceps (Medial)']::text[], equipment = array['Barbell']::text[], aliases = array['Snatch']::text[], mechanism = 'Compound', pattern = 'olympic' where id = '1ecc072e-356f-48df-b311-ab23a7eac590';  -- UPDATE: Barbell Snatch
update exercises set name = 'Kettlebell Goblet Squat', primary_muscles = array['Rectus Femoris','Vastus Intermedius','Vastus Lateralis','Vastus Medialis']::text[], secondary_muscles = array['Gluteus Maximus','Adductor Longus','Adductor Magnus','Erector Spinae']::text[], equipment = array['Kettlebell']::text[], aliases = '{}'::text[], mechanism = 'Compound', pattern = 'squat' where id = '1f762d3d-3497-4af7-93b0-5693da4a04c1';  -- UPDATE: Kettlebell Goblet Squat
update exercises set mechanism = 'Isolation', pattern = 'core' where id = '21add7e1-9cc5-4ea3-9355-949efc38c334';  -- KEEP: Medicine Ball Russian Twist
update exercises set name = 'Cable V-Bar Pushdown', primary_muscles = array['Triceps (Lateral)','Triceps (Long)','Triceps (Medial)']::text[], secondary_muscles = '{}'::text[], equipment = array['Cable']::text[], aliases = array['V-Bar Pushdowns']::text[], mechanism = 'Isolation', pattern = 'extension' where id = '225f9600-42cb-4dc3-84e4-6146a136ee73';  -- UPDATE: Cable V-Bar Pushdown
update exercises set mechanism = 'Isolation', pattern = 'curl' where id = '22b4e5ff-e01a-4c74-9773-14c9b5eb0d2e';  -- KEEP: Dumbbell Concentration Curl
update exercises set mechanism = 'Compound', pattern = 'row' where id = '22eb6035-5b8a-43e9-8bbb-6b20d3e14eb4';  -- KEEP: Barbell Pendlay Row
update exercises set name = 'High Cable Double Bicep Curl', primary_muscles = array['Biceps Brachii']::text[], secondary_muscles = array['Brachialis','Brachioradialis']::text[], equipment = array['Cable']::text[], aliases = array['Front Double Bicep']::text[], mechanism = 'Isolation', pattern = 'curl' where id = '26775b22-aa00-438b-9b25-207eb3c38a92';  -- UPDATE: High Cable Double Bicep Curl
update exercises set mechanism = 'Isolation', pattern = 'raise' where id = '269a4d84-fb85-4694-b2f3-90e980d59fda';  -- KEEP: Machine Donkey Calf Raise
update exercises set name = 'Dumbbell Z-Press', primary_muscles = array['Deltoid (Anterior)']::text[], secondary_muscles = array['Triceps (Lateral)','Triceps (Long)','Triceps (Medial)','Deltoid (Lateral)','Trapezius (Superior)']::text[], equipment = array['Dumbbell']::text[], aliases = '{}'::text[], mechanism = 'Compound', pattern = 'press' where id = '26ff56c6-7f3c-48ed-8584-70bd3d2a8d6d';  -- UPDATE: Dumbbell Z-Press
update exercises set mechanism = 'Compound', pattern = 'olympic' where id = '27d30134-54b7-4ecd-9842-c40a63b22734';  -- KEEP: Dumbbell Thruster
update exercises set mechanism = 'Isolation', pattern = 'extension' where id = '28c11589-02c8-40b7-90b2-4e50eb84bcbd';  -- KEEP: Dumbbell Tricep Kickback
update exercises set mechanism = 'Compound', pattern = 'lunge' where id = '28fb0709-0598-4372-936a-c75456eafa17';  -- KEEP: Dumbbell Forward Lunge
update exercises set mechanism = 'Compound', pattern = 'press' where id = '2a50460f-1a7c-4d4c-8baa-0bc1ec4f1bb4';  -- KEEP: Smith Machine Shoulder Press
update exercises set name = 'Bodyweight Back Extension', primary_muscles = array['Erector Spinae']::text[], secondary_muscles = array['Gluteus Maximus','Biceps Femoris (Long)']::text[], equipment = array['Bodyweight','Hyperextension Bench']::text[], aliases = array['Hyperextensions']::text[], mechanism = 'Isolation', pattern = 'hinge' where id = '2ab9c638-d23c-46ca-971a-b1db2fb7bc47';  -- UPDATE: Bodyweight Back Extension
update exercises set mechanism = 'Isolation', pattern = 'raise' where id = '2b3cb26d-d8b5-4cee-9d8b-9cdbd28cbc71';  -- KEEP: Single Arm Machine Lateral Raise
update exercises set mechanism = 'Isolation', pattern = 'fly' where id = '2b9a5dcb-c123-4b61-8bdb-aa54b9c425c8';  -- KEEP: Decline Dumbbell Fly
update exercises set mechanism = 'Compound', pattern = 'lunge' where id = '2be6b7f0-79a7-4ded-8889-0bc40f722094';  -- KEEP: Barbell Bulgarian Split Squat
update exercises set mechanism = 'Isolation', pattern = 'core' where id = '2cead27a-3329-44dd-8672-12d61a00d090';  -- KEEP: Weighted Plank
update exercises set mechanism = 'Compound', pattern = 'row' where id = '2d3cd578-83fb-4d72-935a-1aa8d18d2189';  -- KEEP: Chest-Supported T-Bar Row
update exercises set mechanism = 'Compound', pattern = 'row' where id = '2d48af3c-8e14-43a6-a7f0-2de71d0137d7';  -- KEEP: Landmine T-Bar Row
update exercises set mechanism = 'Compound', pattern = 'row' where id = '2d814032-99d1-4ae6-b9f8-711ea81ef950';  -- KEEP: Machine Mid Row
update exercises set mechanism = 'Isolation', pattern = 'curl' where id = '2db3a8cf-8a86-466b-af2f-f55cecc03670';  -- KEEP: Barbell Wrist Curl
update exercises set name = 'Iso-Lateral Wide Pulldown', primary_muscles = array['Latissimus Dorsi','Teres Major']::text[], secondary_muscles = array['Rhomboid Major','Rhomboid Minor','Trapezius (Inferior)','Biceps Brachii']::text[], equipment = array['Machine']::text[], aliases = '{}'::text[], created_by = null, admin_reviewed = true, mechanism = 'Compound', pattern = 'pull' where id = '2e82fe9c-cb7e-45c9-bc60-d1893587d536';  -- PROMOTE: Iso-Lateral Wide Pulldown
update exercises set name = 'Cable Crossover', primary_muscles = array['Pectoralis Major (Costal)']::text[], secondary_muscles = array['Deltoid (Anterior)']::text[], equipment = array['Cable']::text[], aliases = array['Standing Cable Flys']::text[], mechanism = 'Isolation', pattern = 'fly' where id = '2e9bb042-0380-41fa-881e-b32fe42d30db';  -- UPDATE: Cable Crossover
update exercises set name = 'Cable Squat Curl', primary_muscles = array['Biceps Brachii']::text[], secondary_muscles = array['Brachialis']::text[], equipment = array['Cable']::text[], aliases = array['Squat Curl']::text[], created_by = null, admin_reviewed = true, mechanism = 'Isolation', pattern = 'curl' where id = '2fd05e03-3985-4cae-8567-8f9d8bb22d73';  -- PROMOTE: Squat Curls
update exercises set name = 'Cable Lying Tricep Extension', primary_muscles = array['Triceps (Lateral)','Triceps (Long)','Triceps (Medial)']::text[], secondary_muscles = '{}'::text[], equipment = array['Cable','Bench']::text[], aliases = array['Lying Cable Extension']::text[], mechanism = 'Isolation', pattern = 'extension' where id = '33328052-0f93-437e-b137-dec758c76eee';  -- UPDATE: Cable Lying Tricep Extension
update exercises set mechanism = 'Isolation', pattern = 'fly' where id = '33581cd4-d085-47c2-84d6-a0036564c633';  -- KEEP: Flat Dumbbell Fly
update exercises set name = 'Barbell Glute Bridge', primary_muscles = array['Gluteus Maximus']::text[], secondary_muscles = array['Biceps Femoris (Long)','Vastus Lateralis','Vastus Medialis','Vastus Intermedius']::text[], equipment = array['Barbell']::text[], aliases = array['Barbell Glute Bridges']::text[], mechanism = 'Isolation', pattern = 'hinge' where id = '33ed858b-991e-4394-8613-c68a0f05d7cf';  -- UPDATE: Barbell Glute Bridge
update exercises set name = 'Cable Straight-Arm Pulldown', primary_muscles = array['Latissimus Dorsi']::text[], secondary_muscles = array['Teres Major','Deltoid (Posterior)']::text[], equipment = array['Cable']::text[], aliases = array['Straight-Arm Lat Pull']::text[], mechanism = 'Isolation', pattern = 'pull' where id = '34b70998-29d1-4b65-9c7a-fbb980a626e9';  -- UPDATE: Cable Straight-Arm Pulldown
update exercises set name = 'Neutral-Grip Pull-Up', primary_muscles = array['Latissimus Dorsi','Teres Major']::text[], secondary_muscles = array['Biceps Brachii','Brachialis','Brachioradialis','Rhomboid Major','Rhomboid Minor']::text[], equipment = array['Bodyweight','Pull-Up Bar']::text[], aliases = array['Perpendicular Grip Pull-Up','Hammer Grip Pull-Up','Parallel Grip Pull-Up']::text[], created_by = null, admin_reviewed = true, mechanism = 'Compound', pattern = 'pull' where id = '358fc49c-6ba1-4529-9fff-91a9fc8f425d';  -- PROMOTE: Perpendicular Grip Pull-Up
update exercises set mechanism = 'Compound', pattern = 'press' where id = '35b0252c-2133-44a3-b14d-5bbb486b14c1';  -- KEEP: Machine Incline Chest Press
update exercises set mechanism = 'Isolation', pattern = 'core' where id = '35dc0e80-12e3-4273-970b-2ba732bf88eb';  -- KEEP: Machine Crunch
update exercises set mechanism = 'Compound', pattern = 'squat' where id = '367e9af5-c26e-4c64-8c74-dcd1cae824dd';  -- KEEP: Single-Leg Leg Press
update exercises set mechanism = 'Compound', pattern = 'squat' where id = '3797b0ba-75df-4d89-8df3-e29b3d486aa1';  -- KEEP: Machine Pendulum Squat
update exercises set name = 'Dumbbell Curtsy Lunge', primary_muscles = array['Gluteus Maximus']::text[], secondary_muscles = array['Adductor Longus','Adductor Magnus','Gluteus Medius','Vastus Lateralis','Vastus Medialis','Vastus Intermedius']::text[], equipment = array['Dumbbell']::text[], aliases = array['Curtsy Lunges']::text[], mechanism = 'Compound', pattern = 'lunge' where id = '39de0c70-3f3a-4fea-bf91-ac1e0805f00c';  -- UPDATE: Dumbbell Curtsy Lunge
update exercises set mechanism = 'Compound', pattern = 'squat' where id = '3b0f61d9-c313-4871-ade5-f10fb83bc480';  -- KEEP: Machine Leg Press
update exercises set mechanism = 'Isolation', pattern = 'extension' where id = '3b3f3cf4-8526-430f-a7fd-1eac4cfd24a3';  -- KEEP: Dumbbell Skullcrusher
update exercises set mechanism = 'Compound', pattern = 'hinge' where id = '3b75e5f0-2082-47c4-bc03-f82534340ea8';  -- KEEP: Single-Leg Dumbbell RDL
update exercises set mechanism = 'Isolation', pattern = 'curl' where id = '3b85ed3b-2beb-4c2e-8ec2-d0ff1ada4605';  -- KEEP: Alternating Dumbbell Curl
update exercises set name = 'Barbell Hip Thrust', primary_muscles = array['Gluteus Maximus']::text[], secondary_muscles = array['Biceps Femoris (Long)','Vastus Lateralis','Vastus Medialis','Vastus Intermedius']::text[], equipment = array['Barbell','Bench']::text[], aliases = '{}'::text[], mechanism = 'Isolation', pattern = 'hinge' where id = '403b80f9-f5ed-4b1e-8500-188288900c37';  -- UPDATE: Barbell Hip Thrust
update exercises set mechanism = 'Isolation', pattern = 'fly' where id = '41820c9b-cbc9-4a6d-bc69-5ab5f5cbab9f';  -- KEEP: Machine Pec Deck Fly
update exercises set name = 'Cable Upright Row', primary_muscles = array['Deltoid (Lateral)']::text[], secondary_muscles = array['Trapezius (Superior)','Biceps Brachii']::text[], equipment = array['Cable']::text[], aliases = array['Cable Upright Rows']::text[], mechanism = 'Compound', pattern = 'pull' where id = '41deea91-99ea-4d12-b808-b7e474b1eeaa';  -- UPDATE: Cable Upright Row
update exercises set name = 'Weighted Sissy Squat', primary_muscles = array['Rectus Femoris','Vastus Intermedius','Vastus Lateralis','Vastus Medialis']::text[], secondary_muscles = '{}'::text[], equipment = array['Plate','Weighted Vest']::text[], aliases = '{}'::text[], mechanism = 'Isolation', pattern = 'extension' where id = '42db9b99-b3d3-4243-8d50-2adad547d1ec';  -- UPDATE: Weighted Sissy Squat
update exercises set mechanism = 'Compound', pattern = 'lunge' where id = '42f83588-c0d4-4e65-99a4-ad3da0e56164';  -- KEEP: Dumbbell Reverse Lunge
update exercises set mechanism = 'Compound', pattern = 'squat' where id = '43dd4305-d296-489b-ac48-ae1d385381cc';  -- KEEP: Machine Hack Squat
update exercises set name = 'Dumbbell Push Press', primary_muscles = array['Deltoid (Anterior)']::text[], secondary_muscles = array['Triceps (Lateral)','Triceps (Long)','Triceps (Medial)','Deltoid (Lateral)','Vastus Lateralis','Vastus Medialis','Vastus Intermedius']::text[], equipment = array['Dumbbell']::text[], aliases = '{}'::text[], mechanism = 'Compound', pattern = 'press' where id = '4503d5c5-67d8-4a9b-9d90-184ee9e7759a';  -- UPDATE: Dumbbell Push Press
update exercises set name = 'Hanging Straight Leg Raise', primary_muscles = array['Rectus Abdominis (Inferior)']::text[], secondary_muscles = array['Iliopsoas','External Obliques','Flexor Digitorum']::text[], equipment = array['Bodyweight','Pull-Up Bar']::text[], aliases = array['Leg Raises']::text[], mechanism = 'Isolation', pattern = 'core' where id = '46edba1f-ed32-4867-b142-af2220e5ffe0';  -- UPDATE: Hanging Straight Leg Raise
update exercises set mechanism = 'Isolation', pattern = 'raise' where id = '473e5637-cf98-4ecd-8f50-9b1f818930c1';  -- KEEP: Dumbbell Front Raise
update exercises set name = 'Machine Hip Thrust', primary_muscles = array['Gluteus Maximus']::text[], secondary_muscles = array['Biceps Femoris (Long)','Vastus Lateralis','Vastus Medialis','Vastus Intermedius']::text[], equipment = array['Machine']::text[], aliases = array['Hip Thrust Machine']::text[], mechanism = 'Isolation', pattern = 'hinge' where id = '480ae759-0b2e-4e5e-a99f-894463af36a0';  -- UPDATE: Machine Hip Thrust
update exercises set mechanism = 'Compound', pattern = 'row' where id = '487c1e74-6acc-4437-9b94-1e3753a29b85';  -- KEEP: Machine Low Row
update exercises set name = 'Machine Flat Chest Press', primary_muscles = array['Pectoralis Major (Sternal)']::text[], secondary_muscles = array['Triceps (Lateral)','Triceps (Long)','Triceps (Medial)','Deltoid (Anterior)']::text[], equipment = array['Machine']::text[], aliases = array['Chest Press','Machine Chest Press']::text[], mechanism = 'Compound', pattern = 'press' where id = '48e65051-93bb-4b0e-a8da-9da9e227626f';  -- UPDATE: Machine Flat Chest Press
update exercises set name = 'Cable Straight Bar Tricep Pushdown', primary_muscles = array['Triceps (Lateral)','Triceps (Long)','Triceps (Medial)']::text[], secondary_muscles = '{}'::text[], equipment = array['Cable']::text[], aliases = array['Bar Pushdowns','EZ-Bar Tricep Pushdown']::text[], mechanism = 'Isolation', pattern = 'extension' where id = '49701a92-09ea-45d5-bab9-282d434a93c7';  -- UPDATE: Cable Straight Bar Tricep Pushdown
update exercises set mechanism = 'Compound', pattern = 'press' where id = '49e9b390-8ff6-4b3b-9ed4-ebb93c51f927';  -- KEEP: Dumbbell Flat Bench Press
update exercises set name = 'Suitcase Carry', primary_muscles = array['External Obliques','Internal Obliques']::text[], secondary_muscles = array['Quadratus Lumborum','Gluteus Medius','Flexor Digitorum','Trapezius (Superior)']::text[], equipment = array['Dumbbell','Kettlebell']::text[], aliases = array['Single-Arm Carry']::text[], mechanism = 'Compound', pattern = 'carry' where id = '4a91c8e5-7c3a-4222-8d3c-a6a7985de662';  -- UPDATE: Suitcase Carry
update exercises set mechanism = 'Compound', pattern = 'press' where id = '4b52eeb2-d0fa-4a02-8677-98134855fb44';  -- KEEP: Smith Close-Grip Press
update exercises set mechanism = 'Compound', pattern = 'lunge' where id = '4cee019e-5c8d-45ec-99a4-4eae4026fe9d';  -- KEEP: Dumbbell Walking Lunge
update exercises set mechanism = 'Isolation', pattern = 'curl' where id = '4ceea05f-b906-44a4-851f-d2d1d612f13f';  -- KEEP: Dumbbell Hammer Curl
update exercises set name = 'Single-Arm Neutral Grip Machine High Row', primary_muscles = array['Latissimus Dorsi','Teres Major']::text[], secondary_muscles = array['Rhomboid Major','Rhomboid Minor','Trapezius (Middle)','Trapezius (Inferior)','Deltoid (Posterior)','Biceps Brachii','Brachialis']::text[], equipment = array['Machine']::text[], aliases = '{}'::text[], mechanism = 'Compound', pattern = 'row' where id = '4e1b14d8-d914-4098-904b-a2cdb4c5e20f';  -- UPDATE: Single-Arm Neutral Grip Machine High Row
update exercises set name = 'Weight Russian Twist', primary_muscles = array['External Obliques']::text[], secondary_muscles = array['Rectus Abdominis (Superior)','Iliopsoas']::text[], equipment = array['Dumbbell','Kettlebell','Plate']::text[], aliases = array['Russian Twists']::text[], mechanism = 'Isolation', pattern = 'core' where id = '4e23f556-8e46-4a2c-9a89-1306a388426e';  -- UPDATE: Weight Russian Twist
update exercises set name = 'Single-Arm Cable Row', primary_muscles = array['Latissimus Dorsi']::text[], secondary_muscles = array['Biceps Brachii','Deltoid (Posterior)','Rhomboid Major','Rhomboid Minor','Trapezius (Middle)']::text[], equipment = array['Cable']::text[], aliases = '{}'::text[], mechanism = 'Compound', pattern = 'row' where id = '4fa86f46-36d5-40b3-9fd3-727c4cd73cc6';  -- UPDATE: Single-Arm Cable Row
update exercises set mechanism = 'Isolation', pattern = 'pull' where id = '4fc7ea24-0f89-4cd7-ad01-e59cb5e991a2';  -- KEEP: Dumbbell Pullover
update exercises set name = 'Ab Wheel Rollout', primary_muscles = array['Rectus Abdominis (Superior)']::text[], secondary_muscles = array['Latissimus Dorsi','Transverse Abdominis']::text[], equipment = array['Bodyweight','Ab Wheel']::text[], aliases = array['Ab Rollouts']::text[], mechanism = 'Isolation', pattern = 'core' where id = '5033b139-a0ab-4a85-af8e-681f4fa6a426';  -- UPDATE: Ab Wheel Rollout
update exercises set name = 'Reverse Nordic Curl', primary_muscles = array['Rectus Femoris','Vastus Lateralis','Vastus Medialis','Vastus Intermedius']::text[], secondary_muscles = array['Iliopsoas']::text[], equipment = array['Bodyweight']::text[], aliases = array['Bodyweight Leg Extension']::text[], mechanism = 'Isolation', pattern = 'extension' where id = '50826c48-1617-46f1-be5d-b582f842c325';  -- UPDATE: Reverse Nordic Curl
update exercises set mechanism = 'Isolation', pattern = 'fly' where id = '50d686b5-8732-429c-83b8-1d3526676b19';  -- KEEP: Incline Dumbbell Fly
update exercises set name = 'Single-Arm Dumbbell Row', primary_muscles = array['Latissimus Dorsi']::text[], secondary_muscles = array['Biceps Brachii','Deltoid (Posterior)','Rhomboid Major','Rhomboid Minor','Trapezius (Middle)']::text[], equipment = array['Dumbbell','Bench']::text[], aliases = '{}'::text[], mechanism = 'Compound', pattern = 'row' where id = '519904e0-6831-4051-ac9a-e90eeaecfee6';  -- UPDATE: Single-Arm Dumbbell Row
update exercises set name = 'Single-Leg Leg Extension', primary_muscles = array['Rectus Femoris','Vastus Intermedius','Vastus Lateralis','Vastus Medialis']::text[], secondary_muscles = '{}'::text[], equipment = array['Machine']::text[], aliases = array['Single-Leg Extension']::text[], mechanism = 'Isolation', pattern = 'extension' where id = '528ee827-d631-450c-bd0d-89ae9717ea87';  -- UPDATE: Single-Leg Leg Extension
update exercises set mechanism = 'Isolation', pattern = 'abduction' where id = '531a3d83-aaff-48ac-bd51-9539cd00f3b1';  -- KEEP: Machine Seated Hip Abduction
update exercises set mechanism = 'Compound', pattern = 'press' where id = '53617f28-9afc-4ea1-af0a-df1305e829d2';  -- KEEP: Barbell Flat Bench Press
update exercises set name = 'Cable Lateral Raise', primary_muscles = array['Deltoid (Lateral)']::text[], secondary_muscles = array['Deltoid (Anterior)','Trapezius (Superior)']::text[], equipment = array['Cable']::text[], aliases = array['Cable Side Raises','Cuffed Lateral Raise','Cable Cuff Lateral Raise']::text[], mechanism = 'Isolation', pattern = 'raise' where id = '536c7077-06ee-493e-ad3a-afb277b53995';  -- UPDATE: Cable Lateral Raise
update exercises set mechanism = 'Isolation', pattern = 'extension' where id = '53c9edbc-81c0-4061-afd2-12055c818a5a';  -- KEEP: Banded Glute Kickback
update exercises set mechanism = 'Isolation', pattern = 'curl' where id = '5464fed3-ade6-4506-87f5-9dd488d81673';  -- KEEP: Dumbbell Recline Curl
update exercises set mechanism = 'Isolation', pattern = 'curl' where id = '546da2b9-6880-4d7c-b4bc-339570101428';  -- KEEP: Dumbbell Leg Curl
update exercises set mechanism = 'Compound', pattern = 'press' where id = '54908826-a607-4bfd-bb2b-63e7a4a4c6b2';  -- KEEP: Machine JM Press
update exercises set mechanism = 'Compound', pattern = 'pull' where id = '556c0601-622a-4a5c-ab18-fbf28346477b';  -- KEEP: Iso-Lateral Front Lat Pulldown
update exercises set mechanism = 'Compound', pattern = 'press' where id = '558f0036-decd-44c0-8ace-dc75e9c59e67';  -- KEEP: Standing Barbell Overhead Press
update exercises set name = 'Cable Reverse Curl', primary_muscles = array['Brachioradialis']::text[], secondary_muscles = array['Brachialis','Biceps Brachii','Extensor Carpi Radialis']::text[], equipment = array['Cable']::text[], aliases = array['Cable Reverse Grip Curl']::text[], created_by = null, admin_reviewed = true, mechanism = 'Isolation', pattern = 'curl' where id = '5677e6e5-1d9a-4752-a2ce-f7633f3b9134';  -- PROMOTE: Reverse Curl Cable
update exercises set mechanism = 'Isolation', pattern = 'raise' where id = '58d5eabe-d74d-428a-8b92-965db12e76bd';  -- KEEP: Dumbbell Lateral Raise
update exercises set mechanism = 'Isolation', pattern = 'extension' where id = '5929dbf7-6d7f-49e4-92c9-f9c62d5c0ee2';  -- KEEP: Machine Leg Extension
update exercises set name = 'Diamond Push-Up', primary_muscles = array['Pectoralis Major (Sternal)']::text[], secondary_muscles = array['Triceps (Lateral)','Triceps (Long)','Triceps (Medial)','Deltoid (Anterior)']::text[], equipment = array['Bodyweight']::text[], aliases = array['Triangle Push-Ups']::text[], mechanism = 'Compound', pattern = 'press' where id = '5994a160-d2b3-4d9a-a169-5161b10e565b';  -- UPDATE: Diamond Push-Up
update exercises set name = 'Rack Pull', primary_muscles = array['Erector Spinae','Gluteus Maximus']::text[], secondary_muscles = array['Trapezius (Superior)','Latissimus Dorsi','Biceps Femoris (Long)','Flexor Digitorum']::text[], equipment = array['Barbell','Rack']::text[], aliases = array['Block Pulls','Block Pull','Barbell Block Pull']::text[], mechanism = 'Compound', pattern = 'hinge' where id = '59fc34a0-06b6-4ab8-9907-d2e017f21ba5';  -- UPDATE: Rack Pull
update exercises set name = 'Bodyweight Bench Dip', primary_muscles = array['Triceps (Lateral)','Triceps (Long)','Triceps (Medial)']::text[], secondary_muscles = array['Deltoid (Anterior)','Pectoralis Major (Sternal)']::text[], equipment = array['Bodyweight','Bench']::text[], aliases = array['Bench Dips']::text[], mechanism = 'Compound', pattern = 'press' where id = '5a7144f0-a953-447f-a5fd-6a01fca62580';  -- UPDATE: Bodyweight Bench Dip
update exercises set mechanism = 'Isolation', pattern = 'row' where id = '5acaa904-bad8-46b6-9f20-cf954a477c8c';  -- KEEP: Wide-Grip Barbell Rear Delt Row
update exercises set name = 'Bodyweight Sit-Up', primary_muscles = array['Rectus Abdominis (Superior)']::text[], secondary_muscles = array['External Obliques','Iliopsoas']::text[], equipment = array['Bodyweight']::text[], aliases = array['Sit-Ups']::text[], mechanism = 'Isolation', pattern = 'core' where id = '5d111dcb-ca20-4365-bf17-c910afec2f68';  -- UPDATE: Bodyweight Sit-Up
update exercises set name = 'Bicycle Crunch', primary_muscles = array['External Obliques']::text[], secondary_muscles = array['Rectus Abdominis (Superior)','Iliopsoas']::text[], equipment = array['Bodyweight']::text[], aliases = array['Bicycles']::text[], mechanism = 'Isolation', pattern = 'core' where id = '5de4c904-1d1c-41c3-9905-f8fc1d02a63f';  -- UPDATE: Bicycle Crunch
update exercises set name = 'Leaning Dumbbell Lateral Raise', primary_muscles = array['Deltoid (Lateral)']::text[], secondary_muscles = array['Deltoid (Anterior)','Trapezius (Superior)']::text[], equipment = array['Dumbbell','Rack']::text[], aliases = array['Leaning Side Raises']::text[], mechanism = 'Isolation', pattern = 'raise' where id = '5de59717-ac60-4f6c-b050-d4cc250214c4';  -- UPDATE: Leaning Dumbbell Lateral Raise
update exercises set name = 'Bodyweight Sissy Squat', primary_muscles = array['Rectus Femoris','Vastus Intermedius','Vastus Lateralis','Vastus Medialis']::text[], secondary_muscles = '{}'::text[], equipment = array['Bodyweight']::text[], aliases = array['Sissy Squat']::text[], mechanism = 'Isolation', pattern = 'extension' where id = '5e316f57-3c4a-49de-af16-bb5c9d7cb7b0';  -- UPDATE: Bodyweight Sissy Squat
update exercises set mechanism = 'Isolation', pattern = 'curl' where id = '5e94a43b-95dc-4d37-ac1b-0b54d4137fe3';  -- KEEP: Barbell Bicep Curl
update exercises set mechanism = 'Compound', pattern = 'row' where id = '5ee984e2-89d8-47f8-b37c-ea1e4539e312';  -- KEEP: Dumbbell Seal Row
update exercises set mechanism = 'Compound', pattern = 'press' where id = '627bfcf5-f198-4bcf-a279-4cad98775ff8';  -- KEEP: Iso-Lateral Incline Press
update exercises set name = 'Weighted Push-Up', primary_muscles = array['Pectoralis Major (Sternal)']::text[], secondary_muscles = array['Triceps (Lateral)','Triceps (Long)','Triceps (Medial)','Deltoid (Anterior)','Serratus Anterior']::text[], equipment = array['Plate','Weighted Vest']::text[], aliases = array['Weighted Push-Ups']::text[], mechanism = 'Compound', pattern = 'press' where id = '62e013c3-e889-4832-8f97-dc86fb8a7590';  -- UPDATE: Weighted Push-Up
update exercises set mechanism = 'Isolation', pattern = 'shrug' where id = '630e9f00-99fa-4ce2-bb47-615acedb7691';  -- KEEP: Trap Bar Shrug
update exercises set mechanism = 'Compound', pattern = 'press' where id = '65d2a138-4ee7-44eb-ba77-b18f7f1b1128';  -- KEEP: JM Press
update exercises set mechanism = 'Compound', pattern = 'pull' where id = '67c93377-7eeb-4bca-ad46-409764bad18a';  -- KEEP: Machine Lat Pulldown
update exercises set name = 'Wide Grip Lat Pulldown', primary_muscles = array['Latissimus Dorsi']::text[], secondary_muscles = array['Biceps Brachii','Rhomboid Major','Rhomboid Minor','Deltoid (Posterior)','Teres Major']::text[], equipment = array['Cable']::text[], aliases = array['Pulldowns']::text[], mechanism = 'Compound', pattern = 'pull' where id = '67fcdd10-d8a2-4a3a-a5f0-34c9eb233791';  -- UPDATE: Wide Grip Lat Pulldown
update exercises set mechanism = 'Compound', pattern = 'press' where id = '6a4b584e-8059-446f-b49c-ef5064bf6e23';  -- KEEP: Arnold Press
update exercises set mechanism = 'Compound', pattern = 'press' where id = '6a5dbd89-437c-4830-9160-ba87d75c8d8c';  -- KEEP: Single-Arm Landmine Press
update exercises set mechanism = 'Isolation', pattern = 'raise' where id = '6ac22d5a-dcf3-4d9a-92af-c58bea5b4902';  -- KEEP: Dumbbell Seated Calf Raise
update exercises set mechanism = 'Isolation', pattern = 'extension' where id = '6b307dfa-481b-47a1-bf36-70f681f40dd1';  -- KEEP: Seated Dumbbell Overhead Extension
update exercises set mechanism = 'Compound', pattern = 'press' where id = '6b957d1c-cebb-4e44-9fe0-2af2ade7f20e';  -- KEEP: Seated Barbell Overhead Press
update exercises set mechanism = 'Compound', pattern = 'press' where id = '6c33c2b0-07ad-48ba-82fc-f6ad78edf41a';  -- KEEP: Dumbbell Incline Bench Press
update exercises set mechanism = 'Compound', pattern = 'lunge' where id = '6db3c02a-ade1-4e5b-b23a-8460c5565d50';  -- KEEP: Dumbbell Step-Up
update exercises set mechanism = 'Isolation', pattern = 'curl' where id = '6e1014be-20aa-4015-b263-afa79ce6785e';  -- KEEP: Standing Single-Leg Curl
update exercises set mechanism = 'Isolation', pattern = 'curl' where id = '6e705e68-011d-48b1-8dd9-206520ddef18';  -- KEEP: Dumbbell Preacher Curl
update exercises set name = 'Lying Leg Raise', primary_muscles = array['Rectus Abdominis (Inferior)']::text[], secondary_muscles = array['Iliopsoas','External Obliques']::text[], equipment = array['Bodyweight']::text[], aliases = array['Lying Leg Lifts']::text[], mechanism = 'Isolation', pattern = 'core' where id = '6f091b77-b0d6-435e-b63e-0f10259bb19f';  -- UPDATE: Lying Leg Raise
update exercises set mechanism = 'Isolation', pattern = 'curl' where id = '6f463e04-f1f6-4552-9cc0-b2799e57b306';  -- KEEP: Reverse Barbell Curl
update exercises set name = 'Barbell Back Squat', primary_muscles = array['Vastus Lateralis','Vastus Medialis','Vastus Intermedius','Gluteus Maximus']::text[], secondary_muscles = array['Rectus Femoris','Adductor Magnus','Erector Spinae']::text[], equipment = array['Barbell']::text[], aliases = array['Squat','Back Squat']::text[], mechanism = 'Compound', pattern = 'squat' where id = '710c3145-3c2d-4218-9e5a-4532f54e21d7';  -- UPDATE: Barbell Back Squat
update exercises set name = 'Close-Grip Neutral Lat Pulldown', primary_muscles = array['Latissimus Dorsi']::text[], secondary_muscles = array['Biceps Brachii','Rhomboid Major','Rhomboid Minor','Deltoid (Posterior)','Teres Major']::text[], equipment = array['Cable']::text[], aliases = array['V-Bar Pulldowns']::text[], mechanism = 'Compound', pattern = 'pull' where id = '71bf9ddf-23b0-46e7-b959-a21b6916323b';  -- UPDATE: Close-Grip Neutral Lat Pulldown
update exercises set mechanism = 'Compound', pattern = 'press' where id = '71f76bec-0bb4-485e-ae51-9d3360ae4f20';  -- KEEP: Smith Machine Incline Press
update exercises set mechanism = 'Isolation', pattern = 'curl' where id = '72b319be-9c8a-480c-ac0b-eea283de37c9';  -- KEEP: Reverse EZ-Bar Curl
update exercises set mechanism = 'Compound', pattern = 'squat' where id = '737faf85-9c99-41a2-8406-23b0d567cade';  -- KEEP: Smith Machine Squat
update exercises set name = 'Underhand Lat Pulldown', primary_muscles = array['Latissimus Dorsi']::text[], secondary_muscles = array['Biceps Brachii','Rhomboid Major','Rhomboid Minor','Teres Major']::text[], equipment = array['Cable']::text[], aliases = array['Reverse Pulldowns']::text[], mechanism = 'Compound', pattern = 'pull' where id = '7389be92-4c0b-433b-9c1c-034a9a25663c';  -- UPDATE: Underhand Lat Pulldown
update exercises set mechanism = 'Isolation', pattern = 'shrug' where id = '740bbbc6-f45d-4030-aeda-540911874ea9';  -- KEEP: Dumbbell Shrug
update exercises set name = 'Leg Extension Hamstring Curls', primary_muscles = array['Rectus Femoris','Vastus Lateralis','Vastus Medialis','Vastus Intermedius','Biceps Femoris (Long)','Biceps Femoris (Short)','Semitendinosus','Semimembranosus']::text[], secondary_muscles = '{}'::text[], equipment = array['Machine']::text[], aliases = '{}'::text[], mechanism = 'Isolation', pattern = 'curl' where id = '74f4da07-9031-42b5-ac6f-faf48bfa3ce0';  -- PRIVATE: Leg Extension Hamstring Curls
update exercises set mechanism = 'Isolation', pattern = 'raise' where id = '75114527-cd71-483a-addb-b27823ad4de2';  -- KEEP: Seated Dumbbell Lateral Raise
update exercises set mechanism = 'Compound', pattern = 'hinge' where id = '751ba3fb-9850-442f-8c5e-ca8a94581d18';  -- KEEP: Dumbbell Stiff-Leg Deadlift
update exercises set mechanism = 'Compound', pattern = 'press' where id = '764b6735-6d19-4112-8ef0-946f8af041d6';  -- KEEP: Standing Dumbbell Press
update exercises set mechanism = 'Isolation', pattern = 'curl' where id = '76aed9f0-4b8e-4bd6-96a2-c0917084dfbb';  -- KEEP: Barbell Drag Curl
update exercises set name = 'Barbell Deficit Deadlift', primary_muscles = array['Gluteus Maximus','Erector Spinae']::text[], secondary_muscles = array['Latissimus Dorsi','Trapezius (Superior)','Flexor Digitorum','Vastus Lateralis','Vastus Medialis','Vastus Intermedius']::text[], equipment = array['Barbell','Block']::text[], aliases = array['Deficit Deadlifts']::text[], mechanism = 'Compound', pattern = 'hinge' where id = '799da007-1001-4842-a3f7-851008f76dac';  -- UPDATE: Barbell Deficit Deadlift
update exercises set mechanism = 'Compound', pattern = 'lunge' where id = '79b33415-6750-4aaa-83e2-ee46843ea1c2';  -- KEEP: Barbell Walking Lunge
update exercises set mechanism = 'Isolation', pattern = 'curl' where id = '7a64436a-8545-45dd-ad0a-0d4801742010';  -- KEEP: EZ-Bar Bicep Curl
update exercises set name = 'Dumbbell Power Clean', primary_muscles = array['Gluteus Maximus','Trapezius (Superior)','Vastus Lateralis','Vastus Medialis','Vastus Intermedius']::text[], secondary_muscles = array['Erector Spinae','Biceps Femoris (Long)','Gastrocnemius (Medial)']::text[], equipment = array['Dumbbell']::text[], aliases = array['Dumbbell Cleans']::text[], mechanism = 'Compound', pattern = 'olympic' where id = '7ac3068c-b6cf-40e4-b1bf-f4ebf1bf49e1';  -- UPDATE: Dumbbell Power Clean
update exercises set name = 'Single-Leg Dumbbell Thrust', primary_muscles = array['Gluteus Maximus']::text[], secondary_muscles = array['Biceps Femoris (Long)','Gluteus Medius']::text[], equipment = array['Dumbbell','Bench']::text[], aliases = array['Single-Leg Thrust']::text[], mechanism = 'Isolation', pattern = 'hinge' where id = '7b45d71f-0a46-4e92-9929-131e2587d1bc';  -- UPDATE: Single-Leg Dumbbell Thrust
update exercises set mechanism = 'Compound', pattern = 'press' where id = '7ba592dd-8c6e-4320-b579-2f71f5fedd36';  -- KEEP: Machine Decline Chest Press
update exercises set mechanism = 'Compound', pattern = 'row' where id = '7bbc29b2-1412-4956-a554-c60d65db6362';  -- KEEP: Barbell Underhand Row
update exercises set name = 'Windshield Wipers', primary_muscles = array['External Obliques']::text[], secondary_muscles = array['Rectus Abdominis (Superior)','Iliopsoas']::text[], equipment = array['Bodyweight','Pull-Up Bar']::text[], aliases = array['Wipers']::text[], mechanism = 'Isolation', pattern = 'core' where id = '7c0f3752-bf8b-46b3-8e82-b1d996ef963d';  -- UPDATE: Windshield Wipers
update exercises set name = 'Cable Woodchopper', primary_muscles = array['External Obliques']::text[], secondary_muscles = array['Rectus Abdominis (Superior)','Transverse Abdominis']::text[], equipment = array['Cable']::text[], aliases = array['Woodchops']::text[], mechanism = 'Isolation', pattern = 'core' where id = '7d0f65cb-2eb9-4ad2-8f85-ad72e849f75a';  -- UPDATE: Cable Woodchopper
update exercises set mechanism = 'Isolation', pattern = 'extension' where id = '7d5a7dbf-3dab-4cbf-b174-6aecd7aaaba9';  -- KEEP: Machine Tricep Extension
update exercises set name = 'Weighted Chin-Up', primary_muscles = array['Latissimus Dorsi']::text[], secondary_muscles = array['Biceps Brachii','Rhomboid Major','Rhomboid Minor','Teres Major']::text[], equipment = array['Bodyweight','Pull-Up Bar','Weight Belt','Weighted Vest']::text[], aliases = array['Weighted Chin-Ups']::text[], mechanism = 'Compound', pattern = 'pull' where id = '7e647c62-6c2e-46c2-93c3-886dfcc0841e';  -- UPDATE: Weighted Chin-Up
update exercises set mechanism = 'Compound', pattern = 'hinge' where id = '7f00c0d7-499b-4ecc-9210-b040ed1c171a';  -- KEEP: Trap Bar Deadlift
update exercises set name = 'Cable Straight Bar Curl', primary_muscles = array['Biceps Brachii']::text[], secondary_muscles = array['Brachialis','Brachioradialis']::text[], equipment = array['Cable']::text[], aliases = array['Cable Curls','V-Bar Bicep Curl']::text[], mechanism = 'Isolation', pattern = 'curl' where id = '7f66eab6-3b6c-46e5-9f03-65315326dcfa';  -- UPDATE: Cable Straight Bar Curl
update exercises set name = 'Barbell Power Clean', primary_muscles = array['Gluteus Maximus','Trapezius (Superior)','Vastus Lateralis','Vastus Medialis','Vastus Intermedius']::text[], secondary_muscles = array['Erector Spinae','Biceps Femoris (Long)','Gastrocnemius (Medial)']::text[], equipment = array['Barbell']::text[], aliases = array['Cleans']::text[], mechanism = 'Compound', pattern = 'olympic' where id = '8139927a-394e-4a16-b21c-e3a29b672afc';  -- UPDATE: Barbell Power Clean
update exercises set name = 'Cable Rope Hammer Curl', primary_muscles = array['Brachialis']::text[], secondary_muscles = array['Biceps Brachii','Brachioradialis']::text[], equipment = array['Cable']::text[], aliases = array['Rope Curls']::text[], mechanism = 'Isolation', pattern = 'curl' where id = '833abade-645f-478c-8159-cd158a03f85e';  -- UPDATE: Cable Rope Hammer Curl
update exercises set mechanism = 'Compound', pattern = 'lunge' where id = '837b9484-b933-491f-9045-e7447dd880b8';  -- KEEP: Dumbbell Standard Split Squat
update exercises set mechanism = 'Compound', pattern = 'squat' where id = '838beab6-aed7-482d-8e23-30ffc8e3e5eb';  -- KEEP: Machine V-Squat
update exercises set mechanism = 'Isolation', pattern = 'curl' where id = '83e2e314-9e82-4fd7-94f5-375ce525e430';  -- KEEP: Barbell Reverse Wrist Curl
update exercises set mechanism = 'Compound', pattern = 'squat' where id = '845f688c-0ffe-4a0d-b544-3963696bb906';  -- KEEP: Barbell Zercher Squat
update exercises set name = 'Single-Arm Cable Curl', primary_muscles = array['Biceps Brachii']::text[], secondary_muscles = array['Brachialis','Brachioradialis']::text[], equipment = array['Cable']::text[], aliases = array['Single-Arm Cable Curls','Single Arm Cable Curl']::text[], mechanism = 'Isolation', pattern = 'curl' where id = '85063456-96d8-45c1-8e02-d3fe2ccb208f';  -- UPDATE: Single-Arm Cable Curl
update exercises set name = 'Bodyweight Dead Bug', primary_muscles = array['Transverse Abdominis']::text[], secondary_muscles = array['Rectus Abdominis (Superior)','External Obliques']::text[], equipment = array['Bodyweight']::text[], aliases = array['Dead Bugs']::text[], mechanism = 'Isolation', pattern = 'core' where id = '860eb2f5-754f-44ab-868c-e73881754aeb';  -- UPDATE: Bodyweight Dead Bug
update exercises set name = 'Hollow Body Hold', primary_muscles = array['Transverse Abdominis']::text[], secondary_muscles = array['Rectus Abdominis (Superior)','External Obliques']::text[], equipment = array['Bodyweight']::text[], aliases = array['Hollow Holds']::text[], mechanism = 'Isolation', pattern = 'core' where id = '86dd0741-949d-4fe1-bc72-56f91adef505';  -- UPDATE: Hollow Body Hold
update exercises set name = 'Cable Front Raise', primary_muscles = array['Deltoid (Anterior)']::text[], secondary_muscles = array['Deltoid (Lateral)']::text[], equipment = array['Cable']::text[], aliases = array['Cable Front Raises']::text[], mechanism = 'Isolation', pattern = 'raise' where id = '87437234-152f-44b4-82e3-d033a6c4f137';  -- UPDATE: Cable Front Raise
update exercises set mechanism = 'Isolation', pattern = 'extension' where id = '88036f0b-15ca-481c-a4d6-e77a59c32bd8';  -- KEEP: Single-Arm Cross Body Tricep Extension
update exercises set mechanism = 'Compound', pattern = 'squat' where id = '89b499ba-77ee-4c73-ad0a-e7532957a130';  -- KEEP: Barbell Front Squat
update exercises set name = 'Decline Push-Up', primary_muscles = array['Pectoralis Major (Clavicular)']::text[], secondary_muscles = array['Triceps (Lateral)','Triceps (Long)','Triceps (Medial)','Deltoid (Anterior)','Serratus Anterior']::text[], equipment = array['Bodyweight','Bench','Box']::text[], aliases = array['Feet Elevated Push-Ups']::text[], mechanism = 'Compound', pattern = 'press' where id = '8b69867d-8d69-4c7c-8284-67e6401339cb';  -- UPDATE: Decline Push-Up
update exercises set mechanism = 'Compound', pattern = 'row' where id = '8b809b17-244f-4844-8222-96808c70b7cf';  -- KEEP: Chest-Supported Dumbbell Row
update exercises set name = 'Cable Crunch', primary_muscles = array['Rectus Abdominis (Superior)']::text[], secondary_muscles = array['External Obliques']::text[], equipment = array['Cable']::text[], aliases = array['Rope Crunches']::text[], mechanism = 'Isolation', pattern = 'core' where id = '8c9815b3-7512-4017-a622-6bd49fd39e41';  -- UPDATE: Cable Crunch
update exercises set name = 'Cable Tricep Kickback', primary_muscles = array['Triceps (Lateral)','Triceps (Long)','Triceps (Medial)']::text[], secondary_muscles = '{}'::text[], equipment = array['Cable']::text[], aliases = array['Cable Kickbacks']::text[], mechanism = 'Isolation', pattern = 'extension' where id = '8e7c7df9-fd0f-4fd1-97d5-fdd86563f9f4';  -- UPDATE: Cable Tricep Kickback
update exercises set name = 'Dumbbell Floor Press', primary_muscles = array['Pectoralis Major (Sternal)']::text[], secondary_muscles = array['Triceps (Lateral)','Triceps (Long)','Triceps (Medial)','Deltoid (Anterior)']::text[], equipment = array['Dumbbell']::text[], aliases = '{}'::text[], mechanism = 'Compound', pattern = 'press' where id = '8f1fc7f8-e6cb-40e3-9d52-3ae1c10f9c16';  -- UPDATE: Dumbbell Floor Press
update exercises set name = 'Iso-Lateral Low Row', primary_muscles = array['Latissimus Dorsi','Teres Major']::text[], secondary_muscles = array['Rhomboid Major','Rhomboid Minor','Trapezius (Middle)','Deltoid (Posterior)','Biceps Brachii','Brachialis']::text[], equipment = array['Machine']::text[], aliases = array['Iso-Lateral Row']::text[], mechanism = 'Compound', pattern = 'row' where id = '8f74f40b-384c-48e4-9109-762ad197fcad';  -- UPDATE: Iso-Lateral Low Row
update exercises set name = 'Bodyweight Pull-Up', primary_muscles = array['Latissimus Dorsi']::text[], secondary_muscles = array['Biceps Brachii','Rhomboid Major','Rhomboid Minor','Deltoid (Posterior)','Teres Major']::text[], equipment = array['Bodyweight','Pull-Up Bar']::text[], aliases = array['Pull-Ups']::text[], mechanism = 'Compound', pattern = 'pull' where id = '903c0a56-d723-44de-b31d-c3fb7a1494d7';  -- UPDATE: Bodyweight Pull-Up
update exercises set name = 'Bodyweight Plank', primary_muscles = array['Transverse Abdominis']::text[], secondary_muscles = array['Rectus Abdominis (Superior)','External Obliques']::text[], equipment = array['Bodyweight']::text[], aliases = array['Front Plank']::text[], mechanism = 'Isolation', pattern = 'core' where id = '922e3fbb-44a2-4031-a2c8-91e1f4dd3e02';  -- UPDATE: Bodyweight Plank
update exercises set mechanism = 'Compound', pattern = 'pull' where id = '93cb0028-b310-4955-a412-067d20c59e54';  -- KEEP: Machine Assisted Pull-Up
update exercises set mechanism = 'Compound', pattern = 'olympic' where id = '9635cbc7-2518-4a9d-94f1-641ad69679ff';  -- KEEP: Barbell Thruster
update exercises set mechanism = 'Compound', pattern = 'row' where id = '991b642f-7c3a-43d3-b409-32823979d118';  -- KEEP: Barbell Bent-Over Row
update exercises set name = 'Cable Rope Tricep Pushdown', primary_muscles = array['Triceps (Lateral)','Triceps (Long)','Triceps (Medial)']::text[], secondary_muscles = '{}'::text[], equipment = array['Cable']::text[], aliases = array['Rope Pushdowns']::text[], mechanism = 'Isolation', pattern = 'extension' where id = '99427488-9c8b-43dc-80c8-6386b8eb66f6';  -- UPDATE: Cable Rope Tricep Pushdown
update exercises set name = 'Wide-Grip Pull-Up', primary_muscles = array['Latissimus Dorsi','Teres Major']::text[], secondary_muscles = array['Rhomboid Major','Rhomboid Minor','Trapezius (Inferior)','Biceps Brachii']::text[], equipment = array['Bodyweight','Pull-Up Bar']::text[], aliases = array['Wide Grip Pull-Up']::text[], created_by = null, admin_reviewed = true, mechanism = 'Compound', pattern = 'pull' where id = '9956ff12-3a7c-4240-b1e2-97b3e9c552f9';  -- PROMOTE: Wide Grip Pull-Up
update exercises set name = 'Standing Dumbbell Overhead Tricep Extension', primary_muscles = array['Triceps (Long)','Triceps (Lateral)','Triceps (Medial)']::text[], secondary_muscles = '{}'::text[], equipment = array['Dumbbell']::text[], aliases = array['Two-Hand Dumbbell Overhead Extension']::text[], created_by = null, admin_reviewed = true, mechanism = 'Isolation', pattern = 'extension' where id = '9a7d8f50-e726-4b49-b2e6-d0f1dd37af80';  -- PROMOTE: Overhead Tricep Dumbbell Extension
update exercises set name = 'Cable Reverse Fly', primary_muscles = array['Deltoid (Posterior)']::text[], secondary_muscles = array['Rhomboid Major','Rhomboid Minor','Trapezius (Middle)']::text[], equipment = array['Cable']::text[], aliases = array['Cable Rear Delt Flys']::text[], mechanism = 'Isolation', pattern = 'fly' where id = '9b8e42e9-4e33-44f8-b8f5-b2c9a567b35e';  -- UPDATE: Cable Reverse Fly
update exercises set name = 'Bodyweight Push-Up', primary_muscles = array['Pectoralis Major (Sternal)']::text[], secondary_muscles = array['Triceps (Lateral)','Triceps (Long)','Triceps (Medial)','Deltoid (Anterior)','Serratus Anterior']::text[], equipment = array['Bodyweight']::text[], aliases = array['Push-Ups']::text[], mechanism = 'Compound', pattern = 'press' where id = '9cb6aaf7-3204-4571-b8d3-dc76455255ce';  -- UPDATE: Bodyweight Push-Up
update exercises set name = 'Machine Seated Leg Curl', primary_muscles = array['Biceps Femoris (Long)','Biceps Femoris (Short)','Semimembranosus','Semitendinosus']::text[], secondary_muscles = array['Gastrocnemius (Medial)']::text[], equipment = array['Machine']::text[], aliases = array['Seated Ham Curls','Hamstring Curl','Seated Leg Curl']::text[], mechanism = 'Isolation', pattern = 'curl' where id = '9d513f3e-fa3d-47b0-839e-e4f1cfc2dce7';  -- UPDATE: Machine Seated Leg Curl
update exercises set name = 'Dumbbell Goblet Squat', primary_muscles = array['Rectus Femoris','Vastus Intermedius','Vastus Lateralis','Vastus Medialis']::text[], secondary_muscles = array['Gluteus Maximus','Adductor Longus','Adductor Magnus','Erector Spinae']::text[], equipment = array['Dumbbell']::text[], aliases = '{}'::text[], mechanism = 'Compound', pattern = 'squat' where id = '9de32f90-4145-4118-be47-6d4a93c004d7';  -- UPDATE: Dumbbell Goblet Squat
update exercises set name = 'Barbell High-Bar Back Squat', primary_muscles = array['Rectus Femoris','Vastus Intermedius','Vastus Lateralis','Vastus Medialis']::text[], secondary_muscles = array['Gluteus Maximus','Adductor Longus','Adductor Magnus','Erector Spinae']::text[], equipment = array['Barbell','Rack']::text[], aliases = array['High-Bar Squat']::text[], mechanism = 'Compound', pattern = 'squat' where id = '9e22c9cc-0907-459d-82e4-803bfeda5f4a';  -- UPDATE: Barbell High-Bar Back Squat
update exercises set name = 'Mid-Level Cable Fly', primary_muscles = array['Pectoralis Major (Sternal)']::text[], secondary_muscles = array['Deltoid (Anterior)']::text[], equipment = array['Cable']::text[], aliases = array['Cable Flys']::text[], mechanism = 'Isolation', pattern = 'fly' where id = '9ea09812-4307-4358-a429-01b08f20538b';  -- UPDATE: Mid-Level Cable Fly
update exercises set mechanism = 'Compound', pattern = 'pull' where id = 'a050a973-0a4f-422c-b492-b1a0d3875d81';  -- KEEP: Barbell Upright Row
update exercises set mechanism = 'Isolation', pattern = 'curl' where id = 'a16a4636-37c2-477b-88cc-9a0449c468e6';  -- KEEP: EZ-Bar Preacher Curl
update exercises set name = 'Barbell Clean and Jerk', primary_muscles = array['Gluteus Maximus','Vastus Lateralis','Vastus Medialis','Vastus Intermedius','Deltoid (Anterior)','Trapezius (Superior)']::text[], secondary_muscles = array['Erector Spinae','Biceps Femoris (Long)','Triceps (Long)','Triceps (Lateral)','Triceps (Medial)','Deltoid (Lateral)','Gastrocnemius (Medial)']::text[], equipment = array['Barbell']::text[], aliases = array['Clean & Jerk']::text[], mechanism = 'Compound', pattern = 'olympic' where id = 'a2a0d421-b9af-4f7b-8434-fc827686877c';  -- UPDATE: Barbell Clean and Jerk
update exercises set name = 'Single-Leg Bodyweight Raise', primary_muscles = array['Gastrocnemius (Medial)','Gastrocnemius (Lateral)']::text[], secondary_muscles = array['Soleus']::text[], equipment = array['Bodyweight','Block']::text[], aliases = array['Single-Leg Calf Raises','Single Leg Bodyweight Raise','Single Leg Calf Raises']::text[], mechanism = 'Isolation', pattern = 'raise' where id = 'a2dbdfab-c894-464b-b93c-09200f41be9d';  -- UPDATE: Single-Leg Bodyweight Raise
update exercises set mechanism = 'Compound', pattern = 'hinge' where id = 'a5a4bb87-1cdc-442e-a22b-eb856d758235';  -- KEEP: Kettlebell Swing
update exercises set name = 'Swiss Ball Hamstring Curl', primary_muscles = array['Biceps Femoris (Long)','Biceps Femoris (Short)','Semimembranosus','Semitendinosus']::text[], secondary_muscles = array['Gastrocnemius (Medial)']::text[], equipment = array['Bodyweight','Swiss Ball']::text[], aliases = array['Stability Ball Curls']::text[], mechanism = 'Isolation', pattern = 'curl' where id = 'a612c94e-6138-4eb9-bd42-9e7d77e83e6f';  -- UPDATE: Swiss Ball Hamstring Curl
update exercises set mechanism = 'Isolation', pattern = 'grip' where id = 'a62ac075-a57c-478e-9490-ecfb69faa4a7';  -- KEEP: Plate Pinch Hold
update exercises set mechanism = 'Isolation', pattern = 'row' where id = 'a7e7113c-d44e-4c62-a280-8632c56ed037';  -- KEEP: Wide-Grip Dumbbell Rear Delt Row
update exercises set name = 'Cable Shrug', primary_muscles = array['Trapezius (Superior)']::text[], secondary_muscles = array['Flexor Digitorum']::text[], equipment = array['Cable']::text[], aliases = array['Cable Shrugs']::text[], mechanism = 'Isolation', pattern = 'shrug' where id = 'ac410cbe-775f-4d8b-817b-fa43b8a22492';  -- UPDATE: Cable Shrug
update exercises set name = 'Chest-Supported Incline Shrug', primary_muscles = array['Trapezius (Middle)','Trapezius (Superior)']::text[], secondary_muscles = array['Rhomboid Major','Rhomboid Minor','Levator Scapulae']::text[], equipment = array['Dumbbell']::text[], aliases = '{}'::text[], mechanism = 'Isolation', pattern = 'shrug' where id = 'accd8bc5-47e1-4da9-9f5a-ca1ff953b5b6';  -- UPDATE: Chest Supported Incline Shrug
update exercises set mechanism = 'Isolation', pattern = 'curl' where id = 'ad8be768-59a5-4c68-b1c4-5bed67b5152b';  -- KEEP: Supinating Dumbbell Curl
update exercises set mechanism = 'Compound', pattern = 'hinge' where id = 'ad959e00-a5f1-4d60-981c-62208b8a0664';  -- KEEP: Seated Barbell Good Morning
update exercises set mechanism = 'Isolation', pattern = 'extension' where id = 'ae2d9355-bfed-4b47-8dd8-55408965c22f';  -- KEEP: Standing Single-Arm Dumbbell Extension
update exercises set mechanism = 'Isolation', pattern = 'curl' where id = 'ae715985-b5e2-42ef-89d5-efe4dbf87849';  -- KEEP: Single-Arm Dumbbell Preacher Zottman Curl
update exercises set mechanism = 'Isolation', pattern = 'fly' where id = 'b08933e0-9a77-4108-a5d8-13ccb10210fe';  -- KEEP: Machine Reverse Fly
update exercises set mechanism = 'Compound', pattern = 'press' where id = 'b230fcc1-c660-422b-93ce-a535b74d3bcb';  -- KEEP: Dumbbell Decline Bench Press
update exercises set mechanism = 'Isolation', pattern = 'abduction' where id = 'b259edb9-bf5b-43ec-abcc-a4bbb0843179';  -- KEEP: Banded Clamshell
update exercises set mechanism = 'Compound', pattern = 'press' where id = 'b5e6b790-f89a-4499-a49e-e5e17ab31ee1';  -- KEEP: Machine Assisted Dip
update exercises set name = 'Decline Weighted Sit-Up', primary_muscles = array['Rectus Abdominis (Superior)']::text[], secondary_muscles = array['External Obliques','Iliopsoas']::text[], equipment = array['Plate','Decline Bench']::text[], aliases = array['Weighted Sit-Ups']::text[], mechanism = 'Isolation', pattern = 'core' where id = 'b6d6a169-c925-40a7-bb1c-9bf699730273';  -- UPDATE: Decline Weighted Sit-Up
update exercises set mechanism = 'Isolation', pattern = 'curl' where id = 'b7d1ca94-56a3-45dd-a404-0a28111ce0c9';  -- KEEP: EZ-Bar Spider Curl
update exercises set mechanism = 'Isolation', pattern = 'shrug' where id = 'b8d15fcb-da2c-40c8-b275-404081b85f31';  -- KEEP: Barbell Shrug
update exercises set mechanism = 'Isolation', pattern = 'curl' where id = 'b912f717-853a-48fd-bbd4-a5c566cd18dd';  -- KEEP: Dumbbell Wrist Curl
update exercises set mechanism = 'Compound', pattern = 'hinge' where id = 'b916ced2-ce64-4b15-8e9b-9e850c0568e1';  -- KEEP: Dumbbell Romanian Deadlift
update exercises set name = 'Wide Grip Seated Cable Row', primary_muscles = array['Rhomboid Major','Rhomboid Minor']::text[], secondary_muscles = array['Latissimus Dorsi','Biceps Brachii','Deltoid (Posterior)','Trapezius (Middle)']::text[], equipment = array['Cable']::text[], aliases = array['Wide Seated Rows']::text[], mechanism = 'Compound', pattern = 'row' where id = 'b9d72068-e579-4070-ac0e-f8495a2d7382';  -- UPDATE: Wide Grip Seated Cable Row
update exercises set mechanism = 'Compound', pattern = 'squat' where id = 'bce18bed-c86f-4a12-90ab-8a292d9c79df';  -- KEEP: Barbell Box Squat
update exercises set mechanism = 'Isolation', pattern = 'extension' where id = 'bd044c5d-f657-449e-80a2-b54331a3b60e';  -- KEEP: Machine Glute Kickback
update exercises set name = 'Single-Arm Cable Lat Pulldown', primary_muscles = array['Latissimus Dorsi']::text[], secondary_muscles = array['Biceps Brachii','Rhomboid Major','Rhomboid Minor','Deltoid (Posterior)','Teres Major']::text[], equipment = array['Cable']::text[], aliases = array['Single-Arm Pulldowns']::text[], mechanism = 'Compound', pattern = 'pull' where id = 'bd5758d5-1fd3-48aa-a071-d0b14b8a1368';  -- UPDATE: Single-Arm Cable Lat Pulldown
update exercises set mechanism = 'Compound', pattern = 'lunge' where id = 'be4523cd-d142-4357-85e7-072751a18c93';  -- KEEP: Barbell Reverse Lunge
update exercises set name = 'Single-Arm Machine Reverse Fly', primary_muscles = array['Deltoid (Posterior)']::text[], secondary_muscles = array['Rhomboid Major','Rhomboid Minor','Trapezius (Middle)']::text[], equipment = array['Machine']::text[], aliases = array['Single Arm Rear-Delt Fly','Unilateral Machine Reverse Fly','Unilateral Rear-Delt Fly']::text[], mechanism = 'Isolation', pattern = 'fly' where id = 'be90f2a7-0cf9-485f-b727-fc238abf758d';  -- UPDATE: Single-Arm Machine Reverse Fly
update exercises set mechanism = 'Compound', pattern = 'hinge' where id = 'bec2a2b2-38ad-47cb-ac19-77cf4325789f';  -- KEEP: Trap Bar Romanian Deadlift
update exercises set name = 'Barbell Hack Squat', primary_muscles = array['Rectus Femoris','Vastus Intermedius','Vastus Lateralis','Vastus Medialis']::text[], secondary_muscles = array['Gluteus Maximus','Adductor Longus','Adductor Magnus']::text[], equipment = array['Barbell']::text[], aliases = '{}'::text[], mechanism = 'Compound', pattern = 'squat' where id = 'bf2a9b0e-74ca-4001-ae8b-dd5b0dda5743';  -- UPDATE: Barbell Hack Squat
update exercises set name = 'High-to-Low Cable Fly', primary_muscles = array['Pectoralis Major (Costal)']::text[], secondary_muscles = array['Deltoid (Anterior)']::text[], equipment = array['Cable']::text[], aliases = array['High Cable Flys']::text[], mechanism = 'Isolation', pattern = 'fly' where id = 'c22ebf8a-054d-41b1-ba19-208d28be5dc2';  -- UPDATE: High-to-Low Cable Fly
update exercises set mechanism = 'Isolation', pattern = 'raise' where id = 'c367ea5b-11dc-4507-afd7-8b461249160e';  -- KEEP: Plate Front Raise
update exercises set mechanism = 'Isolation', pattern = 'extension' where id = 'c3d1c0bc-d2b9-4b3f-93a2-c34e64af387f';  -- KEEP: Cable Dual Rope Tricep Pushdown
update exercises set mechanism = 'Isolation', pattern = 'fly' where id = 'c4cb2c7f-8ed7-4122-86e4-39994483f911';  -- KEEP: Bent-Over Dumbbell Reverse Fly
update exercises set name = 'Cable Standing Hip Abduction', primary_muscles = array['Gluteus Medius']::text[], secondary_muscles = array['Gluteus Maximus']::text[], equipment = array['Cable','Ankle Cuff']::text[], aliases = array['Cable Abductions']::text[], mechanism = 'Isolation', pattern = 'abduction' where id = 'c55c418e-0ce0-4db2-867a-42d557420305';  -- UPDATE: Cable Standing Hip Abduction
update exercises set mechanism = 'Compound', pattern = 'lunge' where id = 'c7cfc180-d8d3-46b2-be1a-399708a9363f';  -- KEEP: Dumbbell Bulgarian Split Squat
update exercises set mechanism = 'Compound', pattern = 'row' where id = 'c84b0f45-2a47-4c22-870e-fd852ff6fa33';  -- KEEP: Machine High Row
update exercises set mechanism = 'Isolation', pattern = 'hinge' where id = 'c8a80766-83e9-48f2-8915-12952810e5fd';  -- KEEP: Machine Back Extension
update exercises set name = 'Deficit Push-Up', primary_muscles = array['Pectoralis Major (Sternal)']::text[], secondary_muscles = array['Triceps (Lateral)','Triceps (Long)','Triceps (Medial)','Deltoid (Anterior)','Serratus Anterior']::text[], equipment = array['Plate','Block']::text[], aliases = array['Deep Push-Ups']::text[], mechanism = 'Compound', pattern = 'press' where id = 'cb989bf9-9edc-4e2f-9e05-21668e8a3dbe';  -- UPDATE: Deficit Push-Up
update exercises set name = 'Tibialis Raise', primary_muscles = array['Tibialis Anterior']::text[], secondary_muscles = '{}'::text[], equipment = array['Bodyweight','Tib Bar']::text[], aliases = array['Tib Raises']::text[], mechanism = 'Isolation', pattern = 'raise' where id = 'cc58d701-9d09-4465-b98d-789287366928';  -- UPDATE: Tibialis Raise
update exercises set name = 'Incline Dumbbell Zottman Curl', primary_muscles = array['Biceps Brachii','Brachialis']::text[], secondary_muscles = array['Brachioradialis']::text[], equipment = array['Dumbbell','Incline Bench']::text[], aliases = array['Incline Zottman Curl']::text[], created_by = null, admin_reviewed = true, mechanism = 'Isolation', pattern = 'curl' where id = 'cc9cbb72-9f99-490c-8145-3eb11505b0f7';  -- PROMOTE: Bi-Lateral Incline Dumbbell Zottman Curl
update exercises set name = 'Cable Glute Kickback', primary_muscles = array['Gluteus Maximus']::text[], secondary_muscles = array['Biceps Femoris (Long)']::text[], equipment = array['Cable','Ankle Cuff']::text[], aliases = array['Cable Kickbacks']::text[], mechanism = 'Isolation', pattern = 'extension' where id = 'cd79d388-cbe7-49d8-873b-1d1a76e3108d';  -- UPDATE: Cable Glute Kickback
update exercises set name = 'Glute-Ham Raise', primary_muscles = array['Biceps Femoris (Long)','Biceps Femoris (Short)','Semimembranosus','Semitendinosus']::text[], secondary_muscles = array['Gastrocnemius (Medial)','Gluteus Maximus','Erector Spinae']::text[], equipment = array['Bodyweight','GHD']::text[], aliases = array['GHR','Glute Ham Raise']::text[], mechanism = 'Isolation', pattern = 'curl' where id = 'cdf843a3-edd0-4340-bfac-38596eb2250c';  -- UPDATE: Glute-Ham Raise
update exercises set name = 'Low-Incline Dumbbell Press', primary_muscles = array['Pectoralis Major (Clavicular)','Pectoralis Major (Sternal)']::text[], secondary_muscles = array['Deltoid (Anterior)','Triceps (Long)','Triceps (Lateral)','Triceps (Medial)']::text[], equipment = array['Dumbbell','Incline Bench']::text[], aliases = array['Low Incline Dumbbell Press','15 Degree Incline Press','30 Degree Incline Press']::text[], created_by = null, admin_reviewed = true, mechanism = 'Compound', pattern = 'press' where id = 'cec18a7f-c225-4533-9821-f507ebfc17b8';  -- PROMOTE: Low Incline Dumbbell Press
update exercises set name = 'Toes to Bar', primary_muscles = array['Rectus Abdominis (Inferior)']::text[], secondary_muscles = array['Iliopsoas','External Obliques','Latissimus Dorsi','Flexor Digitorum']::text[], equipment = array['Bodyweight','Pull-Up Bar']::text[], aliases = array['T2B']::text[], mechanism = 'Isolation', pattern = 'core' where id = 'cee75d92-0445-49f9-b63c-fe46ad3092db';  -- UPDATE: Toes to Bar
update exercises set name = 'Cable Overhead Tricep Extension', primary_muscles = array['Triceps (Lateral)','Triceps (Long)','Triceps (Medial)']::text[], secondary_muscles = '{}'::text[], equipment = array['Cable']::text[], aliases = array['Rope Overhead Extension']::text[], mechanism = 'Isolation', pattern = 'extension' where id = 'cf042684-812b-47bd-8a2d-093627b7132d';  -- UPDATE: Cable Overhead Tricep Extension
update exercises set mechanism = 'Isolation', pattern = 'shrug' where id = 'cf21eed5-120b-42a7-a047-8fccfc092340';  -- KEEP: Machine Shrug
update exercises set name = 'Low-to-High Cable Fly', primary_muscles = array['Pectoralis Major (Clavicular)']::text[], secondary_muscles = array['Deltoid (Anterior)']::text[], equipment = array['Cable']::text[], aliases = array['Low Cable Flys']::text[], mechanism = 'Isolation', pattern = 'fly' where id = 'cf4a832a-12f2-4dae-a39b-38dbd076213c';  -- UPDATE: Low-to-High Cable Fly
update exercises set name = 'Incline Cable Overhead Tricep Extension', primary_muscles = array['Triceps (Long)','Triceps (Lateral)','Triceps (Medial)']::text[], secondary_muscles = '{}'::text[], equipment = array['Cable','Incline Bench']::text[], aliases = array['Incline Rope Overhead Extension']::text[], created_by = null, admin_reviewed = true, mechanism = 'Isolation', pattern = 'extension' where id = 'cfe2e529-284e-4d53-9e6e-84c48d2baf85';  -- PROMOTE: Incline Bench Cable Rope Tricep Extensions
update exercises set mechanism = 'Compound', pattern = 'squat' where id = 'd0b97804-cf8e-428f-9719-b7216cb8f81e';  -- KEEP: Barbell Low-Bar Back Squat
update exercises set name = 'Weighted Pull-Up', primary_muscles = array['Latissimus Dorsi']::text[], secondary_muscles = array['Biceps Brachii','Rhomboid Major','Rhomboid Minor','Deltoid (Posterior)','Teres Major']::text[], equipment = array['Bodyweight','Pull-Up Bar','Weight Belt','Weighted Vest']::text[], aliases = array['Weighted Pull-Ups']::text[], mechanism = 'Compound', pattern = 'pull' where id = 'd2e89bd4-a4c7-421e-b0b8-a1e363a27f05';  -- UPDATE: Weighted Pull-Up
update exercises set name = 'Nordic Hamstring Curl', primary_muscles = array['Biceps Femoris (Long)','Biceps Femoris (Short)','Semimembranosus','Semitendinosus']::text[], secondary_muscles = array['Gastrocnemius (Medial)','Gluteus Maximus','Erector Spinae']::text[], equipment = array['Bodyweight']::text[], aliases = array['Nordics']::text[], mechanism = 'Isolation', pattern = 'curl' where id = 'd33fe792-8344-45d3-9558-3ac2e17323de';  -- UPDATE: Nordic Hamstring Curl
update exercises set name = 'Machine Preacher Curl', primary_muscles = array['Biceps Brachii']::text[], secondary_muscles = array['Brachialis','Brachioradialis']::text[], equipment = array['Machine']::text[], aliases = array['Preacher Machine','Bicep Curl Machine']::text[], mechanism = 'Isolation', pattern = 'curl' where id = 'd359f67d-7118-408b-8d2d-3ecd7c6309ad';  -- UPDATE: Machine Preacher Curl
update exercises set mechanism = 'Compound', pattern = 'press' where id = 'd36b7a7f-7371-4030-a72d-625e52592c67';  -- KEEP: Barbell Floor Press
update exercises set mechanism = 'Isolation', pattern = 'raise' where id = 'd4440aec-b5ae-4a79-ac2a-acf65546e01a';  -- KEEP: Machine Standing Calf Raise
update exercises set name = 'Cable Straight-Arm Pullover', primary_muscles = array['Latissimus Dorsi']::text[], secondary_muscles = array['Teres Major','Deltoid (Posterior)']::text[], equipment = array['Cable']::text[], aliases = array['Lat Prayers']::text[], mechanism = 'Isolation', pattern = 'pull' where id = 'd9506d9f-4f0f-49ec-a17d-10223bacc115';  -- UPDATE: Cable Straight-Arm Pullover
update exercises set name = 'Deficit Reverse Lunge', primary_muscles = array['Gluteus Maximus']::text[], secondary_muscles = array['Adductor Longus','Adductor Magnus','Gluteus Medius','Vastus Lateralis','Vastus Medialis','Vastus Intermedius']::text[], equipment = array['Dumbbell','Plate']::text[], aliases = array['Elevated Lunges']::text[], mechanism = 'Compound', pattern = 'lunge' where id = 'da1bf416-931d-4527-bffe-98e227a32bed';  -- UPDATE: Deficit Reverse Lunge
update exercises set mechanism = 'Isolation', pattern = 'curl' where id = 'da9122f5-1e03-4289-9088-a313a597fb59';  -- KEEP: Zottman Curl
update exercises set name = 'Seated Cable Fly', primary_muscles = array['Pectoralis Major (Sternal)']::text[], secondary_muscles = array['Pectoralis Major (Clavicular)','Deltoid (Anterior)']::text[], equipment = array['Cable']::text[], aliases = '{}'::text[], mechanism = 'Isolation', pattern = 'fly' where id = 'daa1a4a8-83ec-4bc7-b9fc-6eace9a46b3f';  -- UPDATE: Seated Cable Fly
update exercises set mechanism = 'Isolation', pattern = 'extension' where id = 'db84c22a-6eaa-484d-b9d2-d5e6c7a5fd5d';  -- KEEP: Tate Press
update exercises set name = 'Incline Push-Up', primary_muscles = array['Pectoralis Major (Costal)']::text[], secondary_muscles = array['Triceps (Lateral)','Triceps (Long)','Triceps (Medial)','Deltoid (Anterior)','Serratus Anterior']::text[], equipment = array['Bodyweight','Bench','Box']::text[], aliases = array['Easy Push-Ups']::text[], mechanism = 'Compound', pattern = 'press' where id = 'dd245c41-3636-467a-8e4e-a0c0d3dc9af5';  -- UPDATE: Incline Push-Up
update exercises set mechanism = 'Isolation', pattern = 'extension' where id = 'ddf72ee6-8f64-4680-a6a4-22f1e0bf8c38';  -- KEEP: EZ-Bar Overhead Extension
update exercises set mechanism = 'Compound', pattern = 'press' where id = 'debab0c1-c795-4e08-8e8b-11333db5323d';  -- KEEP: Close-Grip Barbell Bench Press
update exercises set name = 'Decline Bench Crunch', primary_muscles = array['Rectus Abdominis (Superior)']::text[], secondary_muscles = array['External Obliques']::text[], equipment = array['Bodyweight','Decline Bench']::text[], aliases = array['Decline Crunches']::text[], mechanism = 'Isolation', pattern = 'core' where id = 'df024c54-2642-42ce-822c-0885e1a0be55';  -- UPDATE: Decline Bench Crunch
update exercises set mechanism = 'Compound', pattern = 'press' where id = 'df5f83fa-582b-4a0d-ac2c-fd594844823b';  -- KEEP: Kettlebell Overhead Press
update exercises set name = 'Machine Seated Hip Adduction', primary_muscles = array['Adductor Magnus','Adductor Longus']::text[], secondary_muscles = array['Gluteus Maximus']::text[], equipment = array['Machine']::text[], aliases = array['Hip Adductor (Machine)','Adductor Machine']::text[], mechanism = 'Isolation', pattern = 'adduction' where id = 'e318675e-be3a-437b-9291-6e2127e74ae5';  -- UPDATE: Machine Seated Hip Adduction
update exercises set mechanism = 'Isolation', pattern = 'extension' where id = 'e34e6b48-8006-44a9-81c6-16f78e63683d';  -- KEEP: EZ-Bar Skullcrusher
update exercises set name = 'Dumbbell Front-Foot Elevated Split Squat', primary_muscles = array['Rectus Femoris','Vastus Lateralis','Vastus Medialis','Vastus Intermedius','Gluteus Maximus']::text[], secondary_muscles = array['Adductor Magnus','Biceps Femoris (Long)']::text[], equipment = array['Dumbbell','Block']::text[], aliases = array['Deficit Split Squat','FFE Split Squat']::text[], mechanism = 'Compound', pattern = 'lunge' where id = 'e3ac95bd-3ed7-4ef6-9661-f2c672d9afa6';  -- UPDATE: Dumbbell Front-Foot Elevated Split
update exercises set name = 'Cable Pull-Through', primary_muscles = array['Gluteus Maximus']::text[], secondary_muscles = array['Biceps Femoris (Long)','Erector Spinae']::text[], equipment = array['Cable']::text[], aliases = array['Pull-Throughs']::text[], mechanism = 'Compound', pattern = 'hinge' where id = 'e54d330f-228b-4646-a870-3aca2e1be0f2';  -- UPDATE: Cable Pull-Through
update exercises set mechanism = 'Compound', pattern = 'hinge' where id = 'e5a4ed46-60a9-4c51-9f13-9eddb5d8a822';  -- KEEP: Barbell Sumo Deadlift
update exercises set name = 'Resistance Band Tricep Pushdown', primary_muscles = array['Triceps (Long)','Triceps (Lateral)','Triceps (Medial)']::text[], secondary_muscles = '{}'::text[], equipment = array['Resistance Band']::text[], aliases = array['Banded Tricep Extension','Band Pushdown']::text[], created_by = null, admin_reviewed = true, mechanism = 'Isolation', pattern = 'extension' where id = 'e5fd1ce6-99ea-4723-ae95-bc2d47165585';  -- PROMOTE: Tricep Extension - Banded
update exercises set mechanism = 'Isolation', pattern = 'raise' where id = 'e705f0f1-7ad1-4dbb-903e-92417231217f';  -- KEEP: Barbell Front Raise
update exercises set mechanism = 'Compound', pattern = 'squat' where id = 'e7a6737a-ff21-47e5-b941-7d2c8648f4d8';  -- KEEP: Barbell Overhead Squat
update exercises set name = 'Bodyweight V-Up', primary_muscles = array['Rectus Abdominis (Superior)']::text[], secondary_muscles = array['External Obliques','Iliopsoas']::text[], equipment = array['Bodyweight']::text[], aliases = array['V-Ups']::text[], mechanism = 'Isolation', pattern = 'core' where id = 'e80b6483-31d9-4c35-940f-4923e7b9c120';  -- UPDATE: Bodyweight V-Up
update exercises set name = 'Barbell Push Press', primary_muscles = array['Deltoid (Anterior)']::text[], secondary_muscles = array['Triceps (Lateral)','Triceps (Long)','Triceps (Medial)','Deltoid (Lateral)','Vastus Lateralis','Vastus Medialis','Vastus Intermedius']::text[], equipment = array['Barbell']::text[], aliases = array['Push Press']::text[], mechanism = 'Compound', pattern = 'press' where id = 'e87e6362-2e1e-4cb1-8229-3d71cd5d05b4';  -- UPDATE: Barbell Push Press
update exercises set mechanism = 'Compound', pattern = 'hinge' where id = 'e8e80f8f-0d7d-4394-a4bc-666b46a7a255';  -- KEEP: Barbell Romanian Deadlift
update exercises set mechanism = 'Compound', pattern = 'row' where id = 'e9c236e9-6b6c-4e77-9fb9-593dbb481e6b';  -- KEEP: Barbell Yates Row
update exercises set mechanism = 'Isolation', pattern = 'curl' where id = 'ebf2e70c-cd1d-4491-bc66-79cd4c7d1aa5';  -- KEEP: D-Handle Bicep Curl
update exercises set mechanism = 'Isolation', pattern = 'curl' where id = 'ec8aa5b6-40dd-44ba-b63a-1c461c522192';  -- KEEP: Machine Lying Leg Curl
update exercises set name = 'Iso-Lateral High Row', primary_muscles = array['Latissimus Dorsi','Teres Major']::text[], secondary_muscles = array['Rhomboid Major','Rhomboid Minor','Trapezius (Middle)','Trapezius (Inferior)','Deltoid (Posterior)','Biceps Brachii']::text[], equipment = array['Machine']::text[], aliases = '{}'::text[], mechanism = 'Compound', pattern = 'row' where id = 'eda2ccc7-8293-4497-acaf-cb6a344672f0';  -- UPDATE: Iso-Lateral High Row
update exercises set mechanism = 'Compound', pattern = 'pull' where id = 'f1551e20-d446-4711-89d5-975531652bbd';  -- KEEP: Dumbbell Upright Row
update exercises set name = 'Cable Reverse-Grip Pushdown', primary_muscles = array['Triceps (Lateral)','Triceps (Long)','Triceps (Medial)']::text[], secondary_muscles = '{}'::text[], equipment = array['Cable']::text[], aliases = array['Reverse Pushdowns']::text[], mechanism = 'Isolation', pattern = 'extension' where id = 'f1a3f88b-0d16-40c2-8464-005b7d582449';  -- UPDATE: Cable Reverse-Grip Pushdown
update exercises set name = 'Machine Shoulder Press', primary_muscles = array['Deltoid (Anterior)']::text[], secondary_muscles = array['Triceps (Lateral)','Triceps (Long)','Triceps (Medial)','Deltoid (Lateral)','Trapezius (Superior)']::text[], equipment = array['Machine']::text[], aliases = array['Shoulder Press Machine','Plate-Loaded Shoulder Press']::text[], mechanism = 'Compound', pattern = 'press' where id = 'f1b8c93d-853e-4d2e-95a3-0201f139cda6';  -- UPDATE: Machine Shoulder Press
update exercises set mechanism = 'Isolation', pattern = 'shrug' where id = 'f3465b70-4016-49fe-9160-eaf2f6bd7a9d';  -- KEEP: Smith Machine Shrug
update exercises set mechanism = 'Compound', pattern = 'pull' where id = 'f3baa344-830e-4892-b196-d62a739d7800';  -- KEEP: Single-Arm Machine Lat Pulldown
update exercises set mechanism = 'Compound', pattern = 'press' where id = 'f511da6c-257d-444c-a082-4b00f8e7e323';  -- KEEP: Dumbbell Squeeze Press
update exercises set name = 'Captain''s Chair Leg Raise', primary_muscles = array['Rectus Abdominis (Inferior)']::text[], secondary_muscles = array['Iliopsoas','External Obliques']::text[], equipment = array['Bodyweight','Captain''s Chair']::text[], aliases = array['Captain''s Chair']::text[], mechanism = 'Isolation', pattern = 'core' where id = 'f51cb21c-0f3b-4e91-aaf4-bc822edd8aa2';  -- UPDATE: Captain's Chair Leg Raise
update exercises set mechanism = 'Isolation', pattern = 'curl' where id = 'f5f7b099-377b-4122-9ab7-ffd376d7391b';  -- KEEP: Seated Incline Dumbbell Curl
update exercises set mechanism = 'Isolation', pattern = 'curl' where id = 'f7470be8-6e4b-4703-aca2-979988511713';  -- KEEP: Dumbbell Spider Curl
update exercises set name = 'Plate Neck Curl', primary_muscles = array['Sternocleidomastoid']::text[], secondary_muscles = '{}'::text[], equipment = array['Plate','Bench']::text[], aliases = array['Neck Curl','Neck Flexion']::text[], mechanism = 'Isolation', pattern = 'curl' where id = 'f7c14cb1-aaa4-4b21-8975-2a51ee4cd9cb';  -- UPDATE: Neck Curl
update exercises set mechanism = 'Isolation', pattern = 'raise' where id = 'f856d98d-6c66-481b-be39-9113c4624753';  -- KEEP: Machine Seated Calf Raise
update exercises set mechanism = 'Isolation', pattern = 'fly' where id = 'fb56ff7f-8da9-436e-a19a-8f5fb8131ac3';  -- KEEP: Single-Arm Cable Reverse Fly
update exercises set name = 'Barbell Z-Press', primary_muscles = array['Deltoid (Anterior)']::text[], secondary_muscles = array['Triceps (Lateral)','Triceps (Long)','Triceps (Medial)','Deltoid (Lateral)','Trapezius (Superior)']::text[], equipment = array['Barbell']::text[], aliases = '{}'::text[], mechanism = 'Compound', pattern = 'press' where id = 'fce963eb-01fe-4724-a0c6-a75a07e2a466';  -- UPDATE: Barbell Z-Press

-- 6. New exercises ---------------------------------------------------------------
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Standing Cable Chest Press', array['Cable']::text[], 0, '[]'::jsonb, null, true, false, array['Cable Press']::text[], 'Chest', array['Pectoralis Major (Sternal)']::text[], array['Deltoid (Anterior)','Triceps (Long)','Triceps (Lateral)','Triceps (Medial)','Serratus Anterior']::text[], 'Compound', 'press'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Standing Cable Chest Press'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Machine Incline Fly', array['Machine']::text[], 0, '[]'::jsonb, null, true, false, array['Incline Pec Deck']::text[], 'Chest', array['Pectoralis Major (Clavicular)']::text[], array['Deltoid (Anterior)']::text[], 'Isolation', 'fly'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Machine Incline Fly'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Scapular Push-Up', array['Bodyweight']::text[], 0, '[]'::jsonb, null, true, false, array['Scap Push-Up']::text[], 'Chest', array['Serratus Anterior']::text[], array['Pectoralis Minor']::text[], 'Isolation', 'press'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Scapular Push-Up'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Cable Serratus Punch', array['Cable']::text[], 0, '[]'::jsonb, null, true, false, array['Serratus Press']::text[], 'Chest', array['Serratus Anterior']::text[], array['Deltoid (Anterior)']::text[], 'Isolation', 'press'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Cable Serratus Punch'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Meadows Row', array['Barbell','Landmine']::text[], 0, '[]'::jsonb, null, true, false, array['Landmine Single-Arm Row']::text[], 'Back', array['Latissimus Dorsi','Teres Major']::text[], array['Rhomboid Major','Rhomboid Minor','Trapezius (Middle)','Deltoid (Posterior)','Biceps Brachii']::text[], 'Compound', 'row'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Meadows Row'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Inverted Row', array['Bodyweight','Rack']::text[], 0, '[]'::jsonb, null, true, false, array['Bodyweight Row','Australian Pull-Up']::text[], 'Back', array['Rhomboid Major','Rhomboid Minor','Latissimus Dorsi']::text[], array['Trapezius (Middle)','Deltoid (Posterior)','Biceps Brachii']::text[], 'Compound', 'row'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Inverted Row'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Machine Pullover', array['Machine']::text[], 0, '[]'::jsonb, null, true, false, array['Pullover Machine']::text[], 'Back', array['Latissimus Dorsi','Teres Major']::text[], array['Pectoralis Major (Costal)','Triceps (Long)']::text[], 'Isolation', 'pull'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Machine Pullover'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Kettlebell Row', array['Kettlebell']::text[], 0, '[]'::jsonb, null, true, false, array['KB Row']::text[], 'Back', array['Latissimus Dorsi']::text[], array['Rhomboid Major','Rhomboid Minor','Trapezius (Middle)','Biceps Brachii']::text[], 'Compound', 'row'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Kettlebell Row'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Prone Y-Raise', array['Dumbbell','Incline Bench']::text[], 0, '[]'::jsonb, null, true, false, array['Incline Y-Raise','Y-Raise']::text[], 'Back', array['Trapezius (Inferior)','Trapezius (Middle)']::text[], array['Deltoid (Posterior)','Rhomboid Major']::text[], 'Isolation', 'raise'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Prone Y-Raise'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Cable Y-Raise', array['Cable']::text[], 0, '[]'::jsonb, null, true, false, array['Cable Y Raise']::text[], 'Back', array['Trapezius (Inferior)','Deltoid (Lateral)']::text[], array['Trapezius (Middle)','Deltoid (Posterior)']::text[], 'Isolation', 'raise'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Cable Y-Raise'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Reverse Hyperextension', array['Machine']::text[], 0, '[]'::jsonb, null, true, false, array['Reverse Hyper']::text[], 'Legs', array['Gluteus Maximus','Erector Spinae']::text[], array['Biceps Femoris (Long)']::text[], 'Compound', 'hinge'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Reverse Hyperextension'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select '45-Degree Back Extension', array['Bodyweight','Hyperextension Bench']::text[], 0, '[]'::jsonb, null, true, false, array['45 Degree Hyperextension']::text[], 'Back', array['Erector Spinae','Gluteus Maximus']::text[], array['Biceps Femoris (Long)','Semitendinosus']::text[], 'Isolation', 'hinge'
where not exists (select 1 from exercises where lower(trim(name)) = lower('45-Degree Back Extension'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Cable External Rotation', array['Cable']::text[], 0, '[]'::jsonb, null, true, false, array['Cable ER']::text[], 'Shoulders', array['Infraspinatus','Teres Minor']::text[], array['Deltoid (Posterior)']::text[], 'Isolation', 'rotation'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Cable External Rotation'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Side-Lying Dumbbell External Rotation', array['Dumbbell','Bench']::text[], 0, '[]'::jsonb, null, true, false, array['Dumbbell External Rotation']::text[], 'Shoulders', array['Infraspinatus','Teres Minor']::text[], array['Deltoid (Posterior)']::text[], 'Isolation', 'rotation'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Side-Lying Dumbbell External Rotation'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Cable Internal Rotation', array['Cable']::text[], 0, '[]'::jsonb, null, true, false, array['Cable IR']::text[], 'Shoulders', array['Subscapularis']::text[], array['Pectoralis Major (Sternal)']::text[], 'Isolation', 'rotation'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Cable Internal Rotation'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Band Pull-Apart', array['Resistance Band']::text[], 0, '[]'::jsonb, null, true, false, array['Pull-Aparts']::text[], 'Shoulders', array['Deltoid (Posterior)','Trapezius (Middle)']::text[], array['Rhomboid Major','Rhomboid Minor','Infraspinatus']::text[], 'Isolation', 'raise'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Band Pull-Apart'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Chest-Supported Dumbbell Rear Delt Fly', array['Dumbbell','Incline Bench']::text[], 0, '[]'::jsonb, null, true, false, array['Incline Rear Delt Fly']::text[], 'Shoulders', array['Deltoid (Posterior)']::text[], array['Rhomboid Major','Rhomboid Minor','Trapezius (Middle)']::text[], 'Isolation', 'fly'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Chest-Supported Dumbbell Rear Delt Fly'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Landmine Lateral Raise', array['Barbell','Landmine']::text[], 0, '[]'::jsonb, null, true, false, '{}'::text[], 'Shoulders', array['Deltoid (Lateral)']::text[], array['Deltoid (Anterior)','Trapezius (Superior)']::text[], 'Isolation', 'raise'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Landmine Lateral Raise'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Kettlebell Halo', array['Kettlebell']::text[], 0, '[]'::jsonb, null, true, false, array['KB Halo']::text[], 'Shoulders', array['Deltoid (Anterior)','Deltoid (Lateral)']::text[], array['Trapezius (Superior)','Transverse Abdominis']::text[], 'Compound', 'carry'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Kettlebell Halo'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Cable Preacher Curl', array['Cable','Preacher Bench']::text[], 0, '[]'::jsonb, null, true, false, array['Preacher Cable Curl']::text[], 'Arms', array['Biceps Brachii']::text[], array['Brachialis']::text[], 'Isolation', 'curl'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Cable Preacher Curl'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Dumbbell Cross-Body Hammer Curl', array['Dumbbell']::text[], 0, '[]'::jsonb, null, true, false, array['Cross-Body Curl','Pinwheel Curl']::text[], 'Arms', array['Brachialis','Brachioradialis']::text[], array['Biceps Brachii']::text[], 'Isolation', 'curl'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Dumbbell Cross-Body Hammer Curl'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Incline Dumbbell Hammer Curl', array['Dumbbell','Incline Bench']::text[], 0, '[]'::jsonb, null, true, false, '{}'::text[], 'Arms', array['Brachialis']::text[], array['Biceps Brachii','Brachioradialis']::text[], 'Isolation', 'curl'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Incline Dumbbell Hammer Curl'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Close-Grip Push-Up', array['Bodyweight']::text[], 0, '[]'::jsonb, null, true, false, array['Tricep Push-Up']::text[], 'Arms', array['Triceps (Long)','Triceps (Lateral)','Triceps (Medial)']::text[], array['Pectoralis Major (Sternal)','Deltoid (Anterior)']::text[], 'Compound', 'press'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Close-Grip Push-Up'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Dead Hang', array['Bodyweight','Pull-Up Bar']::text[], 0, '[]'::jsonb, null, true, false, array['Bar Hang']::text[], 'Arms', array['Flexor Digitorum']::text[], array['Latissimus Dorsi','Flexor Carpi Ulnaris']::text[], 'Isolation', 'grip'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Dead Hang'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Wrist Roller', array['Other']::text[], 0, '[]'::jsonb, null, true, false, array['Forearm Roller']::text[], 'Arms', array['Extensor Carpi Radialis','Flexor Carpi Radialis']::text[], array['Brachioradialis','Flexor Digitorum']::text[], 'Isolation', 'grip'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Wrist Roller'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Dumbbell Reverse Wrist Curl', array['Dumbbell','Bench']::text[], 0, '[]'::jsonb, null, true, false, '{}'::text[], 'Arms', array['Extensor Carpi Radialis']::text[], array['Brachioradialis']::text[], 'Isolation', 'curl'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Dumbbell Reverse Wrist Curl'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Dumbbell Hip Thrust', array['Dumbbell','Bench']::text[], 0, '[]'::jsonb, null, true, false, '{}'::text[], 'Legs', array['Gluteus Maximus']::text[], array['Biceps Femoris (Long)','Adductor Magnus']::text[], 'Isolation', 'hinge'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Dumbbell Hip Thrust'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Smith Machine Hip Thrust', array['Smith Machine','Bench']::text[], 0, '[]'::jsonb, null, true, false, array['Smith Hip Thrust']::text[], 'Legs', array['Gluteus Maximus']::text[], array['Biceps Femoris (Long)','Adductor Magnus']::text[], 'Isolation', 'hinge'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Smith Machine Hip Thrust'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Belt Squat', array['Machine','Weight Belt']::text[], 0, '[]'::jsonb, null, true, false, array['Belt Squat Machine']::text[], 'Legs', array['Rectus Femoris','Vastus Lateralis','Vastus Medialis','Vastus Intermedius','Gluteus Maximus']::text[], array['Adductor Magnus']::text[], 'Compound', 'squat'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Belt Squat'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Heel-Elevated Goblet Squat', array['Dumbbell','Block']::text[], 0, '[]'::jsonb, null, true, false, array['Cyclist Squat']::text[], 'Legs', array['Rectus Femoris','Vastus Lateralis','Vastus Medialis','Vastus Intermedius']::text[], array['Gluteus Maximus','Adductor Magnus']::text[], 'Compound', 'squat'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Heel-Elevated Goblet Squat'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Smith Machine Split Squat', array['Smith Machine']::text[], 0, '[]'::jsonb, null, true, false, array['Smith Split Squat']::text[], 'Legs', array['Rectus Femoris','Vastus Lateralis','Vastus Medialis','Vastus Intermedius','Gluteus Maximus']::text[], array['Adductor Magnus']::text[], 'Compound', 'lunge'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Smith Machine Split Squat'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Cable Hip Adduction', array['Cable','Ankle Cuff']::text[], 0, '[]'::jsonb, null, true, false, array['Cable Adduction']::text[], 'Legs', array['Adductor Magnus','Adductor Longus']::text[], '{}'::text[], 'Isolation', 'adduction'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Cable Hip Adduction'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Kettlebell Deadlift', array['Kettlebell']::text[], 0, '[]'::jsonb, null, true, false, array['KB Deadlift']::text[], 'Legs', array['Gluteus Maximus','Biceps Femoris (Long)','Biceps Femoris (Short)','Semitendinosus','Semimembranosus']::text[], array['Erector Spinae','Vastus Lateralis','Vastus Medialis','Vastus Intermedius']::text[], 'Compound', 'hinge'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Kettlebell Deadlift'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Machine Seated Tibialis Raise', array['Machine']::text[], 0, '[]'::jsonb, null, true, false, array['Tib Machine']::text[], 'Legs', array['Tibialis Anterior']::text[], '{}'::text[], 'Isolation', 'raise'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Machine Seated Tibialis Raise'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Kettlebell Single-Leg Deadlift', array['Kettlebell']::text[], 0, '[]'::jsonb, null, true, false, array['KB Single-Leg RDL']::text[], 'Legs', array['Biceps Femoris (Long)','Biceps Femoris (Short)','Semitendinosus','Semimembranosus','Gluteus Maximus']::text[], array['Gluteus Medius','Erector Spinae']::text[], 'Compound', 'hinge'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Kettlebell Single-Leg Deadlift'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Reverse Crunch', array['Bodyweight']::text[], 0, '[]'::jsonb, null, true, false, '{}'::text[], 'Core', array['Rectus Abdominis (Inferior)']::text[], array['External Obliques','Transverse Abdominis']::text[], 'Isolation', 'core'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Reverse Crunch'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Hanging Oblique Knee Raise', array['Bodyweight','Pull-Up Bar']::text[], 0, '[]'::jsonb, null, true, false, array['Oblique Knee Raise']::text[], 'Core', array['External Obliques','Internal Obliques']::text[], array['Rectus Abdominis (Inferior)','Iliopsoas']::text[], 'Isolation', 'core'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Hanging Oblique Knee Raise'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Kneeling Cable Oblique Crunch', array['Cable']::text[], 0, '[]'::jsonb, null, true, false, array['Cable Side Crunch']::text[], 'Core', array['External Obliques','Internal Obliques']::text[], array['Rectus Abdominis (Superior)']::text[], 'Isolation', 'core'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Kneeling Cable Oblique Crunch'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Bird Dog', array['Bodyweight']::text[], 0, '[]'::jsonb, null, true, false, '{}'::text[], 'Core', array['Transverse Abdominis','Erector Spinae']::text[], array['Gluteus Maximus','Deltoid (Anterior)']::text[], 'Isolation', 'core'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Bird Dog'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Dragon Flag', array['Bodyweight','Bench']::text[], 0, '[]'::jsonb, null, true, false, '{}'::text[], 'Core', array['Rectus Abdominis (Superior)','Rectus Abdominis (Inferior)']::text[], array['Transverse Abdominis','Latissimus Dorsi']::text[], 'Isolation', 'core'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Dragon Flag'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Kettlebell Turkish Get-Up', array['Kettlebell']::text[], 0, '[]'::jsonb, null, true, false, array['TGU','Get-Up']::text[], 'Full Body', array['Deltoid (Anterior)','External Obliques']::text[], array['Gluteus Maximus','Transverse Abdominis','Infraspinatus']::text[], 'Compound', 'carry'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Kettlebell Turkish Get-Up'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Plate Neck Extension', array['Plate','Bench']::text[], 0, '[]'::jsonb, null, true, false, array['Neck Extension']::text[], 'Neck', array['Splenius Capitis']::text[], array['Trapezius (Superior)']::text[], 'Isolation', 'extension'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Plate Neck Extension'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Kettlebell Clean', array['Kettlebell']::text[], 0, '[]'::jsonb, null, true, false, array['KB Clean']::text[], 'Full Body', array['Gluteus Maximus','Biceps Femoris (Long)','Biceps Femoris (Short)','Semitendinosus','Semimembranosus']::text[], array['Trapezius (Superior)','Erector Spinae','Biceps Brachii']::text[], 'Compound', 'olympic'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Kettlebell Clean'));
insert into exercises (name, equipment, target_weight, setup_fields, created_by, admin_reviewed, archived, aliases, muscle_group, primary_muscles, secondary_muscles, mechanism, pattern)
select 'Kettlebell Snatch', array['Kettlebell']::text[], 0, '[]'::jsonb, null, true, false, array['KB Snatch']::text[], 'Full Body', array['Gluteus Maximus','Deltoid (Anterior)']::text[], array['Biceps Femoris (Long)','Trapezius (Superior)','Erector Spinae']::text[], 'Compound', 'olympic'
where not exists (select 1 from exercises where lower(trim(name)) = lower('Kettlebell Snatch'));

-- 7. Full Body overrides, then recompute derived columns ------------------------
delete from muscle_group_full_body_override
where exercise_id not in ('0c632675-ddb3-4ef7-a0f3-e8caab27a79a', '17985c8d-7166-4d00-8513-d4b8efd02fae', '1ecc072e-356f-48df-b311-ab23a7eac590', '27d30134-54b7-4ecd-9842-c40a63b22734', '59fc34a0-06b6-4ab8-9907-d2e017f21ba5', '799da007-1001-4842-a3f7-851008f76dac', '7ac3068c-b6cf-40e4-b1bf-f4ebf1bf49e1', '7f00c0d7-499b-4ecc-9210-b040ed1c171a', '8139927a-394e-4a16-b21c-e3a29b672afc', '9635cbc7-2518-4a9d-94f1-641ad69679ff', 'a2a0d421-b9af-4f7b-8434-fc827686877c', 'e5a4ed46-60a9-4c51-9f13-9eddb5d8a822')
  and exercise_id not in (select id from exercises where name in ('Kettlebell Turkish Get-Up', 'Kettlebell Clean', 'Kettlebell Snatch'));
insert into muscle_group_full_body_override (exercise_id)
select e.id from exercises e
where (e.id in ('0c632675-ddb3-4ef7-a0f3-e8caab27a79a', '17985c8d-7166-4d00-8513-d4b8efd02fae', '1ecc072e-356f-48df-b311-ab23a7eac590', '27d30134-54b7-4ecd-9842-c40a63b22734', '59fc34a0-06b6-4ab8-9907-d2e017f21ba5', '799da007-1001-4842-a3f7-851008f76dac', '7ac3068c-b6cf-40e4-b1bf-f4ebf1bf49e1', '7f00c0d7-499b-4ecc-9210-b040ed1c171a', '8139927a-394e-4a16-b21c-e3a29b672afc', '9635cbc7-2518-4a9d-94f1-641ad69679ff', 'a2a0d421-b9af-4f7b-8434-fc827686877c', 'e5a4ed46-60a9-4c51-9f13-9eddb5d8a822') or e.name in ('Kettlebell Turkish Get-Up', 'Kettlebell Clean', 'Kettlebell Snatch'))
  and not exists (select 1 from muscle_group_full_body_override o where o.exercise_id = e.id);

-- Fires the muscle_group / muscle_region sync triggers (migrations 058, 064).
update exercises set id = id;

-- 8. Cleanup ----------------------------------------------------------------------
delete from muscle_taxonomy where detailed_key in (select old_key from _region_remap);
delete from muscle_detailed where key in (select old_key from _region_remap);

alter table exercises drop column if exists "Primary Muscle(s) Level 1 (Generic)";
alter table exercises drop column if exists "Primary Muscle(s) Level 2 (Detailed)";
alter table exercises drop column if exists "Primary Muscle(s) Level 3 (Scientific)";
alter table exercises drop column if exists "Secondary Muscle(s) Level 1 (Generic)";
alter table exercises drop column if exists "Secondary Muscle(s) Level 2 (Detailed)";
alter table exercises drop column if exists "Secondary Muscle(s) Level 3 (Scientific)";

-- 9. Self-check: any failure here rolls back the whole migration ----------------
do $$
declare bad int; names text;
begin
  select count(*), string_agg(distinct e.name || ' -> ' || m, '; ') into bad, names
  from exercises e, unnest(e.primary_muscles || e.secondary_muscles) m
  where e.created_by is null and m not in (select scientific_name from muscle_taxonomy);
  if bad > 0 then raise exception 'Public exercises with unknown muscles: %', names; end if;

  select count(*), string_agg(e.name, '; ') into bad, names from exercises e
  where e.created_by is null and exists (select 1 from unnest(e.primary_muscles) p where p = any(e.secondary_muscles));
  if bad > 0 then raise exception 'Primary/secondary overlap: %', names; end if;

  select count(*), string_agg(e.name, '; ') into bad, names from exercises e
  where e.created_by is null and (e.mechanism is null or e.pattern is null);
  if bad > 0 then raise exception 'Missing mechanism/pattern: %', names; end if;

  select count(*) into bad from exercises e where e.muscle_region is not null and e.muscle_region not in (select key from muscle_detailed);
  if bad > 0 then raise exception '% exercises point at a deleted region', bad; end if;

  select count(*) into bad from muscle_detailed where key in ('triceps_lateral','forearm_extensors','neck_flexors','teres_major','deep_stabilizer');
  if bad > 0 then raise exception 'Old region keys still present'; end if;

  raise notice 'migration_074 OK: % public exercises, % regions, % anatomy entries',
    (select count(*) from exercises where created_by is null and not archived),
    (select count(*) from muscle_detailed), (select count(*) from muscle_taxonomy);
end $$;

notify pgrst, 'reload schema';

commit;
