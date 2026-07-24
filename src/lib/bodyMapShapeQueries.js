import { supabase } from "./supabaseClient";

// All label rows for one view, as { [shape_id]: { muscleKey, excluded } }.
export async function fetchBodyMapShapeLabels(view) {
  const { data, error } = await supabase
    .from("body_map_shape_labels")
    .select("shape_id, muscle_key, excluded")
    .eq("view", view);
  if (error) throw error;
  const byId = {};
  for (const row of data) {
    byId[row.shape_id] = { muscleKey: row.muscle_key, excluded: row.excluded };
  }
  return byId;
}

// Assign (or clear, if muscleKey is null) a muscle label for one shape.
export async function upsertBodyMapShapeLabel(view, shapeId, muscleKey) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("body_map_shape_labels").upsert(
    {
      view,
      shape_id: shapeId,
      muscle_key: muscleKey,
      excluded: false,
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    },
    { onConflict: "view,shape_id" }
  );
  if (error) throw error;
}

// Mark a shape as confirmed non-muscle (hand/foot/head/hair detail).
export async function excludeBodyMapShape(view, shapeId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("body_map_shape_labels").upsert(
    {
      view,
      shape_id: shapeId,
      muscle_key: null,
      excluded: true,
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    },
    { onConflict: "view,shape_id" }
  );
  if (error) throw error;
}

// Clear a shape back to "not yet reviewed".
export async function clearBodyMapShapeLabel(view, shapeId) {
  const { error } = await supabase
    .from("body_map_shape_labels")
    .delete()
    .eq("view", view)
    .eq("shape_id", shapeId);
  if (error) throw error;
}
