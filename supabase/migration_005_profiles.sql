-- Migration: user profile (gender, date of birth, weight) for onboarding
-- and DOTS strength scoring.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  gender text,
  date_of_birth date,
  weight numeric,
  weight_unit text not null default 'lb',
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_all_own" on profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);
