// Every weight value in the database (sets.weight, exercises.target_weight)
// is stored canonically in lb, regardless of what unit the user has
// selected. The `units` preference only controls how numbers are shown
// and how typed input is interpreted — convert at both boundaries so
// switching units updates every weight in the app immediately,
// including historical data, without needing to touch a single stored
// row.
const LB_PER_KG = 2.2046226218;

export function lbToKg(lb) {
  return lb / LB_PER_KG;
}

export function kgToLb(kg) {
  return kg * LB_PER_KG;
}

// Canonical (lb, as stored) -> whatever unit the user has selected.
// Rounded at this single conversion boundary (one decimal, plus
// quarter-kg values -- see roundDisplay below) rather than left at full float
// precision, since LB_PER_KG is irrational and every unrounded kg
// conversion was surfacing long decimal tails (e.g. 61.68539...) any
// place this ran through a plain toDisplay call instead of the
// formatWeight helper. Rounding once here means every call site gets a
// realistic, loadable-looking number automatically, including the ones
// that were displaying or persisting the raw conversion directly.
export function toDisplay(lbValue, unit) {
  if (lbValue == null || isNaN(lbValue)) return lbValue;
  const raw = unit === "kg" ? lbToKg(lbValue) : lbValue;
  return roundDisplay(raw, unit);
}

// Typed/display value (in `unit`) -> canonical lb, for writing to the database.
export function toCanonical(displayValue, unit) {
  if (displayValue == null || isNaN(displayValue)) return displayValue;
  return unit === "kg" ? kgToLb(displayValue) : displayValue;
}

// Rounds a display-unit weight to at most one decimal, so half-step
// loads (72.5 lb on a 2.5 lb machine) survive the round trip instead of
// snapping to a whole number. kg additionally keeps quarter values
// (31.25, 31.75) intact when the stored value sits on that grid, since
// 1.25 kg is the kg equivalent of a 2.5 lb step and those loads would
// otherwise display as an unloadable 31.3. Anything else (a plain unit
// conversion like 72.5 lb -> 32.886 kg) still lands on one decimal.
export function roundDisplay(value, unit) {
  if (value == null || isNaN(value)) return value;
  if (unit === "kg") {
    const quarter = Math.round(value * 4) / 4;
    if (Math.abs(value - quarter) < 0.02) return quarter;
  }
  return Math.round(value * 10) / 10;
}

// Converts a canonical lb value straight to a rounded display value.
export function formatWeight(lbValue, unit) {
  return roundDisplay(toDisplay(lbValue, unit), unit);
}

// ---------- Loading increments ----------
// Default step targets/warmups round to (5 lb / 2.5 kg), and the finer
// half step (2.5 lb / 1.25 kg) used once the user shows they have it.
// The app never assumes a machine has half steps; it switches only when
// a logged working weight for that exercise sits on the half-step grid
// but off the default grid (e.g. 72.5 lb, 31.25 kg).
export const WEIGHT_STEP = { lb: 5, kg: 2.5 };
export const FINE_WEIGHT_STEP = { lb: 2.5, kg: 1.25 };

function onGrid(w, step) {
  return Math.abs(w - Math.round(w / step) * step) < 0.03;
}

export function weightStepFor(unit, weights = []) {
  const base = WEIGHT_STEP[unit] || 5;
  const fine = FINE_WEIGHT_STEP[unit] || 2.5;
  const usesFine = weights.some((w) => w > 0 && !onGrid(w, base) && onGrid(w, fine));
  return usesFine ? fine : base;
}

export function isFineStep(step, unit) {
  return step === FINE_WEIGHT_STEP[unit];
}

// Rounds to the nearest multiple of step, cleaned of float tails.
export function roundToStep(weight, step) {
  return Math.round(Math.round(weight / step) * step * 100) / 100;
}

// ---------- Plates ----------
// Two independent plate sets so switching units swaps the whole plate
// calculator, not just the label. The kg set mirrors standard
// competition bumper colors; 25 kg is the metric equivalent of a 55 lb
// bumper (used by the same "does your gym have big bumpers" preference).
export const PLATES_LB = [
  { value: 55, color: "#C8352B", h: 96, w: 16, dark: false },
  { value: 45, color: "#2E5BE8", h: 92, w: 15, dark: false },
  { value: 35, color: "#E8B62E", h: 82, w: 14, dark: false },
  { value: 25, color: "#3BA55D", h: 72, w: 13, dark: false },
  { value: 10, color: "#1C1F24", h: 54, w: 10, dark: true },
  { value: 5, color: "#1C1F24", h: 42, w: 8, dark: true },
  { value: 2.5, color: "#1C1F24", h: 32, w: 7, dark: true },
];

export const PLATES_KG = [
  { value: 25, color: "#C8352B", h: 96, w: 16, dark: false },
  { value: 20, color: "#2E5BE8", h: 92, w: 15, dark: false },
  { value: 15, color: "#E8B62E", h: 82, w: 14, dark: false },
  { value: 10, color: "#3BA55D", h: 72, w: 13, dark: false },
  { value: 5, color: "#F2F1EC", h: 54, w: 10, dark: false },
  { value: 2.5, color: "#1C1F24", h: 42, w: 8, dark: true },
  { value: 1.25, color: "#1C1F24", h: 32, w: 7, dark: true },
];

// The plate that represents "the big bumper" for each unit — used by the
// muscle-group-scoped availability preference (see bigPlateAllowed below).
export const BIG_PLATE = { lb: 55, kg: 25 };

// Standard bar weight presets per unit, shown as quick-pick buttons in
// the plate calculator's "starting weight" row.
export const BAR_PRESETS = { lb: [45, 35, 0], kg: [20, 15, 0] };

export function platesFor(unit) {
  return unit === "kg" ? PLATES_KG : PLATES_LB;
}

export function plateByValue(unit, value) {
  return platesFor(unit).find((p) => p.value === value);
}

// Muscle groups where a "big bumper" plate (55 lb / 25 kg) realistically
// shows up — legs and full-body lifts (squats, deadlifts, hip thrusts),
// the exercises gyms actually rack bumpers for. Everything else stays
// capped at the next size down unless the "All lifts" scope is chosen.
export const BIG_PLATE_MUSCLE_GROUPS = ["Legs", "Full Body"];

// scope: "off" (never offer the big plate), "lower" (only for Legs/Full
// Body exercises), "all" (offer it everywhere, old behavior).
export function bigPlateAllowed(scope, muscleGroup) {
  if (scope === "all") return true;
  if (scope === "lower") return BIG_PLATE_MUSCLE_GROUPS.includes(muscleGroup);
  return false;
}
