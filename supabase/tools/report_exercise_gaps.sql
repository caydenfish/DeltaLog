-- Moved from supabase/report_exercise_gaps.sql during the July 2026
-- migration-history cleanup (content unchanged) — read-only reporting
-- tool, not a migration, no migration_NNN number. See ../README.md.
--
-- Run this AFTER migration_036_exercise_library_overhaul.sql, in the
-- SAME SQL editor session/tab (the temp table it uses only lives for
-- that one database connection). Run each query separately and send me
-- both result sets.

-- (a) Old system exercises with no equivalent in the new sheet. Left
-- completely untouched by the migration (not archived, not deleted) --
-- decide per-exercise once you've seen this list.
select e.id, e.name, e.muscle_group, e.archived
from exercises e
where e.created_by is null
and not exists (select 1 from _new_exercises n where lower(trim(n.name)) = lower(trim(e.name)))
order by e.name;

-- (b) Custom exercises that had no match in the new sheet and were left
-- alone -- still live and in use, just not represented in the new
-- library yet.
select id, name, created_by from exercises where created_by is not null order by name;

-- Once you're done reviewing both lists, this releases the temp table:
-- drop table _new_exercises;
