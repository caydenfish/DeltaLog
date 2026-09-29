import { getPrefs } from "./prefs";
import { getSplits, getSplitExclusions } from "./splits";

// ============================================================================
// Muscle taxonomy: the single source of truth for how any raw muscle tag
// resolves to a display label, a color, and a grouping key.
//
// Replaces lib/muscleNomenclature.js + lib/muscleColors.js (both deleted in
// v1.13.0). Every caller imports from here.
//
// Three tiers. The code keys, the UI labels, and the DB tables line up
// like this, and nowhere else should re-declare this mapping:
//
//   code key     UI label    DB table          example
//   ----------   ---------   ---------------   ---------------------------
//   "generic"    Category    muscle_groups     Chest
//   "detailed"   Region      muscle_detailed   Upper Chest
//   "scientific" Anatomy     muscle_taxonomy   Pectoralis Major, Clavicular
//
// Rules this module guarantees (the old code didn't):
//   1. resolveMuscle() never returns a Category outside CATEGORY_KEYS.
//      The pre-overhaul 14-bucket names (Biceps, Hamstrings, Traps, ...)
//      are folded into their current Category via LEGACY_CATEGORY, so a
//      stale DB value or the offline fallback can't produce a Category
//      with no color and no body-map region.
//   2. Every entry carries its Region key (muscle_detailed.key), so split
//      Region carve-outs (migration_064) can be honored everywhere, not
//      just in ProgramSetup.
//   3. The "key" of a muscle at a given tier is its label at that tier.
//      muscleKey(raw, mode) is the one way to get it.
// ============================================================================

export const NAME_MODES = [
  { key: "generic", label: "Category", example: "Chest" },
  { key: "detailed", label: "Region", example: "Upper Chest" },
  { key: "scientific", label: "Anatomy", example: "Pectoralis Major, Clavicular Head" },
];

export const FULL_BODY = "Full Body";
export const NECK = "Neck";

// Canonical Categories, in display order. `region`/`anatomy` are the
// fallback labels used when a raw value is the Category itself (e.g. an
// exercise's muscle_group) rather than a tagged Region/Anatomy muscle.
export const CATEGORIES = [
  { key: "Chest", color: "#FF6B5E", region: "Chest", anatomy: "Pectoralis Major" },
  { key: "Back", color: "#4E8DE8", region: "Lats", anatomy: "Latissimus Dorsi" },
  { key: "Shoulders", color: "#C77DFF", region: "Front Delts", anatomy: "Anterior Deltoid" },
  { key: "Arms", color: "#5ED1C7", region: "Biceps", anatomy: "Biceps Brachii" },
  { key: "Legs", color: "#3BA55D", region: "Quads", anatomy: "Quadriceps Femoris" },
  { key: "Core", color: "#E8B62E", region: "Abs", anatomy: "Rectus Abdominis" },
  { key: NECK, color: "#D4A574", region: NECK, anatomy: NECK },
  { key: FULL_BODY, color: "#B0B6C1", region: FULL_BODY, anatomy: FULL_BODY },
];

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
const CATEGORY_BY_KEY = new Map(CATEGORIES.map((c) => [c.key, c]));

// Keyed color map, kept as a plain object because callers iterate it.
export const MUSCLE_COLORS = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.color]));
export const UNKNOWN_MUSCLE_COLOR = "#8B919D";

// Categories that are real for coloring and counting but never a
// sensible "target" (generator, weekly goals).
export const NON_TARGET_CATEGORIES = [FULL_BODY, NECK];

// Pre-overhaul bucket names -> current Category. Applied to every
// Category value that flows through this module, DB or fallback.
const LEGACY_CATEGORY = {
  biceps: "Arms", triceps: "Arms", forearms: "Arms",
  quads: "Legs", hamstrings: "Legs", glutes: "Legs", calves: "Legs",
  "rear delts": "Shoulders",
  traps: "Back",
};

export function toCategory(value) {
  if (!value) return value;
  if (CATEGORY_BY_KEY.has(value)) return value;
  const lower = String(value).toLowerCase();
  for (const c of CATEGORY_KEYS) if (c.toLowerCase() === lower) return c;
  return LEGACY_CATEGORY[lower] || null;
}

export function slugifyRegion(label) {
  return String(label || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

// Offline / pre-load fallback. Only used until the DB taxonomy arrives
// (or if that fetch fails). Category values here are already current.
const FALLBACK = {
  "adductor longus": ["Legs", "Adductors", "Hip Adductors"],
  "adductor magnus": ["Legs", "Adductors", "Hip Adductors"],
  "adductor longus/magnus": ["Legs", "Adductors", "Hip Adductors"],
  "adductors": ["Legs", "Adductors", "Hip Adductors"],
  "anterior deltoid": ["Shoulders", "Front Delts", "Anterior Deltoid"],
  "biceps": ["Arms", "Biceps", "Biceps Brachii"],
  "biceps brachii": ["Arms", "Biceps", "Biceps Brachii"],
  "brachialis": ["Arms", "Brachialis", "Brachialis"],
  "calves": ["Legs", "Calves", "Gastrocnemius"],
  "erector spinae": ["Back", "Lower Back", "Erector Spinae"],
  "forearms": ["Arms", "Forearms", "Brachioradialis"],
  "gastrocnemius": ["Legs", "Calves", "Gastrocnemius"],
  "glutes": ["Legs", "Glutes", "Gluteus Maximus"],
  "hamstrings": ["Legs", "Hamstrings", "Biceps Femoris"],
  "hip flexors": ["Legs", "Hip Flexors", "Iliopsoas"],
  "lateral deltoid": ["Shoulders", "Side Delts", "Lateral Deltoid"],
  "latissimus dorsi": ["Back", "Lats", "Latissimus Dorsi"],
  "lats": ["Back", "Lats", "Latissimus Dorsi"],
  "levator scapulae": ["Back", "Traps", "Levator Scapulae"],
  "lower back": ["Back", "Lower Back", "Erector Spinae"],
  "lower chest": ["Chest", "Lower Chest", "Pectoralis Major, Sternal Head"],
  "lower traps": ["Back", "Lower Traps", "Lower Trapezius"],
  "mid traps": ["Back", "Mid Traps", "Middle Trapezius"],
  "obliques": ["Core", "Obliques", "Obliques"],
  "pectoralis major": ["Chest", "Chest", "Pectoralis Major"],
  "quads": ["Legs", "Quads", "Quadriceps Femoris"],
  "rear deltoid": ["Shoulders", "Rear Delts", "Posterior Deltoid"],
  "rectus abdominis": ["Core", "Abs", "Rectus Abdominis"],
  "rhomboids": ["Back", "Upper Back", "Rhomboids"],
  "rotator cuff": ["Shoulders", "Rotator Cuff", "Rotator Cuff"],
  "serratus anterior": ["Chest", "Serratus", "Serratus Anterior"],
  "soleus": ["Legs", "Calves", "Soleus"],
  "tfl": ["Legs", "Hip Abductors", "Tensor Fasciae Latae"],
  "tensor fasciae latae (tfl)": ["Legs", "Hip Abductors", "Tensor Fasciae Latae"],
  "teres major": ["Back", "Lats", "Teres Major"],
  "transverse abdominis": ["Core", "Deep Core", "Transverse Abdominis"],
  "traps": ["Back", "Traps", "Trapezius"],
  "triceps": ["Arms", "Triceps", "Triceps Brachii"],
  "triceps (long head)": ["Arms", "Triceps", "Triceps Brachii (Long Head)"],
  "upper back": ["Back", "Upper Back", "Rhomboids"],
  "upper chest": ["Chest", "Upper Chest", "Pectoralis Major, Clavicular Head"],
  "upper traps": ["Back", "Upper Traps", "Upper Trapezius"],
};

function makeEntry(generic, detailed, scientific, detailedKey) {
  return { generic: toCategory(generic) || generic, detailed, scientific, detailedKey: detailedKey || slugifyRegion(detailed) };
}

const FALLBACK_ENTRIES = new Map(Object.entries(FALLBACK).map(([k, [g, d, s]]) => [k, makeEntry(g, d, s)]));

// ---- DB cache ---------------------------------------------------------------

let dbTaxonomy = null; // Map<lowercased scientific name, entry> once loaded
let taxonomyVersion = 0;
const taxonomyListeners = new Set();

export function setMuscleTaxonomyCache(rows) {
  const map = new Map();
  for (const r of rows || []) {
    if (!r.scientific_name) continue;
    map.set(r.scientific_name.toLowerCase(), makeEntry(r.generic_group, r.detailed_name, r.scientific_name, r.detailed_key));
  }
  dbTaxonomy = map;
  taxonomyVersion++;
  taxonomyListeners.forEach((fn) => fn());
}

// The cache is module state, not React state. Components that render
// muscle labels subscribe and bump a dependency on change, or they'd be
// stuck with whatever the fallback produced before the fetch landed.
export function subscribeTaxonomy(fn) {
  taxonomyListeners.add(fn);
  return () => taxonomyListeners.delete(fn);
}
export function getTaxonomyVersion() {
  return taxonomyVersion;
}

// ---- Resolution -------------------------------------------------------------

export function isFullBody(raw) {
  return typeof raw === "string" && raw.toLowerCase() === "full body";
}

// Filters placeholder values ("None", empty) out of raw muscle lists.
export function isRealMuscle(value) {
  return Boolean(value) && String(value).toLowerCase() !== "none";
}

// Any raw tag -> { generic, detailed, scientific, detailedKey }, or null
// if it's not recognizable at all. Lookup order: DB taxonomy, offline
// fallback, then "the raw value is itself a Category (current or legacy)".
export function resolveMuscle(raw) {
  if (!isRealMuscle(raw)) return null;
  const key = String(raw).toLowerCase();
  if (dbTaxonomy && dbTaxonomy.has(key)) return dbTaxonomy.get(key);
  if (FALLBACK_ENTRIES.has(key)) return FALLBACK_ENTRIES.get(key);
  // Region label typed directly (e.g. "Front Delts")
  for (const e of getDetailedTaxonomyEntries()) {
    if (e.detailed && e.detailed.toLowerCase() === key) return e;
  }
  const cat = toCategory(raw);
  if (cat) {
    const c = CATEGORY_BY_KEY.get(cat);
    return makeEntry(cat, c.region, c.anatomy);
  }
  return null;
}

function resolveMode(mode) {
  if (typeof mode === "boolean") return mode ? "scientific" : "generic";
  return mode === undefined ? getPrefs().muscleNameMode : mode;
}

// The label for a raw tag at a tier. Also the grouping key at that tier:
// counts, filters, and goals are all keyed by this.
export function muscleLabel(raw, mode) {
  if (!raw) return raw;
  const m = resolveMode(mode);
  const e = resolveMuscle(raw);
  if (!e) return raw;
  if (m === "scientific") return e.scientific;
  if (m === "detailed") return e.detailed;
  return e.generic;
}
export const muscleKey = muscleLabel;

export function genericBucket(raw) {
  const e = resolveMuscle(raw);
  return e ? e.generic : raw;
}
export function detailedNameOf(raw) {
  const e = resolveMuscle(raw);
  return e ? e.detailed : raw;
}
export function scientificNameOf(raw) {
  const e = resolveMuscle(raw);
  return e ? e.scientific : raw;
}

export function muscleColor(raw) {
  return MUSCLE_COLORS[genericBucket(raw)] || UNKNOWN_MUSCLE_COLOR;
}

// Raw list -> deduped Category keys, placeholders dropped.
export function normalizeMuscleList(rawList) {
  const out = new Set();
  for (const raw of rawList || []) {
    if (!isRealMuscle(raw)) continue;
    const g = genericBucket(raw);
    if (g) out.add(g);
  }
  return [...out];
}

// ---- Entry lists per tier -----------------------------------------------------

// Every Anatomy entry, deduped by scientific name.
export function getMuscleTaxonomyEntries() {
  const src = dbTaxonomy && dbTaxonomy.size > 0 ? dbTaxonomy : FALLBACK_ENTRIES;
  const seen = new Map();
  for (const e of src.values()) if (!seen.has(e.scientific)) seen.set(e.scientific, e);
  return [...seen.values()];
}

// One entry per Region label.
export function getDetailedTaxonomyEntries() {
  const seen = new Map();
  const src = dbTaxonomy && dbTaxonomy.size > 0 ? dbTaxonomy : FALLBACK_ENTRIES;
  for (const e of src.values()) if (e.detailed && !seen.has(e.detailed)) seen.set(e.detailed, e);
  return [...seen.values()];
}

// Option list for any muscle picker/filter at a tier:
// [{ key, label, color, category, detailedKey }]. `excludeCategories`
// drops whole Categories (e.g. NON_TARGET_CATEGORIES for the generator).
export function muscleOptionsForMode(mode, { excludeCategories = [] } = {}) {
  const m = resolveMode(mode);
  const skip = new Set(excludeCategories);
  if (m === "generic") {
    return CATEGORIES.filter((c) => !skip.has(c.key)).map((c) => ({ key: c.key, label: c.key, color: c.color, category: c.key, detailedKey: null }));
  }
  const entries = m === "detailed" ? getDetailedTaxonomyEntries() : getMuscleTaxonomyEntries();
  return entries
    .filter((e) => !skip.has(e.generic))
    .map((e) => {
      const label = m === "detailed" ? e.detailed : e.scientific;
      return { key: label, label, color: MUSCLE_COLORS[e.generic] || UNKNOWN_MUSCLE_COLOR, category: e.generic, detailedKey: e.detailedKey };
    })
    .sort((a, b) => CATEGORY_KEYS.indexOf(a.category) - CATEGORY_KEYS.indexOf(b.category) || a.label.localeCompare(b.label));
}

// Resolves a stored option key back to {key,label,color} even if it was
// picked under a different tier than the current one.
export function optionForKey(key, mode) {
  const m = resolveMode(mode);
  const e = resolveMuscle(key);
  if (!e) return { key, label: key, color: UNKNOWN_MUSCLE_COLOR };
  const label = CATEGORY_BY_KEY.has(key) ? key : m === "scientific" ? e.scientific : e.detailed;
  return { key, label, color: MUSCLE_COLORS[e.generic] || UNKNOWN_MUSCLE_COLOR };
}

// Expands a list of Categories into option keys at a tier, dropping any
// Region in `excludedRegionKeys` (muscle_detailed keys).
export function expandCategories(categories, mode, excludedRegionKeys = new Set()) {
  const m = resolveMode(mode);
  if (m === "generic") return [...categories];
  return muscleOptionsForMode(m)
    .filter((o) => categories.includes(o.category) && !excludedRegionKeys.has(o.detailedKey))
    .map((o) => o.key);
}

// A named split (Push, Pull, ...) as option keys at a tier, honoring the
// split's Region carve-outs (migration_064). In Category mode carve-outs
// can't apply (Shoulders is one key); they kick in at Region/Anatomy.
export function expandSplit(splitName, mode) {
  const categories = getSplits()[splitName] || [];
  return expandCategories(categories, mode, getSplitExclusions(splitName));
}

// Whether `selected` is exactly the expansion of `splitName`.
export function isSplitActive(splitName, selected, mode) {
  const group = expandSplit(splitName, mode);
  return group.length > 0 && group.length === selected.length && group.every((k) => selected.includes(k));
}

// Weekly Set Goals keys. Category mode: the targetable Categories.
// Region AND Anatomy mode: Region tier (nobody sets a weekly target per
// scientific name, and the body-map art is drawn at Region resolution).
export function getMuscleGroupOptions(mode) {
  const m = mode === "detailed" || mode === "scientific" ? "detailed" : "generic";
  return muscleOptionsForMode(m, { excludeCategories: [FULL_BODY] }).map(({ key, color }) => ({ key, color }));
}
