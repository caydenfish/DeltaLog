-- Migration: require first + last name on profiles. Existing users with
-- a null first_name/last_name get routed back through the onboarding
-- gate by the app (see App.jsx profileComplete check) until they fill
-- these in — no destructive change here, just adding the columns.

alter table profiles add column if not exists first_name text;
alter table profiles add column if not exists last_name text;
