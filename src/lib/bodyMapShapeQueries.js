import { supabase } from "./supabaseClient";

// The 8 broad categories (Chest/Back/Legs/etc) for Category-mode labeling.
// Reads the canonical muscle_groups table directly (not the "distinct
// values actually used on exercises" helper in queries.js) since a
// category needs to be selectable here even if no exercise currently
// references it.
export async function fetchMuscleGroupsList() {
  const { data, error } = await supabase.from("muscle_groups").select("key, label").order("label");
  if (error) throw error;
  return data;
}

// All label rows for one view, as { [shape_id]: { muscleKey, category, excluded } }.
export async function fetchBodyMapShapeLabels(view) {
  const { data, error } = await supabase
    .from("body_map_shape_labels")
    .select("shape_id, muscle_key, category, excluded")
    .eq("view", view);
  if (error) throw error;
  const byId = {};
  for (const row of data) {
    byId[row.shape_id] = { muscleKey: row.muscle_key, category: row.category, excluded: row.excluded };
  }
  return byId;
}

async function upsertRow(view, shapeId, patch) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("body_map_shape_labels").upsert(
    { view, shape_id: shapeId, updated_at: new Date().toISOString(), updated_by: user?.id ?? null, ...patch },
    { onConflict: "view,shape_id" }
  );
  if (error) throw error;
}

// Region-tier assignment (writes muscle_key, doesn't touch category).
export async function upsertBodyMapShapeLabel(view, shapeId, muscleKey) {
  await upsertRow(view, shapeId, { muscle_key: muscleKey, excluded: false });
}

// Category-tier assignment (writes category, doesn't touch muscle_key).
export async function upsertBodyMapShapeCategory(view, shapeId, category) {
  await upsertRow(view, shapeId, { category, excluded: false });
}

// Mark a shape as confirmed non-muscle (hand/foot/head/hair detail).
export async function excludeBodyMapShape(view, shapeId) {
  await upsertRow(view, shapeId, { muscle_key: null, category: null, excluded: true });
}

// Clear a shape back to "not yet reviewed" entirely.
export async function clearBodyMapShapeLabel(view, shapeId) {
  const { error } = await supabase
    .from("body_map_shape_labels")
    .delete()
    .eq("view", view)
    .eq("shape_id", shapeId);
  if (error) throw error;
}
