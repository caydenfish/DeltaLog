-- Migration: exercise demo photos/gifs, replacing the colored muscle dot
-- in exercise lists.

alter table exercises add column if not exists media_url text;

-- Public bucket for exercise demo images. Public read (anyone can view
-- a demo photo), writes restricted to authenticated users for their own
-- uploads; admins can overwrite any file via the app's service-role-free
-- flow by uploading under their own folder and then setting media_url
-- directly (see setExerciseMedia in queries.js).
insert into storage.buckets (id, name, public)
values ('exercise-media', 'exercise-media', true)
on conflict (id) do nothing;

drop policy if exists "exercise_media_public_read" on storage.objects;
create policy "exercise_media_public_read" on storage.objects for select
  using (bucket_id = 'exercise-media');

drop policy if exists "exercise_media_authenticated_upload" on storage.objects;
create policy "exercise_media_authenticated_upload" on storage.objects for insert
  with check (bucket_id = 'exercise-media' and auth.role() = 'authenticated');

drop policy if exists "exercise_media_owner_update" on storage.objects;
create policy "exercise_media_owner_update" on storage.objects for update
  using (bucket_id = 'exercise-media' and owner = auth.uid());

drop policy if exists "exercise_media_owner_delete" on storage.objects;
create policy "exercise_media_owner_delete" on storage.objects for delete
  using (bucket_id = 'exercise-media' and owner = auth.uid());
