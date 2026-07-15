-- Migration: drop the `Metrics` table.
--
-- Found live during the reconciliation against migration files (see
-- README.md / MIGRATIONS_INDEX.md) — no corresponding migration
-- anywhere, no references anywhere in the app code, and an unusual
-- capital-M name unlike every other table in this schema (all
-- snake_case elsewhere). Confirmed empty (0 rows, no created_at value)
-- before dropping — dead scaffolding from something that never got
-- built out, not live data.
drop table if exists public."Metrics";
