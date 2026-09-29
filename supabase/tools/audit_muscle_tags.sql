-- Read-only. Audits how cleanly exercise muscle tags line up with the
-- 3-tier taxonomy (muscle_groups -> muscle_detailed -> muscle_taxonomy).
-- Run in the Supabase SQL editor; every query is a SELECT.

-- 1. Categories outside the canonical 8. The app now folds legacy names
--    (Biceps, Hamstrings, Traps, ...) into their current Category on the
--    client, but anything listed here should be fixed at the source.
select key, label from muscle_groups
where key not in ('Chest','Back','Shoulders','Arms','Legs','Core','Neck','Full Body')
order by key;

-- 2. Regions with no Anatomy entries under them (dead options in Region
--    mode pickers).
select d.key, d.label, d.generic_group
from muscle_detailed d
left join muscle_taxonomy t on t.detailed_key = d.key
where t.scientific_name is null
order by d.generic_group, d.label;

-- 3. exercises.muscle_group values that aren't a Category.
select muscle_group, count(*) as exercises
from exercises
where muscle_group is not null
  and muscle_group not in (select key from muscle_groups)
group by muscle_group order by exercises desc;

-- 4. Primary/secondary tags that don't match any Anatomy entry
--    (case-insensitive) or any Region label. These render as raw text and
--    are invisible to Region/Anatomy filters.
with tags as (
  select e.id, e.name, 'primary' as role, unnest(e.primary_muscles) as tag from exercises e
  union all
  select e.id, e.name, 'secondary', unnest(e.secondary_muscles) from exercises e
)
select tag, role, count(*) as uses, min(name) as example_exercise
from tags
where tag is not null and lower(tag) <> 'none'
  and lower(tag) not in (select lower(scientific_name) from muscle_taxonomy)
  and lower(tag) not in (select lower(label) from muscle_detailed)
  and tag not in (select key from muscle_groups)
group by tag, role
order by uses desc;

-- 5. Exercises tagging the same muscle as both primary and secondary.
select id, name, primary_muscles, secondary_muscles
from exercises
where primary_muscles && secondary_muscles
order by name;

-- 6. Split exclusions pointing at Regions that no longer exist.
select s.name as split, x.muscle_detailed_key
from split_muscle_exclusions x
join splits s on s.id = x.split_id
left join muscle_detailed d on d.key = x.muscle_detailed_key
where d.key is null;
