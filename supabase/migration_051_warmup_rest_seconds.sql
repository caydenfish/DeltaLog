-- Adds a separate rest-timer override for warmup sets, alongside the
-- existing working-set rest_seconds column. Same null-means-inherit-
-- global-default convention as rest_seconds (see migration_004).
alter table exercise_defaults add column if not exists warmup_rest_seconds integer;
