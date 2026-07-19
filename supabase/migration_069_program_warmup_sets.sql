-- Adds warmup-set planning to the Program Generator, matching what
-- manually-built workouts/templates already support (planned_warmup_sets
-- on workout_exercises/template_exercises). Program-generated days never
-- had this — every generated exercise came in as straight working sets,
-- no warmup, regardless of how heavy the lead lift was. Defaulting to 0
-- keeps every already-created program unaffected; the generator now
-- assigns 2 warmup sets to the first (compound) exercise of each
-- generated day going forward.
alter table program_exercises
  add column if not exists planned_warmup_sets integer not null default 0;
