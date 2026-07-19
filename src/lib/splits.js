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
  Push: ["Chest", "Shoulders", "Arms", "Core"],
  Pull: ["Back", "Shoulders", "Arms", "Core"],
  Legs: ["Legs", "Core"],
  Upper: ["Chest", "Back", "Shoulders", "Arms"],
  Lower: ["Legs", "Core"],
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

// Region-tier (muscle_detailed) carve-outs (migration_064): a split can
// include a Category (e.g. "Shoulders") while excluding specific Regions
// within it that actually belong to the other side of the movement
// pattern (e.g. Rear Delts, which is a pull muscle sharing a Category
// with Front/Side Delts). Keeps the last hand-maintained mapping as a
// fallback the same way DEFAULT_SPLITS does, using the plain-slug keys
// those labels would produce -- only used before the cache has loaded.
const DEFAULT_SPLIT_EXCLUSIONS = {
  Push: ["rear_delts", "biceps", "brachialis", "forearm_flexors"],
  Pull: ["front_delts", "side_delts", "triceps", "forearm_extensors"],
};

let exclusionCache = null; // null = not loaded yet -> callers fall back to DEFAULT_SPLIT_EXCLUSIONS

export function setSplitExclusionsCache(rows) {
  const built = {};
  for (const row of rows) {
    if (!row.splitName) continue;
    if (!built[row.splitName]) built[row.splitName] = new Set();
    built[row.splitName].add(row.key);
  }
  exclusionCache = built;
}

// Region-tier keys that should be filtered back OUT of an otherwise-
// included Category for this split. Always returns a Set (empty if
// nothing's excluded), never undefined.
export function getSplitExclusions(splitName) {
  if (exclusionCache) return exclusionCache[splitName] || new Set();
  return new Set(DEFAULT_SPLIT_EXCLUSIONS[splitName] || []);
}
