import { getPrefs } from "./prefs";

// Canonical bucket (the 8 values used for muscle_group / color-coding,
// as of the exercise-library overhaul) -> a representative
// scientific/anatomical name for that bucket. These are fallbacks for
// when a raw generic-bucket value is labeled directly (e.g. the muscle
// breakdown list) rather than through a tagged scientific primary
// muscle — Arms/Legs are composites with no single scientific name, so
// the most common representative muscle is used.
export const SCIENTIFIC_NAMES = {
  Chest: "Pectoralis Major",
  Back: "Latissimus Dorsi",
  Legs: "Quadriceps Femoris",
  Shoulders: "Anterior Deltoid",
  Core: "Rectus Abdominis",
  Arms: "Biceps Brachii",
  "Full Body": "Full Body",
  Neck: "Neck",
};

// Middle ground between the 8 broad buckets and full anatomical Latin —
// the names people actually use at the gym ("Lats", "Front Delts", "Abs")
// without going all the way to "Latissimus Dorsi".
export const DETAILED_NAMES = {
  Chest: "Chest",
  Back: "Lats",
  Legs: "Quads",
  Shoulders: "Front Delts",
  Core: "Abs",
  Arms: "Biceps",
  "Full Body": "Full Body",
  Neck: "Neck",
};

// The exercise library's `secondary_muscles` data is far more granular
// than the 14-bucket taxonomy above — it uses specific anatomical terms
// like "Rear Deltoid", "Levator Scapulae", "Upper Chest", and sometimes
// the scientific name is the raw value itself (e.g. "Latissimus Dorsi").
// This maps every such raw value to { generic, detailed, scientific } so
// all three display modes work correctly no matter which "shape" the
// underlying data happens to be in. Keys are lowercased for
// case-insensitive lookup.
const ALIASES = {
  "adductor longus": { generic: "Legs", detailed: "Adductors", scientific: "Hip Adductors" },
  "adductor magnus": { generic: "Legs", detailed: "Adductors", scientific: "Hip Adductors" },
  "adductor longus/magnus": { generic: "Legs", detailed: "Adductors", scientific: "Hip Adductors" },
  "adductors": { generic: "Legs", detailed: "Adductors", scientific: "Hip Adductors" },
  "anterior deltoid": { generic: "Shoulders", detailed: "Front Delts", scientific: "Anterior Deltoid" },
  "back": { generic: "Back", detailed: "Lats", scientific: "Latissimus Dorsi" },
  "biceps": { generic: "Biceps", detailed: "Biceps", scientific: "Biceps Brachii" },
  "biceps brachii": { generic: "Biceps", detailed: "Biceps", scientific: "Biceps Brachii" },
  "brachialis": { generic: "Biceps", detailed: "Brachialis", scientific: "Brachialis" },
  "calves": { generic: "Calves", detailed: "Calves", scientific: "Gastrocnemius" },
  "core": { generic: "Core", detailed: "Abs", scientific: "Rectus Abdominis" },
  "erector spinae": { generic: "Back", detailed: "Lower Back", scientific: "Erector Spinae" },
  "forearms": { generic: "Forearms", detailed: "Forearms", scientific: "Brachioradialis" },
  "gastrocnemius": { generic: "Calves", detailed: "Calves", scientific: "Gastrocnemius" },
  "glutes": { generic: "Glutes", detailed: "Glutes", scientific: "Gluteus Maximus" },
  "hamstrings": { generic: "Hamstrings", detailed: "Hamstrings", scientific: "Biceps Femoris" },
  "hip flexors": { generic: "Legs", detailed: "Hip Flexors", scientific: "Iliopsoas" },
  "lateral deltoid": { generic: "Shoulders", detailed: "Side Delts", scientific: "Lateral Deltoid" },
  "latissimus dorsi": { generic: "Back", detailed: "Lats", scientific: "Latissimus Dorsi" },
  "lats": { generic: "Back", detailed: "Lats", scientific: "Latissimus Dorsi" },
  "levator scapulae": { generic: "Traps", detailed: "Traps", scientific: "Levator Scapulae" },
  "lower back": { generic: "Back", detailed: "Lower Back", scientific: "Erector Spinae" },
  "lower chest": { generic: "Chest", detailed: "Lower Chest", scientific: "Lower Pectoralis Major" },
  "lower traps": { generic: "Traps", detailed: "Lower Traps", scientific: "Lower Trapezius" },
  "mid traps": { generic: "Traps", detailed: "Mid Traps", scientific: "Middle Trapezius" },
  "obliques": { generic: "Core", detailed: "Obliques", scientific: "Obliques" },
  "pectoralis major": { generic: "Chest", detailed: "Chest", scientific: "Pectoralis Major" },
  "quads": { generic: "Legs", detailed: "Quads", scientific: "Quadriceps Femoris" },
  "rear deltoid": { generic: "Rear Delts", detailed: "Rear Delts", scientific: "Posterior Deltoid" },
  "rectus abdominis": { generic: "Core", detailed: "Abs", scientific: "Rectus Abdominis" },
  "rhomboids": { generic: "Back", detailed: "Upper Back", scientific: "Rhomboids" },
  "rotator cuff": { generic: "Shoulders", detailed: "Rotator Cuff", scientific: "Rotator Cuff" },
  "serratus anterior": { generic: "Chest", detailed: "Serratus", scientific: "Serratus Anterior" },
  "shoulders": { generic: "Shoulders", detailed: "Front Delts", scientific: "Anterior Deltoid" },
  "soleus": { generic: "Calves", detailed: "Soleus", scientific: "Soleus" },
  "tfl": { generic: "Glutes", detailed: "Glute Medius", scientific: "Tensor Fasciae Latae" },
  "tensor fasciae latae (tfl)": { generic: "Glutes", detailed: "Glute Medius", scientific: "Tensor Fasciae Latae" },
  "teres major": { generic: "Back", detailed: "Lats", scientific: "Teres Major" },
  "transverse abdominis": { generic: "Core", detailed: "Deep Core", scientific: "Transverse Abdominis" },
  "traps": { generic: "Traps", detailed: "Traps", scientific: "Trapezius" },
  "triceps": { generic: "Triceps", detailed: "Triceps", scientific: "Triceps Brachii" },
  "triceps (long head)": { generic: "Triceps", detailed: "Triceps", scientific: "Triceps Brachii (Long Head)" },
  "upper back": { generic: "Back", detailed: "Upper Back", scientific: "Latissimus Dorsi" },
  "upper chest": { generic: "Chest", detailed: "Upper Chest", scientific: "Upper Pectoralis Major" },
  "upper traps": { generic: "Traps", detailed: "Upper Traps", scientific: "Upper Trapezius" },
};

// The ALIASES map above is now just the fallback/seed data. The real,
// admin-editable source of truth is the `muscle_taxonomy` table — admin
// tags an exercise's primary/secondary muscles with a scientific name,
// and this cache is what lets every display mode derive from that one
// tag instead of it being set independently per mode. Loaded once near
// app startup (see loadMuscleTaxonomy) and kept in memory since
// muscleLabel/genericBucket are called synchronously all over rendering
// — falls back to ALIASES for anything not yet in the DB, or if the
// fetch hasn't resolved yet.
let dbTaxonomy = null; // null = not loaded; otherwise Map<lowercased scientific name, {generic, detailed, scientific}>

export function setMuscleTaxonomyCache(rows) {
  const map = new Map();
  for (const r of rows || []) {
    map.set(r.scientific_name.toLowerCase(), { generic: r.generic_group, detailed: r.detailed_name, scientific: r.scientific_name });
  }
  dbTaxonomy = map;
}

function lookupMuscle(muscle) {
  const key = muscle.toLowerCase();
  if (dbTaxonomy && dbTaxonomy.has(key)) return dbTaxonomy.get(key);
  return ALIASES[key] || null;
}

// Returns the display label for a muscle value, honoring the muscle-name
// display preference. `mode` is one of "generic" | "detailed" |
// "scientific" — pass it explicitly when the caller already has the pref
// in React state (so it updates live without a remount); omit it to read
// the current app-wide preference directly. A boolean is also accepted
// for backward compatibility with the old scientific/generic-only toggle
// (true -> "scientific", false -> "generic").
export function muscleLabel(muscle, mode) {
  if (!muscle) return muscle;
  let useMode = mode;
  if (typeof useMode === "boolean") useMode = useMode ? "scientific" : "generic";
  if (useMode === undefined) useMode = getPrefs().muscleNameMode;

  const alias = lookupMuscle(muscle);
  if (alias) {
    if (useMode === "scientific") return alias.scientific;
    if (useMode === "detailed") return alias.detailed;
    return alias.generic;
  }

  // Not a granular alias — treat it as one of the 14 canonical buckets.
  if (useMode === "scientific") return SCIENTIFIC_NAMES[muscle] || muscle;
  if (useMode === "detailed") return DETAILED_NAMES[muscle] || muscle;
  return muscle;
}

// Reduces any raw muscle value (canonical bucket or granular alias) down
// to its generic bucket key — used when aggregating volume/set-counts so
// e.g. "Rear Deltoid" and "Posterior Deltoid" both roll up under the same
// "Rear Delts" bucket instead of being treated as separate muscles.
export function genericBucket(muscle) {
  if (!muscle) return muscle;
  const alias = lookupMuscle(muscle);
  return alias ? alias.generic : muscle;
}

// True if a raw secondary-muscle value is a real muscle (filters out
// placeholder values like "None" that show up in the exercise library).
export function isRealMuscle(value) {
  return Boolean(value) && value.toLowerCase() !== "none";
}

// Collapses a raw muscle list (whatever mix of general buckets and
// granular anatomical terms the exercise database happens to use) down to
// deduped generic-bucket keys, dropping placeholder values like "None".
// Used wherever muscles are grouped or counted (volume, set counts), so
// e.g. "Rear Deltoid" and "Shoulders" don't end up as separate rows for
// what's really the same muscle group.
export function normalizeMuscleList(rawList) {
  const out = new Set();
  for (const raw of rawList || []) {
    if (!isRealMuscle(raw)) continue;
    out.add(genericBucket(raw));
  }
  return [...out];
}
