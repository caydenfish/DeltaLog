-- Migration: per-user weekly set targets per muscle group, backing the
-- new "My Plan" home module. Real user data worth syncing across
-- devices (someone's programming shouldn't reset on a new phone), so
-- this lives in Supabase rather than the localStorage prefs used for
-- purely device-local display preferences.
create table muscle_group_targets (
  user_id uuid not null references auth.users(id) on delete cascade,
  muscle_group text not null,
  weekly_target_sets integer not null default 10,
  updated_at timestamptz not null default now(),
  primary key (user_id, muscle_group)
);

alter table muscle_group_targets enable row level security;

create policy "muscle_group_targets_select_own" on muscle_group_targets for select
  using (auth.uid() = user_id);
create policy "muscle_group_targets_insert_own" on muscle_group_targets for insert
  with check (auth.uid() = user_id);
create policy "muscle_group_targets_update_own" on muscle_group_targets for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "muscle_group_targets_delete_own" on muscle_group_targets for delete
  using (auth.uid() = user_id);

create index idx_muscle_group_targets_user on muscle_group_targets(user_id);
