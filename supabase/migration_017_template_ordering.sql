-- Migration: lets a user manually reorder their template list. Exercises
-- *within* a template already have a position column (template_exercises)
-- and don't need any schema change to become reorderable.

alter table workout_templates add column if not exists position integer;

-- Backfill existing templates with a stable initial order (oldest first)
-- so reordering starts from something sane instead of everyone at 0.
with ordered as (
  select id, row_number() over (partition by user_id order by created_at asc) - 1 as rn
  from workout_templates
  where position is null
)
update workout_templates t
set position = ordered.rn
from ordered
where t.id = ordered.id;

alter table workout_templates alter column position set default 0;
