-- Migration: lets an admin actually manage submissions instead of just
-- reading them — flag for follow-up, leave a private note, move through
-- an open/closed/archived lifecycle, and delete outright.

alter table feedback add column if not exists status text not null default 'open' check (status in ('open', 'closed', 'archived'));
alter table feedback add column if not exists flagged boolean not null default false;
alter table feedback add column if not exists admin_note text;
alter table feedback add column if not exists updated_at timestamptz not null default now();

-- Admins can update (status/flag/note) and delete any submission. Insert
-- stays owner-only (feedback_insert_own, from migration_009) and there's
-- still no update/delete policy for regular users — submitters can't
-- edit or remove what they sent.
drop policy if exists "feedback_update_admin" on feedback;
create policy "feedback_update_admin" on feedback for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "feedback_delete_admin" on feedback;
create policy "feedback_delete_admin" on feedback for delete
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
