-- Migration: announcement polls + archiving.
-- Lets an admin attach an optional poll to an announcement, edit an
-- announcement after posting, and archive one instead of deleting it
-- outright. Archived announcements are only ever visible to admins —
-- enforced here at the RLS level, not just in the UI.

alter table announcements add column if not exists archived boolean not null default false;
alter table announcements add column if not exists updated_at timestamptz;
-- Null when the announcement has no poll. Shape: { question: text,
-- options: [{ id: text, label: text }, ...] }.
alter table announcements add column if not exists poll jsonb;

-- Replace the old "everyone can read everything" policy: non-admins now
-- only ever see non-archived rows, admins see all of them.
drop policy if exists "announcements_select_all" on announcements;
create policy "announcements_select_all" on announcements for select
  using (
    archived = false
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );

-- Admins can edit (message/poll) and archive/unarchive existing posts.
create policy "announcements_update_admin" on announcements for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- One vote per user per announcement; re-voting moves the vote rather
-- than adding a second one (enforced by the primary key + upsert).
create table if not exists announcement_poll_votes (
  announcement_id uuid not null references announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  option_id text not null,
  created_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

alter table announcement_poll_votes enable row level security;

create policy "poll_votes_select_all" on announcement_poll_votes for select using (true);
create policy "poll_votes_insert_own" on announcement_poll_votes for insert with check (user_id = auth.uid());
create policy "poll_votes_update_own" on announcement_poll_votes for update using (user_id = auth.uid());
create policy "poll_votes_delete_own" on announcement_poll_votes for delete using (user_id = auth.uid());

create index if not exists idx_announcement_poll_votes_announcement on announcement_poll_votes(announcement_id);
