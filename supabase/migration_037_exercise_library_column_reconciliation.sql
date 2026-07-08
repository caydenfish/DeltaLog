-- Migration: reconciles the exercises table after the July 2026 CSV
-- import. That import replaced name/aliases/muscle_group/
-- primary_muscles/secondary_muscles/equipment with raw spreadsheet-
-- header columns, and dropped mechanism/pattern/equipment_type/
-- laterality/grip/skill_level entirely. Those six fields are gone from
-- the app for good as of this release -- this migration doesn't restore
-- them, it just gets everything else back into the shape queries.js
-- expects.
--
-- Renamed 1:1 (same data, just the column name the app reads):
--   "Exercise Name" -> name
--   "Nicknames"     -> aliases
--   "Equipment"     -> equipment
--
-- Derived (new columns, populated from the raw Level 1/3 sheet columns,
-- which are left in place as the source of truth for re-deriving these
-- after a future spreadsheet re-import -- see the maintenance query at
-- the bottom):
--   muscle_group     <- first value of "Primary Muscle(s) Level 1 (Generic)"
--   primary_muscles  <- "Primary Muscle(s) Level 3 (Scientific)"
--   secondary_muscles <- "Secondary Muscle(s) Level 3 (Scientific)"

alter table exercises rename column "Exercise Name" to name;
alter table exercises rename column "Nicknames" to aliases;
alter table exercises rename column "Equipment" to equipment;

alter table exercises add column if not exists muscle_group text;
alter table exercises add column if not exists primary_muscles text[] not null default '{}';
alter table exercises add column if not exists secondary_muscles text[] not null default '{}';

update exercises set
  muscle_group = ("Primary Muscle(s) Level 1 (Generic)")[1],
  primary_muscles = coalesce("Primary Muscle(s) Level 3 (Scientific)", '{}'),
  secondary_muscles = coalesce("Secondary Muscle(s) Level 3 (Scientific)", '{}');

-- Report: any exercise that didn't end up with a muscle_group (empty or
-- null Level 1 array) will break the picker/filter/heatmap for that row
-- specifically -- fix these by hand in the admin Exercise Library screen.
select id, name, "Primary Muscle(s) Level 1 (Generic)"
from exercises
where muscle_group is null
order by name;

-- ── Maintenance query -- rerun this (not the whole migration) any time ──
-- you re-import an updated version of the spreadsheet into the raw
-- Level 1/2/3 columns, to refresh the derived columns from it:
--
-- update exercises set
--   muscle_group = ("Primary Muscle(s) Level 1 (Generic)")[1],
--   primary_muscles = coalesce("Primary Muscle(s) Level 3 (Scientific)", '{}'),
--   secondary_muscles = coalesce("Secondary Muscle(s) Level 3 (Scientific)", '{}');
