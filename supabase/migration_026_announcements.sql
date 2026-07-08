-- Migration: announcements.
-- Admin-authored posts broadcast to every user, shown behind a bell-style
-- button on the home screen (left of Settings), with a notification dot
-- for anyone who hasn't seen the latest one yet.

create table announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id),
  message text not null,
  created_at timestamptz not null default now()
);

alter table announcements enable row level security;

-- Everyone can read announcements; only admins can post them.
create policy "announcements_select_all" on announcements for select using (true);
create policy "announcements_insert_admin" on announcements for insert
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
create policy "announcements_delete_admin" on announcements for delete
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- Per-user "last seen" timestamp for the notification dot, same pattern
-- as feedback_last_viewed_at.
alter table profiles add column if not exists announcements_last_viewed_at timestamptz;

create index idx_announcements_created on announcements(created_at desc);
