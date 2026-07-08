-- Migration: archiving templates, mirroring exercise archiving. Archived
-- templates are hidden from the main list and the "start from template"
-- flow, without deleting them.

alter table workout_templates add column if not exists archived boolean not null default false;
