-- Promotes the body-map region <-> muscle correlation from a hardcoded
-- JS map (lib/bodyMapRegions.js's REGION_MAP) into an admin-editable
-- table, same pattern as migration_034/040 did for the muscle taxonomy
-- itself. Each row says "this anatomical region (view+slug, matching
-- lib/bodyMapData.js's FRONT_REGIONS/BACK_REGIONS) includes this
-- Detailed-tier muscle" -- many-to-many, since one region can be shared
-- by several muscles (Lats + Upper Back both shade the same back patch)
-- and one muscle can light up more than one region (Triceps shows on
-- both front and back art).
create table body_map_region_muscles (
  view text not null check (view in ('front', 'back')),
  slug text not null,
  muscle_detailed_key text not null references muscle_detailed(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (view, slug, muscle_detailed_key)
);

alter table body_map_region_muscles enable row level security;

create policy "body_map_region_muscles_select_all" on body_map_region_muscles for select using (true);
create policy "body_map_region_muscles_insert_admin" on body_map_region_muscles for insert
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
create policy "body_map_region_muscles_delete_admin" on body_map_region_muscles for delete
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

create index idx_body_map_region_muscles_key on body_map_region_muscles(muscle_detailed_key);

-- Best-effort seed from the current REGION_MAP so the admin tool starts
-- populated instead of empty -- matched by muscle_detailed.label
-- (case-insensitive), so anything that was in REGION_MAP but never
-- actually made it into muscle_detailed (no exercise ever used that
-- exact detailed name) is simply skipped rather than erroring; an admin
-- can add it manually afterward via the new tool if it turns out to be
-- needed. The JS-side KEYWORD_FALLBACKS regex list stays in
-- lib/bodyMapRegions.js as a code-level backstop for anything not yet
-- given an explicit row here, same as ALIASES still backstops the
-- muscle_taxonomy table.
insert into body_map_region_muscles (view, slug, muscle_detailed_key)
select md.key, v.view, v.slug
from (values
  ('abs', 'front', 'abs'),
  ('deep core', 'front', 'abs'),
  ('obliques', 'front', 'obliques'),
  ('serratus', 'front', 'obliques'),
  ('chest', 'front', 'chest'),
  ('upper chest', 'front', 'chest'),
  ('lower chest', 'front', 'chest'),
  ('biceps', 'front', 'biceps'),
  ('brachialis', 'front', 'biceps'),
  ('triceps', 'front', 'triceps'),
  ('triceps', 'back', 'triceps'),
  ('forearms', 'front', 'forearm'),
  ('forearms', 'back', 'forearm'),
  ('front delts', 'front', 'deltoids'),
  ('side delts', 'front', 'deltoids'),
  ('rear delts', 'back', 'deltoids'),
  ('rotator cuff', 'back', 'deltoids'),
  ('traps', 'front', 'trapezius'),
  ('traps', 'back', 'trapezius'),
  ('upper traps', 'front', 'trapezius'),
  ('upper traps', 'back', 'trapezius'),
  ('mid traps', 'front', 'trapezius'),
  ('mid traps', 'back', 'trapezius'),
  ('lower traps', 'front', 'trapezius'),
  ('lower traps', 'back', 'trapezius'),
  ('lats', 'back', 'upper-back'),
  ('upper back', 'back', 'upper-back'),
  ('lower back', 'back', 'lower-back'),
  ('quads', 'front', 'quadriceps'),
  ('hip flexors', 'front', 'quadriceps'),
  ('hamstrings', 'back', 'hamstring'),
  ('adductors', 'front', 'adductors'),
  ('adductors', 'back', 'adductors'),
  ('glutes', 'back', 'gluteal'),
  ('glute medius', 'back', 'gluteal'),
  ('calves', 'front', 'calves'),
  ('calves', 'back', 'calves'),
  ('soleus', 'front', 'calves'),
  ('soleus', 'back', 'calves'),
  ('neck', 'front', 'neck'),
  ('neck', 'back', 'neck')
) as v(label, view, slug)
join muscle_detailed md on lower(md.label) = v.label
on conflict (view, slug, muscle_detailed_key) do nothing;
