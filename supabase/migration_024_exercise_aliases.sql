-- Migration: exercise search aliases. Lets an admin record that a user's
-- custom exercise submission is functionally the same movement as an
-- existing library exercise, just named differently (e.g. "Hamstring
-- Curl" submitted by a user vs. the library's "Machine Seated Leg
-- Curl"). The submission itself is left completely alone — its creator
-- keeps using it exactly as before — it's just marked reviewed so it
-- drops out of the admin queue, and its name is recorded here as a
-- search alias on the target library exercise so anyone searching that
-- name finds the existing exercise instead of a near-duplicate ever
-- getting created or promoted separately.

alter table exercises add column if not exists aliases text[] not null default '{}';

-- Speeds up alias lookups if this ever needs a server-side search path;
-- the current client does its own substring matching over an already
-- small in-memory list, but the index costs nothing to have ready.
create index if not exists exercises_aliases_gin on exercises using gin (aliases);

-- Closes the loop on merges: once "Hamstring Curl" has been recorded as
-- an alias of "Machine Seated Leg Curl", the NEXT person who
-- independently creates a custom exercise literally named "Hamstring
-- Curl" gets auto-marked reviewed on insert — it never lands in the
-- admin queue again. Their copy is left completely untouched, same as
-- every other case here; only the review-queue visibility changes.
create or replace function auto_dismiss_known_alias()
returns trigger as $$
begin
  if new.created_by is null then
    return new;
  end if;

  if exists (
    select 1 from exercises e
    where e.id <> new.id
      and e.aliases is not null
      and lower(trim(new.name)) in (select lower(trim(a)) from unnest(e.aliases) a)
  ) then
    update exercises set admin_reviewed = true where id = new.id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_auto_dismiss_known_alias on exercises;
create trigger trg_auto_dismiss_known_alias
after insert on exercises
for each row execute function auto_dismiss_known_alias();
