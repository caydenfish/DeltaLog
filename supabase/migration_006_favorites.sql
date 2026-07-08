-- Migration: favorite exercises.
-- Lets a user star exercises so they're recommended first in every picker
-- (add exercise, replace exercise, generator, template builder).

alter table exercise_defaults add column if not exists is_favorite boolean not null default false;
