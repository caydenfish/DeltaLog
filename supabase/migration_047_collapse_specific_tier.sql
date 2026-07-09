-- Migration: collapse back to 3 taxonomy tiers. migration_046 added a
-- 4th tier (Specific, e.g. "Triceps Long Head") between Detailed and
-- Scientific; that's being dropped again in favor of 3 tiers, renamed
-- Category / Region / Anatomy (same tables underneath -- muscle_groups,
-- muscle_detailed, muscle_taxonomy -- this is a naming and structure
-- change in the app layer, not a fourth table rename).
--
-- Defensive/idempotent: safe to run whether migration_046 actually
-- landed on this database or not. If muscle_specific doesn't exist,
-- there's nothing to collapse and this is a no-op.

do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'muscle_specific') then

    -- Point every scientific entry directly at its detailed grandparent
    -- again, going through whatever specific row it currently sits under.
    alter table muscle_taxonomy add column if not exists detailed_key text references muscle_detailed(key);

    update muscle_taxonomy mt
    set detailed_key = ms.detailed_key
    from muscle_specific ms
    where ms.key = mt.specific_key and mt.detailed_key is null;

    alter table muscle_taxonomy alter column detailed_key set not null;
    alter table muscle_taxonomy drop column if exists specific_key;

    drop table muscle_specific;

  end if;
end $$;

notify pgrst, 'reload schema';
