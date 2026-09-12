-- Strava integration: push a finished workout to Strava, matched onto
-- whatever activity a person's own watch/tracker (Garmin, Apple Watch,
-- Coros, Whoop, etc.) already synced there, rather than creating a
-- duplicate entry. Device-agnostic by design: detection is "does an
-- activity already exist in this time window", never "is this Garmin",
-- so it works the same regardless of what hardware synced first.
--
-- Four tables:
--   strava_tokens      -- OAuth tokens. Service-role only, on purpose:
--                          no RLS policy grants anon/authenticated
--                          access at all, so these never reach the
--                          client even by accident. Only the edge
--                          functions (using the service role key) can
--                          read or write this table.
--   strava_connections -- non-secret "is this account connected"
--                          mirror (athlete id, connected-at), kept in
--                          step with strava_tokens by the edge
--                          functions so the client can show connection
--                          status without ever touching a real token.
--   strava_oauth_state -- single-use state tokens for the OAuth
--                          redirect round-trip (see strava-oauth-callback).
--   strava_link_status -- one row per workout once it's been pushed
--                          through the Strava flow: pending (checked
--                          once, waiting on the delayed retry),
--                          matched (linked to a Strava activity),
--                          unlinked (no match found after both checks,
--                          needs a manual link), or skipped (person
--                          dismissed the prompt).

create table strava_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  athlete_id bigint not null,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table strava_tokens enable row level security;
-- Deliberately no policies -- RLS with zero grants means nothing gets
-- through for anon/authenticated roles; only the service role (which
-- bypasses RLS entirely) can touch this table, i.e. only the edge
-- functions.

create table strava_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  athlete_id bigint not null,
  athlete_name text,
  connected_at timestamptz not null default now()
);

alter table strava_connections enable row level security;

create policy "strava_connections_select_own" on strava_connections for select
  using (auth.uid() = user_id);
-- No insert/update/delete policy for authenticated -- only the edge
-- functions (service role) write this, right after they write
-- strava_tokens, so the two never drift out of sync.

create table strava_oauth_state (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table strava_oauth_state enable row level security;

create policy "strava_oauth_state_insert_own" on strava_oauth_state for insert
  with check (auth.uid() = user_id);
-- No select policy for authenticated -- the client only ever writes
-- its own state row before redirecting to Strava; the callback edge
-- function (service role) is what reads and deletes it.

create table strava_link_status (
  workout_id uuid primary key references workouts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'matched', 'unlinked', 'skipped')),
  strava_activity_id bigint,
  next_check_at timestamptz,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_strava_link_status_due on strava_link_status(next_check_at) where status = 'pending';
create index idx_strava_link_status_user on strava_link_status(user_id, status);

alter table strava_link_status enable row level security;

create policy "strava_link_status_select_own" on strava_link_status for select
  using (auth.uid() = user_id);
-- No insert/update/delete policy for authenticated -- strava-check and
-- strava-manual (both service role) own every write to this table.
-- The client only reads it, to show the "needs manual link" banner
-- and let someone dismiss it (which itself goes through strava-manual
-- rather than a direct client update, so status transitions stay in
-- one place).

-- ── Delayed-retry scheduling ─────────────────────────────────────────
-- The immediate check (called by the client right after a workout
-- finishes) and the ~3-minute retry both need to run even if the
-- person has already closed the app -- a client-side setTimeout would
-- never fire once the tab's gone. pg_cron polling every minute for
-- rows whose next_check_at has passed is what makes the retry
-- reliable regardless of whether anyone's still looking at the app.
--
-- Requires the pg_cron and pg_net extensions, both available on
-- Supabase by default. Replace <PROJECT_REF> and <CRON_SECRET> below
-- before running this migration:
--   - <PROJECT_REF> is your Supabase project ref (the subdomain in
--     https://<PROJECT_REF>.supabase.co).
--   - <CRON_SECRET> is a random string you also set as the CRON_SECRET
--     secret on the strava-check function (`supabase secrets set
--     CRON_SECRET=...`) -- strava-check checks this header on every
--     batch-mode call so the endpoint can't be triggered by anyone
--     who simply finds the URL.
select cron.schedule(
  'strava-check-due-links',
  '* * * * *', -- every minute
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.functions.supabase.co/strava-check',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);
