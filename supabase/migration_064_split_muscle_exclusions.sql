-- Migration: split muscle exclusions -- fixes the workout generator
-- picking the same exercise for both Push and Pull days.
--
-- Root cause: exercises.muscle_group only carries the coarse Category
-- tier (8 buckets: Arms, Back, Chest, Core, Full Body, Legs, Neck,
-- Shoulders). Front Delts, Side Delts, and Rear Delts all collapse into
-- "Shoulders"; Biceps and Triceps both collapse into "Arms". Since
-- split_muscles (migration_043) assigns both "Shoulders" and "Arms" to
-- Push AND Pull -- a push day needs some shoulder/arm work, so does a
-- pull day -- any exercise tagged Shoulders or Arms is a valid candidate
-- for both days. Cable Lateral Raise (Lateral Deltoid -> Shoulders)
-- shows up as a pick on Push day and, independently, on Pull day too.
--
-- Fix: a new split_muscle_exclusions table lets a split opt a specific
-- Region (muscle_detailed) OUT of an included Category, without
-- restructuring every split down to Region-level granularity (which
-- would mean re-enumerating dozens of rows per split and rewriting the
-- exercise picker's split filter and FAQ glossary along with it). Push
-- keeps "Shoulders" and "Arms" as included Categories but excludes the
-- Region rows that are actually pull-pattern muscles (Rear Delts,
-- Biceps, Brachialis, Forearm Flexors); Pull does the mirror image.
-- Categories that were never ambiguous (Chest, Back, Legs, Core, Traps,
-- Forearms, Full Body) are untouched.

-- 1. Region-tier counterpart to muscle_group. Same "first-listed primary
-- muscle wins" rule as sync_exercise_muscle_group() (migration_058), so
-- an exercise gets one Region value the same way it already gets one
-- Category value. muscle_group itself is untouched and keeps driving the
-- heatmap/coloring/existing filters exactly as before -- this is a
-- purely additive column used only by the exclusion check below.
alter table exercises add column if not exists muscle_region text references muscle_detailed(key);

create or replace function public.sync_exercise_muscle_region()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  first_key text;
  full_body_key text;
begin
  if NEW.primary_muscles is null or array_length(NEW.primary_muscles, 1) is null then
    return NEW;
  end if;

  select md.key into full_body_key from muscle_detailed md where md.label = 'Full Body' limit 1;

  select mt.detailed_key into first_key
  from muscle_taxonomy mt
  where mt.scientific_name = NEW.primary_muscles[1];

  if full_body_key is not null and exists (select 1 from muscle_group_full_body_override where exercise_id = NEW.id) then
    NEW.muscle_region := full_body_key;
  else
    NEW.muscle_region := first_key;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_sync_exercise_muscle_region on exercises;
create trigger trg_sync_exercise_muscle_region
  before insert or update on exercises
  for each row execute function public.sync_exercise_muscle_region();

-- Backfill: same no-op self-update pattern as migration_058's
-- muscle_group backfill, so every existing row gets a muscle_region
-- without touching anything else about it.
update exercises set id = id where array_length(primary_muscles, 1) is not null;

-- 2. Exclusion table.
create table split_muscle_exclusions (
  split_id uuid not null references splits(id) on delete cascade,
  muscle_detailed_key text not null references muscle_detailed(key) on delete cascade,
  primary key (split_id, muscle_detailed_key)
);

alter table split_muscle_exclusions enable row level security;

create policy "split_muscle_exclusions_select_all" on split_muscle_exclusions for select using (true);
create policy "split_muscle_exclusions_insert_admin" on split_muscle_exclusions for insert
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
create policy "split_muscle_exclusions_delete_admin" on split_muscle_exclusions for delete
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- 3. Seed the Push/Pull exclusions by label pattern rather than hardcoded
-- keys, since exact key spelling depends on how each label was
-- originally slugified and may have drifted from admin edits since. Loose
-- ILIKE matches on purpose -- see the report query at the bottom to
-- confirm what actually landed, rather than trusting this silently.
insert into split_muscle_exclusions (split_id, muscle_detailed_key)
select s.id, md.key
from splits s
join muscle_detailed md on md.generic_group in ('Shoulders', 'Arms')
where s.name = 'Push'
  and (md.label ilike '%rear delt%' or md.label ilike '%posterior delt%'
       or md.label ilike '%bicep%' or md.label ilike '%brachialis%'
       or md.label ilike '%forearm flexor%')
on conflict do nothing;

insert into split_muscle_exclusions (split_id, muscle_detailed_key)
select s.id, md.key
from splits s
join muscle_detailed md on md.generic_group in ('Shoulders', 'Arms')
where s.name = 'Pull'
  and (md.label ilike '%front delt%' or md.label ilike '%anterior delt%'
       or md.label ilike '%side delt%' or md.label ilike '%lateral delt%'
       or md.label ilike '%tricep%' or md.label ilike '%forearm extensor%')
on conflict do nothing;

notify pgrst, 'reload schema';

-- Report -- run manually after the migration to confirm what landed.
-- Anything under Shoulders/Arms that matched neither Push nor Pull's
-- pattern is left included on both (correct for genuinely dual-purpose
-- muscles like Rotator Cuff, but worth a glance for anything unexpected).
-- select s.name as split, md.label as excluded_region
-- from split_muscle_exclusions sme
-- join splits s on s.id = sme.split_id
-- join muscle_detailed md on md.key = sme.muscle_detailed_key
-- order by s.name, md.label;
