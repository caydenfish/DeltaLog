// Per-set rep targets ("rep schemes").
//
// A scheme is an array with one { low, high } per working set, e.g. two
// sets of 8-12 then a 15-18 back-off: [{8,12},{8,12},{15,18}]. null means
// "no custom scheme, every set follows the training focus range". Stored
// as rep_scheme jsonb on template_exercises and workout_exercises
// (migration_073).

export const MAX_REPS = 100;

function clampInt(n, lo, hi) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, v));
}

export function cleanRange(r) {
  const low = clampInt(r?.low, 1, MAX_REPS);
  const high = clampInt(r?.high, low, MAX_REPS);
  return { low, high };
}

// DB-safe copy, or null for "no scheme". A scheme where every set equals
// the fallback range is also stored as null, so a template that only
// "looks custom" keeps following the person's training focus if they
// change it later.
export function sanitizeScheme(scheme, fallback) {
  if (!Array.isArray(scheme) || scheme.length === 0) return null;
  const clean = scheme.slice(0, 20).map(cleanRange);
  if (fallback && clean.every((r) => r.low === fallback.low && r.high === fallback.high)) return null;
  return clean;
}

// Resizes a scheme to `planned` sets: extra sets repeat the last entry,
// removed sets drop off the end.
export function resizeScheme(scheme, planned, fallback) {
  if (!Array.isArray(scheme) || scheme.length === 0) return null;
  const out = scheme.slice(0, planned);
  const last = out[out.length - 1] || fallback;
  while (out.length < planned) out.push({ ...last });
  return out;
}

// Rep range for working set `idx` (0-based). Sets past the end of the
// scheme (e.g. an extra set added mid-workout) reuse the last entry.
export function rangeForSet(scheme, idx, fallback) {
  if (!Array.isArray(scheme) || scheme.length === 0) return fallback;
  return scheme[Math.min(idx, scheme.length - 1)] || fallback;
}

export function formatRange(r) {
  return r.low === r.high ? `${r.low}` : `${r.low}-${r.high}`;
}

// "3 × 8-12" or "2 × 8-12 + 1 × 15-18" (runs of equal ranges collapse).
export function summarizeScheme(scheme, planned, fallback) {
  if (!Array.isArray(scheme) || scheme.length === 0) return `${planned} × ${formatRange(fallback)}`;
  const sized = resizeScheme(scheme, planned, fallback);
  const runs = [];
  for (const r of sized) {
    const prev = runs[runs.length - 1];
    if (prev && prev.low === r.low && prev.high === r.high) prev.n++;
    else runs.push({ ...r, n: 1 });
  }
  return runs.map((r) => `${r.n} × ${formatRange(r)}`).join(" + ");
}

// True when set `idx` has a different range than the set before it, i.e.
// it's a back-off / top set transition where today's fatigue matters.
export function isRangeChange(scheme, idx, fallback) {
  if (!Array.isArray(scheme) || idx <= 0) return false;
  const a = rangeForSet(scheme, idx - 1, fallback);
  const b = rangeForSet(scheme, idx, fallback);
  return a.low !== b.low || a.high !== b.high;
}

// One-tap starting points in the editor.
export const SCHEME_PRESETS = [
  {
    key: "straight",
    label: "Straight sets",
    build: (planned, base) => Array.from({ length: planned }, () => ({ ...base })),
  },
  {
    key: "backoff",
    label: "Back-off finisher",
    // Last set trades load for reps: 8-12 becomes a 15-18 finisher.
    build: (planned, base) => Array.from({ length: planned }, (_, i) =>
      i === planned - 1 && planned > 1 ? { low: Math.min(MAX_REPS, base.low + 7), high: Math.min(MAX_REPS, base.high + 6) } : { ...base }),
  },
  {
    key: "topset",
    label: "Top set + back-offs",
    // One heavy set, then the focus range.
    build: (planned, base) => Array.from({ length: planned }, (_, i) =>
      i === 0 && planned > 1 ? { low: Math.max(1, Math.min(5, base.low - 3)), high: Math.max(3, base.low - 2) } : { ...base }),
  },
];
