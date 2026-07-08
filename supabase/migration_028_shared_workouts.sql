-- Migration: share a past workout as a public link.
-- Snapshots a completed workout (already resolved to display units/labels)
-- into a small public row under a short code. Anyone with the link can
-- view it — no login required — since the exercise-by-exercise detail is
-- denormalized in here rather than joined live from the owner's data.
create table shared_workouts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  snapshot jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table shared_workouts enable row level security;

-- Public read (the whole point of a share link, including for signed-out
-- visitors using the anon key), but only the creator can post/remove one.
create policy "shared_workouts_select_all" on shared_workouts for select using (true);
create policy "shared_workouts_insert_own" on shared_workouts for insert with check (auth.uid() = created_by);
create policy "shared_workouts_delete_own" on shared_workouts for delete using (auth.uid() = created_by);

create index idx_shared_workouts_code on shared_workouts(code);
