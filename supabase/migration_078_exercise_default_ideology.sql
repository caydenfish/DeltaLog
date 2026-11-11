-- Remembers a per-exercise training focus override (Strength /
-- Hypertrophy / Endurance) across sessions. Same null-means-inherit-
-- global-default convention as rest_seconds (migration_004) and
-- warmup_rest_seconds (migration_051): null = follow the app-wide
-- trainingIdeology preference.
alter table exercise_defaults add column if not exists ideology text;
