-- Migration: optional "how did you hear about us" field, captured once
-- at the bottom of the onboarding/setup screen. Purely informational —
-- never gates onboarding completion, so it's fine for existing rows to
-- stay null.

alter table profiles add column if not exists heard_about_us text;
