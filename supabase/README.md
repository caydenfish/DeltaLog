# DeltaLog Supabase migration history

There is no Supabase CLI migration tracking here — every file in this
folder is run by hand in the Supabase SQL Editor. That's exactly how
this folder drifted from what's actually live (see "Known drift" below),
so read the process rule at the bottom before your next ad hoc change.

## How to read this folder

**Sequential migrations** — `migration_NNN_description.sql` — run in
order, once each, against the live database. This is the real history.

**`migration_001_initial_schema.sql`** — renamed from `schema.sql` in
this cleanup (content unchanged). This is the true starting point; it
just never had a number before.

**`seed_exercises.sql`** — deliberately unnumbered. One-time seed data
(252 exercises), not a schema change. Runs between `migration_001` and
`migration_002`.

**`tools/`** — one-off diagnostic/recovery scripts that are NOT part of
the applied sequence and never get a `migration_NNN` number:
- `reset_templates_tables.sql` — break-glass recovery for
  `migration_003_templates.sql` specifically (drops + recreates
  `workout_templates`/`template_exercises`). Only run if 003 landed
  badly. Formerly `migration_003_templates_reset.sql` — that name
  implied it was a second version of migration 003, which is exactly
  the kind of ambiguity this cleanup was meant to remove.
- `diagnostics_taxonomy_audit.sql` — read-only, run after
  `migration_046` to verify the 4-tier muscle taxonomy landed correctly.
- `report_exercise_gaps.sql` — read-only, run after `migration_036` to
  find exercises with no equivalent in the new library sheet.

## Known numbering gaps

**038, 039 — closed, no action needed.** Confirmed with Cayden that
neither rings a bell, and nothing else references them anywhere (unlike
045, which we proved 046 already redoes). Treated as two migration
numbers that were claimed and abandoned before ever being run.

**045 — confirmed harmless, no action needed.** `migration_046`'s own
comment says it "supersedes migration_045 (harmless to also run that
one first)." 045 was a fix for `admin_rename_muscle_scientific` going
missing from PostgREST's schema cache; 046 redoes that exact fix
idempotently as part of a larger migration. Whether or not 045 was ever
actually run, 046 alone produces the correct end state. The file is
gone from the repo but nothing is missing from the applied history.

## Known drift between this folder and the live database

As of this cleanup, two database objects existed live that had **no
corresponding file anywhere in this folder** — they were created
directly in the SQL Editor and never saved back:

- `public.user_activity` (a view) — dropped in `migration_057`, see
  that file for why.
- `public.exercise_muscle_groups` (a view) — still needed, rebuilt in
  `migration_057` with a safer security setting.

A live reconciliation (see the query below) turned up three more
undocumented objects:

- `sync_exercise_muscle_group()` (a trigger function on `exercises`) —
  the real, active mechanism deciding an exercise's `muscle_group` on
  every insert/update. Fixed in `migration_058` — see that file for the
  full story.
- `muscle_group_full_body_override` (a table) — a legitimate manual
  exceptions list the trigger above consults. Left as-is.
- `Metrics` (a table, `id`/`created_at` only) — confirmed empty, dropped
  in `migration_059`.

Both original views are now captured in `migration_057_security_hardening.sql`,
and the trigger + override table + dead table are captured in
`migration_058`/`migration_059` — so the folder matches live reality
again as of migration_059. There could still be other undocumented
objects we haven't found, since ad hoc SQL Editor changes leave no
trace here by definition until someone remembers to add them.

### To fully confirm the folder matches live reality

Run this in the SQL Editor and send me the result — I'll diff it
against every migration file and flag anything not accounted for:

```sql
-- All tables, views, and functions currently live in the public schema
select 'table' as kind, tablename as name from pg_tables where schemaname = 'public'
union all
select 'view' as kind, viewname as name from pg_views where schemaname = 'public'
union all
select 'function' as kind, p.proname as name
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
order by kind, name;
```

## Going forward: the rule that prevents this happening again

**Every time you run SQL directly in the Supabase SQL Editor — even a
one-line fix, even "just testing something" — save it as the next
numbered `migration_NNN_description.sql` file in this folder before you
forget about it.** That's the only reason `user_activity` and
`exercise_muscle_groups` went undocumented: they were reasonable in the
moment and never wrong to run, just never written down. The folder is
only as accurate as the discipline of saving to it in the same sitting
you make the change.
