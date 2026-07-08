// Named muscle-group groupings ("splits") used in a few places: the
// workout generator's quick-select, the exercise picker's split filter,
// and the Split entry in FAQ & Glossary. Keeping one definition means
// all three always agree on what "Push" or "Upper" includes.
//
// This used to be a static exported constant. It's now admin-editable
// (migration_043: `splits` + `split_muscles` tables), so it works the
// same way the muscle taxonomy cache in muscleNomenclature.js does: a
// module-level cache populated once near app startup (see the
// fetchSplits().then(setSplitsCache) call in App.jsx) and read
// synchronously everywhere else via getSplits(), since SPLITS is read
// synchronously in render code all over the app and can't be a
// per-component fetch. Falls back to these defaults (the last
// hand-maintained values, matching the current 8-bucket generic
// taxonomy) until the cache has loaded.
const DEFAULT_SPLITS = {
  Push: ["Chest", "Shoulders", "Arms"],
  Pull: ["Back", "Shoulders", "Arms"],
  Legs: ["Legs"],
  Upper: ["Chest", "Back", "Shoulders", "Arms"],
  Lower: ["Legs"],
  "Full Body": ["Chest", "Back", "Shoulders", "Legs", "Core", "Arms"],
};

let cache = null; // null = not loaded yet -> callers fall back to DEFAULT_SPLITS

export function setSplitsCache(rows) {
  const built = {};
  for (const row of rows) built[row.name] = row.muscles;
  cache = built;
}

// The {name: [muscle, ...]} shape every call site needs. Call this
// instead of importing a static SPLITS constant, so admin edits are
// reflected immediately (next render) rather than requiring a rebuild.
export function getSplits() {
  return cache || DEFAULT_SPLITS;
}
