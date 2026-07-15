-- Moved from supabase/diagnostics_taxonomy_audit.sql during the July
-- 2026 migration-history cleanup (content unchanged) — read-only
-- diagnostic tool, not a migration, no migration_NNN number. See
-- ../README.md.
--
-- Read-only. Run after migration_046_muscle_specific_tier.sql to
-- confirm the 4-tier structure landed the way it should have, and to
-- get a real, complete picture of the current data to work from.

-- (a) Every tier's row count.
select
  (select count(*) from muscle_groups) as general_count,
  (select count(*) from muscle_detailed) as detailed_count,
  (select count(*) from muscle_specific) as specific_count,
  (select count(*) from muscle_taxonomy) as scientific_count;

-- (b) The full tree, General down to Scientific, one row per Scientific
-- entry. This is the ground truth for what every naming mode actually
-- shows right now.
select
  g.label as general_label,
  d.label as detailed_label,
  sp.label as specific_label,
  s.scientific_name
from muscle_taxonomy s
join muscle_specific sp on sp.key = s.specific_key
join muscle_detailed d on d.key = sp.detailed_key
join muscle_groups g on g.key = d.generic_group
order by g.label, d.label, sp.label, s.scientific_name;

-- (c) Specific groups still sitting at the placeholder "(General)" seed
-- -- these are the ones worth splitting into real subdivisions (e.g.
-- "Triceps (General)" into "Triceps Long Head" / "Triceps Short Head")
-- as you go through, sorted by how many Scientific entries are bundled
-- under each one (the biggest bundles are probably worth splitting up
-- first).
select sp.label as specific_label, d.label as detailed_label, count(s.scientific_name) as bundled_scientific_count
from muscle_specific sp
join muscle_detailed d on d.key = sp.detailed_key
left join muscle_taxonomy s on s.specific_key = sp.key
where sp.label like '%(General)'
group by sp.key, sp.label, d.label
order by bundled_scientific_count desc;

-- (d) Confirm the rename RPC is live.
select proname, pg_get_function_arguments(oid) as args
from pg_proc
where proname = 'admin_rename_muscle_scientific';
