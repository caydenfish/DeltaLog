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

// Best-effort keyword fallback for any detailed label an admin adds
// later that isn't in the table above -- so a brand new taxonomy entry
// still lands somewhere sensible instead of silently not rendering.
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

export function resolveRegions(label) {
  if (!label) return [];
  const key = label.trim().toLowerCase();
  if (REGION_MAP[key]) return REGION_MAP[key];
  for (const [pattern, regions] of KEYWORD_FALLBACKS) {
    if (pattern.test(key)) return regions;
  }
  return [];
}
