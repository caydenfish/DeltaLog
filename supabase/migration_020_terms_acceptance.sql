-- Migration: terms & conditions acceptance gate. Existing users (who
-- already have a non-null terms_accepted_at from before this feature
-- existed... they won't, since the column is new) will all have NULL
-- here, so the app gate in App.jsx will require every user — new and
-- existing — to accept before they can keep using the app.

alter table profiles add column if not exists terms_accepted_at timestamptz;
