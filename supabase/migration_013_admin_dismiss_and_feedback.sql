-- Migration: let an admin dismiss a custom exercise from their review
-- queue without deleting it or otherwise touching the user's ability to
-- use it. Also gives admins read access to feedback submissions so bugs
-- and feature requests can be reviewed in-app instead of only via the
-- Supabase dashboard.

alter table exercises add column if not exists admin_reviewed boolean not null default false;

drop policy if exists "feedback_select_admin" on feedback;
create policy "feedback_select_admin" on feedback for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
