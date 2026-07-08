-- Migration: height fields on profiles.
-- Note: DOTS strength scoring only uses bodyweight + gender, not height —
-- this is captured for completeness/future use (BMI, other calculators),
-- not because it changes the current strength score.

alter table profiles add column if not exists height numeric;
alter table profiles add column if not exists height_unit text not null default 'in';
