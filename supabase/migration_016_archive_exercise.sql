-- Migration: archiving a custom exercise. Deleting one is blocked by the
-- exercise_id foreign key if it's ever been logged (see migration_015) --
-- archiving is the way out of that: it hides the exercise from the
-- picker/library everywhere it's selected from, without touching any
-- past workout that already references it.

alter table exercises add column if not exists archived boolean not null default false;
