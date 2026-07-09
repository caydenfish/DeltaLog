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

// One step finer than Detailed but not yet full Latin (e.g. "Triceps
// Long Head" instead of just "Triceps", or "Triceps Brachii (Long
// Head)"). No real subdivisions exist at the bucket level by default —
// this just mirrors Detailed until someone splits a bucket further in
// the admin taxonomy screen.
export const SPECIFIC_NAMES = { ...DETAILED_NAMES };

// The exercise library's `secondary_muscles` data is far more granular
// than the bucket taxonomy above — it uses specific anatomical terms
// like "Rear Deltoid", "Levator Scapulae", "Upper Chest", and sometimes
// the scientific name is the raw value itself (e.g. "Latissimus Dorsi").
// This maps every such raw value to { generic, detailed, specific,
// scientific } so all four display modes work correctly no matter which
// "shape" the underlying data happens to be in. Keys are lowercased for
// case-insensitive lookup. `specific` defaults to the same value as
// `detailed` here since this is just fallback/seed data — real
// subdivisions live in the admin-editable muscle_specific table.
const ALIASES = {
  "adductor longus": { generic: "Legs", detailed: "Adductors", specific: "Adductors", scientific: "Hip Adductors" },
  "adductor magnus": { generic: "Legs", detailed: "Adductors", specific: "Adductors", scientific: "Hip Adductors" },
  "adductor longus/magnus": { generic: "Legs", detailed: "Adductors", specific: "Adductors", scientific: "Hip Adductors" },
  "adductors": { generic: "Legs", detailed: "Adductors", specific: "Adductors", scientific: "Hip Adductors" },
  "anterior deltoid": { generic: "Shoulders", detailed: "Front Delts", specific: "Front Delts", scientific: "Anterior Deltoid" },
  "back": { generic: "Back", detailed: "Lats", specific: "Lats", scientific: "Latissimus Dorsi" },
  "biceps": { generic: "Biceps", detailed: "Biceps", specific: "Biceps", scientific: "Biceps Brachii" },
  "biceps brachii": { generic: "Biceps", detailed: "Biceps", specific: "Biceps", scientific: "Biceps Brachii" },
  "brachialis": { generic: "Biceps", detailed: "Brachialis", specific: "Brachialis", scientific: "Brachialis" },
  "calves": { generic: "Calves", detailed: "Calves", specific: "Calves", scientific: "Gastrocnemius" },
  "core": { generic: "Core", detailed: "Abs", specific: "Abs", scientific: "Rectus Abdominis" },
  "erector spinae": { generic: "Back", detailed: "Lower Back", specific: "Lower Back", scientific: "Erector Spinae" },
  "forearms": { generic: "Forearms", detailed: "Forearms", specific: "Forearms", scientific: "Brachioradialis" },
  "gastrocnemius": { generic: "Calves", detailed: "Calves", specific: "Calves", scientific: "Gastrocnemius" },
  "glutes": { generic: "Glutes", detailed: "Glutes", specific: "Glutes", scientific: "Gluteus Maximus" },
  "hamstrings": { generic: "Hamstrings", detailed: "Hamstrings", specific: "Hamstrings", scientific: "Biceps Femoris" },
  "hip flexors": { generic: "Legs", detailed: "Hip Flexors", specific: "Hip Flexors", scientific: "Iliopsoas" },
  "lateral deltoid": { generic: "Shoulders", detailed: "Side Delts", specific: "Side Delts", scientific: "Lateral Deltoid" },
  "latissimus dorsi": { generic: "Back", detailed: "Lats", specific: "Lats", scientific: "Latissimus Dorsi" },
  "lats": { generic: "Back", detailed: "Lats", specific: "Lats", scientific: "Latissimus Dorsi" },
  "levator scapulae": { generic: "Traps", detailed: "Traps", specific: "Traps", scientific: "Levator Scapulae" },
  "lower back": { generic: "Back", detailed: "Lower Back", specific: "Lower Back", scientific: "Erector Spinae" },
  "lower chest": { generic: "Chest", detailed: "Lower Chest", specific: "Lower Chest", scientific: "Lower Pectoralis Major" },
  "lower traps": { generic: "Traps", detailed: "Lower Traps", specific: "Lower Traps", scientific: "Lower Trapezius" },
  "mid traps": { generic: "Traps", detailed: "Mid Traps", specific: "Mid Traps", scientific: "Middle Trapezius" },
  "obliques": { generic: "Core", detailed: "Obliques", specific: "Obliques", scientific: "Obliques" },
  "pectoralis major": { generic: "Chest", detailed: "Chest", specific: "Chest", scientific: "Pectoralis Major" },
  "quads": { generic: "Legs", detailed: "Quads", specific: "Quads", scientific: "Quadriceps Femoris" },
  "rear deltoid": { generic: "Rear Delts", detailed: "Rear Delts", specific: "Rear Delts", scientific: "Posterior Deltoid" },
  "rectus abdominis": { generic: "Core", detailed: "Abs", specific: "Abs", scientific: "Rectus Abdominis" },
  "rhomboids": { generic: "Back", detailed: "Upper Back", specific: "Upper Back", scientific: "Rhomboids" },
  "rotator cuff": { generic: "Shoulders", detailed: "Rotator Cuff", specific: "Rotator Cuff", scientific: "Rotator Cuff" },
  "serratus anterior": { generic: "Chest", detailed: "Serratus", specific: "Serratus", scientific: "Serratus Anterior" },
  "shoulders": { generic: "Shoulders", detailed: "Front Delts", specific: "Front Delts", scientific: "Anterior Deltoid" },
  "soleus": { generic: "Calves", detailed: "Soleus", specific: "Soleus", scientific: "Soleus" },
  "tfl": { generic: "Glutes", detailed: "Glute Medius", specific: "Glute Medius", scientific: "Tensor Fasciae Latae" },
  "tensor fasciae latae (tfl)": { generic: "Glutes", detailed: "Glute Medius", specific: "Glute Medius", scientific: "Tensor Fasciae Latae" },
  "teres major": { generic: "Back", detailed: "Lats", specific: "Lats", scientific: "Teres Major" },
  "transverse abdominis": { generic: "Core", detailed: "Deep Core", specific: "Deep Core", scientific: "Transverse Abdominis" },
  "traps": { generic: "Traps", detailed: "Traps", specific: "Traps", scientific: "Trapezius" },
  "triceps": { generic: "Triceps", detailed: "Triceps", specific: "Triceps", scientific: "Triceps Brachii" },
  "triceps (long head)": { generic: "Triceps", detailed: "Triceps", specific: "Triceps Long Head", scientific: "Triceps Brachii (Long Head)" },
  "upper back": { generic: "Back", detailed: "Upper Back", specific: "Upper Back", scientific: "Latissimus Dorsi" },
  "upper chest": { generic: "Chest", detailed: "Upper Chest", specific: "Upper Chest", scientific: "Upper Pectoralis Major" },
  "upper traps": { generic: "Traps", detailed: "Upper Traps", specific: "Upper Traps", scientific: "Upper Trapezius" },
};

// The ALIASES map above is now just the fallback/seed data. The real,
// admin-editable source of truth is the `muscle_taxonomy` table (and
// its muscle_specific/muscle_detailed/muscle_groups parents) — admin
// tags an exercise's primary/secondary muscles with a scientific name,
// and this cache is what lets every display mode derive from that one
// tag instead of it being set independently per mode. Loaded once near
// app startup and kept in memory since muscleLabel/genericBucket are
// called synchronously all over rendering — falls back to ALIASES for
// anything not yet in the DB, or if the fetch hasn't resolved yet.
let dbTaxonomy = null; // null = not loaded; otherwise Map<lowercased scientific name, {generic, detailed, specific, scientific}>
let taxonomyVersion = 0;
const taxonomyListeners = new Set();

export function setMuscleTaxonomyCache(rows) {
  const map = new Map();
  for (const r of rows || []) {
    map.set(r.scientific_name.toLowerCase(), {
      generic: r.generic_group,
      detailed: r.detailed_name,
      specific: r.specific_name,
      scientific: r.scientific_name,
    });
  }
  dbTaxonomy = map;
  taxonomyVersion++;
  taxonomyListeners.forEach((fn) => fn());
}

// The taxonomy cache is plain module state, not React state, so a
// component that memoizes a muscle-label computation before the cache
// has loaded (a real race at app boot -- the taxonomy fetch and the
// session/profile chain both start immediately, and either can win)
// would otherwise be stuck showing whatever it computed with the
// ALIASES fallback forever, since nothing tells it to recompute once
// the real data arrives. Subscribe to this and bump a dependency (e.g.
// via getTaxonomyVersion()) to fix that.
export function subscribeTaxonomy(fn) {
  taxonomyListeners.add(fn);
  return () => taxonomyListeners.delete(fn);
}

export function getTaxonomyVersion() {
  return taxonomyVersion;
}

function lookupMuscle(muscle) {
  const key = muscle.toLowerCase();
  if (dbTaxonomy && dbTaxonomy.has(key)) return dbTaxonomy.get(key);
  return ALIASES[key] || null;
}

// Returns the display label for a muscle value, honoring the muscle-name
// display preference. `mode` is one of "generic" | "detailed" |
// "specific" | "scientific" — pass it explicitly when the caller already
// has the pref in React state (so it updates live without a remount);
// omit it to read the current app-wide preference directly. A boolean is
// also accepted for backward compatibility with the old scientific/
// generic-only toggle (true -> "scientific", false -> "generic").
export function muscleLabel(muscle, mode) {
  if (!muscle) return muscle;
  let useMode = mode;
  if (typeof useMode === "boolean") useMode = useMode ? "scientific" : "generic";
  if (useMode === undefined) useMode = getPrefs().muscleNameMode;

  const alias = lookupMuscle(muscle);
  if (alias) {
    if (useMode === "scientific") return alias.scientific;
    if (useMode === "specific") return alias.specific || alias.detailed;
    if (useMode === "detailed") return alias.detailed;
    return alias.generic;
  }

  // Not a granular alias — treat it as one of the canonical buckets.
  if (useMode === "scientific") return SCIENTIFIC_NAMES[muscle] || muscle;
  if (useMode === "specific") return SPECIFIC_NAMES[muscle] || muscle;
  if (useMode === "detailed") return DETAILED_NAMES[muscle] || muscle;
  return muscle;
}

// Full set of granular muscle entries ({generic, detailed, specific,
// scientific}), deduped by scientific name — for contexts that need the
// actual granular vocabulary (e.g. the workout generator's target-muscle
// picker in Specific/Scientific mode), not just the canonical buckets
// relabeled. Falls back to ALIASES (deduped the same way) if the DB
// taxonomy hasn't loaded yet.
export function getMuscleTaxonomyEntries() {
  if (dbTaxonomy && dbTaxonomy.size > 0) return [...dbTaxonomy.values()];
  const seen = new Map();
  for (const entry of Object.values(ALIASES)) {
    if (!seen.has(entry.scientific)) seen.set(entry.scientific, entry);
  }
  return [...seen.values()];
}

// Resolves any raw muscle tag (whichever vocabulary it happens to be in —
// current DB taxonomy scientific_name, a legacy ALIASES key, or an
// already-scientific string) to its canonical scientific name. Used for
// granular matching (e.g. the generator's Specific/Scientific picker)
// where a raw primary/secondary muscle tag needs to be compared against
// a selected taxonomy entry regardless of which vocabulary tagged it.
export function scientificNameOf(raw) {
  if (!raw) return raw;
  const alias = lookupMuscle(raw);
  return alias ? alias.scientific : raw;
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
