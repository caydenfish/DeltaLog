// Named muscle-group groupings ("splits") used in a few places: the
// workout generator's quick-select, the exercise picker's split filter,
// and the Splits reference screen in the menu. Keeping one definition
// means all three always agree on what "Push" or "Upper" includes.
//
// These must be built from the current 8-value generic taxonomy (see
// muscleColors.js: Arms, Back, Chest, Core, Full Body, Legs, Neck,
// Shoulders) since that's what exercises.muscle_group actually holds
// post-overhaul. This used to reference the old 14-bucket set (Quads,
// Hamstrings, Biceps, Triceps, Forearms, Rear Delts, Traps, etc.), none
// of which exist as real muscle_group values anymore — every exercise
// filtered against those stale names silently matched nothing, while
// the generator's "Available" list (which excludes whatever's already
// in genMuscles) never found a match to exclude either, so all 8 real
// buckets kept showing underneath the dead selection. Note the ceiling
// this puts on precision: with biceps/triceps merged into one "Arms"
// bucket and front/rear delts merged into one "Shoulders" bucket, Push
// and Pull now necessarily overlap on Shoulders and Arms — the library
// doesn't carry enough granularity anymore to split those apart. Legs
// and Lower are likewise identical now, kept as separate buttons for
// familiarity rather than removed.
export const SPLITS = {
  Push: ["Chest", "Shoulders", "Arms"],
  Pull: ["Back", "Shoulders", "Arms"],
  Legs: ["Legs"],
  Upper: ["Chest", "Back", "Shoulders", "Arms"],
  Lower: ["Legs"],
  "Full Body": ["Chest", "Back", "Shoulders", "Legs", "Core", "Arms"],
};
