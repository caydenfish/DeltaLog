-- Migration: feedback table for in-app bug reports and feature requests.
-- No select policy for regular users on purpose — submissions are
-- reviewed via the Supabase dashboard (table editor / SQL editor, which
-- runs as the project owner and bypasses RLS), so feedback stays private
-- between the submitter and the developer rather than being visible to
-- other signed-in users.

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('bug', 'feature')),
  message text not null,
  context text,
  created_at timestamptz not null default now()
);

alter table feedback enable row level security;

create policy "feedback_insert_own" on feedback for insert
  with check (auth.uid() = user_id);
