-- Migration: labels for the new DXF-derived body map art (LaserCutLace
-- asset, 620 raw shapes across male/female front/back). The shape
-- geometry itself ships as a static asset (src/lib/dxfBodyMapData.js,
-- one row per view/shape id) -- this table holds only the human-assigned
-- mapping from a shape to a muscle_detailed key, built via
-- Admin > Body Map Labeler. Nullable muscle_key means "seen but not
-- labeled yet"; a row simply not existing means "not yet reviewed at
-- all" (the admin UI seeds one row per shape on first load of a view so
-- progress can be tracked honestly).
create table body_map_shape_labels (
  view text not null check (view in ('male_front','male_back','female_front','female_back')),
  shape_id integer not null,
  muscle_key text references muscle_detailed(key),
  excluded boolean not null default false, -- true = confirmed non-muscle (hand/foot/head/hair)
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key (view, shape_id)
);

alter table body_map_shape_labels enable row level security;

-- Readable by everyone -- the real body map (once this replaces the
-- current MIT-licensed art) needs these labels for every user, not just
-- admins.
create policy "body_map_shape_labels_select_all" on body_map_shape_labels for select using (true);

create policy "body_map_shape_labels_insert_admin" on body_map_shape_labels for insert
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
create policy "body_map_shape_labels_update_admin" on body_map_shape_labels for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
create policy "body_map_shape_labels_delete_admin" on body_map_shape_labels for delete
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

create index idx_body_map_shape_labels_view on body_map_shape_labels(view);
create index idx_body_map_shape_labels_muscle on body_map_shape_labels(muscle_key);
