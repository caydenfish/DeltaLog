-- Migration: adds a broad "category" tier to body_map_shape_labels
-- (references muscle_groups.key -- Chest/Back/Legs/etc), separate from
-- the existing muscle_key (Region tier). Lets the labeler do a fast,
-- low-ambiguity first pass (which broad category is this shape) before
-- the slower, more precise Region-level pass -- the two are tracked
-- independently so progress on one doesn't block or get confused with
-- progress on the other.
alter table body_map_shape_labels add column if not exists category text references muscle_groups(key);

create index if not exists idx_body_map_shape_labels_category on body_map_shape_labels(category);
