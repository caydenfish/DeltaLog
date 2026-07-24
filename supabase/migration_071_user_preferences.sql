-- User-level app preferences (Preferences screen, Muscle Names mode,
-- Home dashboard module layout, rest timer defaults, etc. -- everything
-- lib/prefs.js's getPrefs()/setPref() manage) previously lived only in
-- localStorage, meaning a person who had to clear their browser's
-- cache/cookies/site data (e.g. to recover from the stale-service-worker
-- gray-screen bug fixed in 1.12.14) lost every preference they'd set,
-- with no way to get them back short of redoing all of it by hand.
--
-- This table is a lightweight per-user backup: one JSON blob per user,
-- kept in sync in the background (lib/prefs.js debounces a write on
-- every setPref() call) and pulled down once at sign-in to fill in
-- anything missing from a fresh/cleared localStorage -- see
-- initPrefsSync() in lib/prefs.js. Deliberately just a jsonb blob rather
-- than a normalized table: this mirrors exactly what's already stored in
-- localStorage, so there's no schema to keep in sync with every new
-- preference lib/prefs.js's DEFAULTS gains over time.
create table user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table user_preferences enable row level security;

create policy "user_preferences_select_own" on user_preferences for select
  using (auth.uid() = user_id);
create policy "user_preferences_insert_own" on user_preferences for insert
  with check (auth.uid() = user_id);
create policy "user_preferences_update_own" on user_preferences for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
