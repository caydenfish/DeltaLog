-- Migration: optional progress photos, taken alongside a body weight
-- entry (post-workout summary, or backfilled from the home screen
-- calendar for a past date). Private per user for now — no sharing.

create table if not exists progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  taken_on date not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (user_id, taken_on)
);

alter table progress_photos enable row level security;

create policy "progress_photos_all_own" on progress_photos for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Private bucket — no public read policy, unlike exercise-media. Access
-- is only ever through a signed URL requested by the owning user.
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

drop policy if exists "progress_photos_owner_select" on storage.objects;
create policy "progress_photos_owner_select" on storage.objects for select
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "progress_photos_owner_insert" on storage.objects;
create policy "progress_photos_owner_insert" on storage.objects for insert
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "progress_photos_owner_update" on storage.objects;
create policy "progress_photos_owner_update" on storage.objects for update
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "progress_photos_owner_delete" on storage.objects;
create policy "progress_photos_owner_delete" on storage.objects for delete
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
