// Warmup set weight prescriptions: what % of the top (working) set each
// warmup set should load, scaled by how many warmup sets are planned.
//
// The default ramps below follow standard progressive warmup practice
// used in strength & conditioning coaching (see Baechle & Earle,
// "Essentials of Strength Training and Conditioning," NSCA -- warmup
// sets ramping from roughly 40-50% up toward ~90% of the working
// weight in a handful of jumps) and match the shape of widely-used
// warmup calculators (e.g. Candito's linear warmup scheme): fewer,
// bigger jumps early while the weight is still light, smaller jumps
// as it gets close to the top set, since the last warmup before a
// heavy working set should feel close to it without pre-fatiguing.
//
// Keyed by number of planned warmup sets (1-6, the max the app allows
// per exercise -- see the +/- stepper in SetLogger). Values are whole
// percentages of the upcoming top set's weight, in order (first warmup
// first). These are only the *defaults* -- getWarmupPercents() below
// prefers a user's own saved scheme for that count, if they've
// customized it in Settings.
export const DEFAULT_WARMUP_SCHEMES = {
  1: [50],
  2: [50, 75],
  3: [40, 60, 80],
  4: [30, 50, 70, 85],
  5: [30, 45, 60, 75, 88],
  6: [25, 40, 55, 68, 80, 90],
};

// Falls back to a smooth interpolation (40% -> 90%) for any count
// outside the curated table above, so nothing breaks if that ever
// changes -- not expected to trigger today since 6 is the app's max.
export function defaultWarmupPercents(n) {
  if (!n || n <= 0) return [];
  if (DEFAULT_WARMUP_SCHEMES[n]) return DEFAULT_WARMUP_SCHEMES[n];
  if (n === 1) return [50];
  const start = 40, end = 90;
  const step = (end - start) / (n - 1);
  return Array.from({ length: n }, (_, i) => Math.round(start + step * i));
}

// A user's saved scheme for this warmup count, falling back to the
// recommended default for any count (or any individual set within a
// count) they haven't customized -- so partially-edited schemes still
// have sane values for the sets left untouched.
export function getWarmupPercents(n, savedSchemes) {
  const defaults = defaultWarmupPercents(n);
  const saved = savedSchemes && savedSchemes[n];
  if (!Array.isArray(saved)) return defaults;
  return defaults.map((d, i) => (typeof saved[i] === "number" ? saved[i] : d));
}

// The weight for one specific warmup set: `index` is 0-based position
// among this exercise's warmup sets (0 = first warmup), `n` is the
// total planned warmup sets, `topWeight` is the display-unit weight of
// the upcoming top/working set. Rounded to the nearest loadable
// increment for the unit (same 5 lb / 2.5 kg step used for working
// weight elsewhere) rather than the exact percentage, since a warmup
// weight nobody can actually load onto a bar isn't useful.
export function warmupWeightFor(topWeight, n, index, unit, savedSchemes) {
  const percents = getWarmupPercents(n, savedSchemes);
  const percent = (percents[index] ?? percents[percents.length - 1] ?? 50) / 100;
  const step = unit === "kg" ? 2.5 : 5;
  const raw = (topWeight || 0) * percent;
  return Math.max(0, Math.round(raw / step) * step);
}
