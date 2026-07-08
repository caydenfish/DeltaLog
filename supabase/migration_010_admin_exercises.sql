-- Migration: admin visibility into user-submitted custom exercises, and
-- the ability to promote one into the shared system library.

-- Flag on profiles. Set your own row to true manually in the SQL editor:
--   update profiles set is_admin = true where id = '<your-auth-uid>';
alter table profiles add column if not exists is_admin boolean not null default false;

-- Admins can see every custom exercise (not just their own), so they can
-- review what people are creating.
drop policy if exists "exercises_select_admin" on exercises;
create policy "exercises_select_admin" on exercises for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- Admins can update any exercise. "Promoting" a custom exercise into the
-- shared library is just setting created_by to null, which the existing
-- exercises_select_own_or_system policy already treats as visible to
-- everyone.
drop policy if exists "exercises_update_admin" on exercises;
create policy "exercises_update_admin" on exercises for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- Admins can delete exercises too (e.g. rejecting junk/duplicate submissions).
drop policy if exists "exercises_delete_admin" on exercises;
create policy "exercises_delete_admin" on exercises for delete
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
