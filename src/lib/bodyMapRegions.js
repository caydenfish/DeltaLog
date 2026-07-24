// Maps DeltaLog's own "Detailed" tier muscle labels (see the `detailed`
// values in lib/muscleNomenclature.js's ALIASES table, and whatever an
// admin has added to the muscle_detailed table beyond that) onto the
// body-map's anatomical regions (lib/bodyMapData.js). One label can map
// to more than one region (e.g. every Traps variant lights up both the
// front and back trapezius shape, since both exist in the source art),
// and several labels can share one region (e.g. Upper/Mid/Lower Traps
// all collapse onto the single trapezius shape per view -- the art
// doesn't subdivide it further).
//
// The REGION_MAP below is now just the fallback/seed data (same role
// ALIASES plays for the muscle taxonomy) -- the real, admin-editable
// source of truth is the body_map_region_muscles table (migration_070),
// edited via AdminBodyMapRegionEditor.jsx and cached here the same way
// muscleNomenclature.js caches dbTaxonomy: setBodyMapRegionCache loads
// it once near app startup, resolveRegions prefers it when loaded, and
// subscribeBodyMapRegions/getBodyMapRegionVersion let a component force
// a recompute once the real data lands, in case its own boot chain won
// the race and got there first.
//
// Cosmetic body parts in the source art (hands, feet, ankles, knees,
// head, hair) are never real muscles and are deliberately absent here --
// they stay a neutral outline color regardless of training data.
const REGION_MAP = {
  "abs": [{ view: "front", slug: "abs" }],
  "deep core": [{ view: "front", slug: "abs" }],
  "obliques": [{ view: "front", slug: "obliques" }],
  "serratus": [{ view: "front", slug: "obliques" }],
  "chest": [{ view: "front", slug: "chest" }],
  "upper chest": [{ view: "front", slug: "chest" }],
  "lower chest": [{ view: "front", slug: "chest" }],
  "biceps": [{ view: "front", slug: "biceps" }],
  "brachialis": [{ view: "front", slug: "biceps" }],
  "triceps": [{ view: "front", slug: "triceps" }, { view: "back", slug: "triceps" }],
  "forearms": [{ view: "front", slug: "forearm" }, { view: "back", slug: "forearm" }],
  "front delts": [{ view: "front", slug: "deltoids" }],
  "side delts": [{ view: "front", slug: "deltoids" }],
  "rear delts": [{ view: "back", slug: "deltoids" }],
  "rotator cuff": [{ view: "back", slug: "deltoids" }],
  "traps": [{ view: "front", slug: "trapezius" }, { view: "back", slug: "trapezius" }],
  "upper traps": [{ view: "front", slug: "trapezius" }, { view: "back", slug: "trapezius" }],
  "mid traps": [{ view: "front", slug: "trapezius" }, { view: "back", slug: "trapezius" }],
  "lower traps": [{ view: "front", slug: "trapezius" }, { view: "back", slug: "trapezius" }],
  "lats": [{ view: "back", slug: "upper-back" }],
  "upper back": [{ view: "back", slug: "upper-back" }],
  "lower back": [{ view: "back", slug: "lower-back" }],
  "quads": [{ view: "front", slug: "quadriceps" }],
  "hip flexors": [{ view: "front", slug: "quadriceps" }],
  "hamstrings": [{ view: "back", slug: "hamstring" }],
  "adductors": [{ view: "front", slug: "adductors" }, { view: "back", slug: "adductors" }],
  "glutes": [{ view: "back", slug: "gluteal" }],
  "glute medius": [{ view: "back", slug: "gluteal" }],
  "calves": [{ view: "front", slug: "calves" }, { view: "back", slug: "calves" }],
  "soleus": [{ view: "front", slug: "calves" }, { view: "back", slug: "calves" }],
  "neck": [{ view: "front", slug: "neck" }, { view: "back", slug: "neck" }],
};

// Best-effort keyword fallback for any detailed label that's neither in
// the DB table nor the REGION_MAP seed above -- so a brand new taxonomy
// entry an admin hasn't explicitly placed yet still lands somewhere
// sensible instead of silently not rendering.
const KEYWORD_FALLBACKS = [
  [/delt|shoulder/, [{ view: "front", slug: "deltoids" }, { view: "back", slug: "deltoids" }]],
  [/trap/, [{ view: "front", slug: "trapezius" }, { view: "back", slug: "trapezius" }]],
  [/lat|upper back|rhomboid/, [{ view: "back", slug: "upper-back" }]],
  [/lower back|erector|spinae/, [{ view: "back", slug: "lower-back" }]],
  [/quad/, [{ view: "front", slug: "quadriceps" }]],
  [/hamstring/, [{ view: "back", slug: "hamstring" }]],
  [/glute/, [{ view: "back", slug: "gluteal" }]],
  [/calv|soleus|gastro/, [{ view: "front", slug: "calves" }, { view: "back", slug: "calves" }]],
  [/adductor|groin|inner thigh/, [{ view: "front", slug: "adductors" }, { view: "back", slug: "adductors" }]],
  [/tibialis|shin/, [{ view: "front", slug: "tibialis" }]],
  [/bicep/, [{ view: "front", slug: "biceps" }]],
  [/tricep/, [{ view: "front", slug: "triceps" }, { view: "back", slug: "triceps" }]],
  [/forearm|wrist|grip/, [{ view: "front", slug: "forearm" }, { view: "back", slug: "forearm" }]],
  [/oblique|serratus|side/, [{ view: "front", slug: "obliques" }]],
  [/ab|core/, [{ view: "front", slug: "abs" }]],
  [/chest|pec/, [{ view: "front", slug: "chest" }]],
  [/neck/, [{ view: "front", slug: "neck" }, { view: "back", slug: "neck" }]],
];

// null = not loaded yet; otherwise Map<lowercased muscle label, {view,slug}[]>
let dbRegionMap = null;
let regionVersion = 0;
const regionListeners = new Set();

// Called once near app startup (App.jsx, alongside the muscle taxonomy
// fetch) with fetchBodyMapRegionMuscles()'s rows, and again by
// AdminBodyMapRegionEditor.jsx after every edit so changes take effect
// live everywhere instead of needing a reload.
export function setBodyMapRegionCache(rows) {
  const map = new Map();
  for (const r of rows || []) {
    if (!r.muscleLabel) continue;
    const key = r.muscleLabel.toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ view: r.view, slug: r.slug });
  }
  dbRegionMap = map;
  regionVersion++;
  regionListeners.forEach((fn) => fn());
}

// Same race-condition concern as muscleNomenclature.js's taxonomy cache:
// a component that computes region placement before this has loaded
// would otherwise be stuck on the REGION_MAP/KEYWORD_FALLBACKS seed
// forever. Subscribe and bump a dependency (getBodyMapRegionVersion())
// to force a recompute once the real data lands.
export function subscribeBodyMapRegions(fn) {
  regionListeners.add(fn);
  return () => regionListeners.delete(fn);
}

export function getBodyMapRegionVersion() {
  return regionVersion;
}

export function resolveRegions(label) {
  if (!label) return [];
  const key = label.trim().toLowerCase();
  if (dbRegionMap && dbRegionMap.has(key)) return dbRegionMap.get(key);
  if (REGION_MAP[key]) return REGION_MAP[key];
  for (const [pattern, regions] of KEYWORD_FALLBACKS) {
    if (pattern.test(key)) return regions;
  }
  return [];
}
