import { toLocalDateStr } from "./time";

// ============================================================================
// Training load: a lifting-specific take on the acute:chronic load model
// endurance watches use (Coros, Garmin). There's no heart rate here, so
// load is built from what's actually logged per working set:
//
//   set load = 10 x effort(RIR) x (0.5 + 0.5 x relative intensity)
//
//   effort(RIR):        how close to failure. RIR 0 = 1.0, RIR 2 = 0.85,
//                       RIR 4 = 0.55, 5+ = 0.4, not logged = 0.8.
//   relative intensity: weight / your best estimated 1RM on that exercise
//                       (clamped 0.3-1.0). Bodyweight work counts as 0.6.
//
// So a hard, heavy set scores ~9-10 and an easy, light one ~3-4. Warmups
// don't count.
//
// Acute load  = total over the last 7 days (today included).
// Base        = average weekly load over the last 28 days.
// Ratio       = acute / base, which drives the gauge zone. Needs at least
//               14 days of history; before that the card shows the 7-day
//               number while the base builds.
// ============================================================================

export const LOAD_ZONES = [
  { key: "low", label: "Low", max: 0.8, color: "#4E8DE8", copy: "Lighter than your usual week. Fine for a deload; if it's not planned, there's room to push." },
  { key: "optimal", label: "Optimal", max: 1.3, color: "#3BA55D", copy: "In line with what you've been building. Sustainable progress territory." },
  { key: "high", label: "High", max: 1.5, color: "#E8B62E", copy: "Noticeably above your base. Productive short-term, but watch recovery." },
  { key: "veryHigh", label: "Very high", max: Infinity, color: "#E8442E", copy: "Well above what you're used to. Spikes like this are when fatigue and injuries pile up." },
];

export const GAUGE_MAX_RATIO = 2;

export function zoneFor(ratio) {
  return LOAD_ZONES.find((z) => ratio < z.max) || LOAD_ZONES[LOAD_ZONES.length - 1];
}

function effort(rir) {
  if (rir == null || Number.isNaN(Number(rir))) return 0.8;
  const r = Number(rir);
  if (r <= 0) return 1;
  if (r === 1) return 0.95;
  if (r === 2) return 0.85;
  if (r === 3) return 0.7;
  if (r === 4) return 0.55;
  return 0.4;
}

function e1RM(weight, reps, rir) {
  const eff = (reps || 0) + (rir == null ? 2 : Number(rir));
  if (eff <= 0 || weight <= 0) return 0;
  if (eff === 1) return weight;
  if (eff <= 6) return weight / (1.0278 - 0.0278 * eff);
  return weight * (1 + eff / 30);
}

export function setLoad(set, bestE1RM) {
  const w = Number(set.weight) || 0;
  const rel = w > 0 && bestE1RM > 0 ? Math.min(1, Math.max(0.3, w / bestE1RM)) : 0.6;
  return 10 * effort(set.rir) * (0.5 + 0.5 * rel);
}

// history: fetchWorkoutHistory rows (workouts -> workout_exercises -> sets).
export function computeTrainingLoad(history, now = new Date()) {
  const workouts = (history || []).filter((w) => w.completed_at);
  const best = new Map();
  for (const w of workouts) {
    for (const we of w.workout_exercises || []) {
      for (const s of we.sets || []) {
        if (s.is_warmup) continue;
        const e = e1RM(Number(s.weight) || 0, s.reps, s.rir);
        if (e > (best.get(we.exercise_id) || 0)) best.set(we.exercise_id, e);
      }
    }
  }

  const byDate = {};
  let firstDate = null;
  for (const w of workouts) {
    const date = toLocalDateStr(w.completed_at);
    if (!firstDate || date < firstDate) firstDate = date;
    let load = 0;
    for (const we of w.workout_exercises || []) {
      const b = best.get(we.exercise_id) || 0;
      for (const s of we.sets || []) if (!s.is_warmup) load += setLoad(s, b);
    }
    byDate[date] = (byDate[date] || 0) + load;
  }

  const day = (offset) => {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - offset);
    return d;
  };
  const sumRange = (from, to) => {
    let t = 0;
    for (let i = from; i <= to; i++) t += byDate[toLocalDateStr(day(i))] || 0;
    return t;
  };

  const acute = sumRange(0, 6);
  const previousWeek = sumRange(7, 13);
  const base = sumRange(0, 27) / 4;
  const todayStr = toLocalDateStr(day(0));
  const historyDays = firstDate ? Math.round((new Date(`${todayStr}T12:00:00`) - new Date(`${firstDate}T12:00:00`)) / 86400000) + 1 : 0;
  const baselineReady = historyDays >= 14 && base > 0;
  const ratio = baselineReady ? acute / base : null;

  const last7 = Array.from({ length: 7 }, (_, k) => {
    const d = day(6 - k);
    const date = toLocalDateStr(d);
    return { date, load: Math.round(byDate[date] || 0), weekday: d.toLocaleDateString(undefined, { weekday: "narrow" }), isToday: k === 6 };
  });

  return {
    acute: Math.round(acute),
    base: Math.round(base),
    previousWeek: Math.round(previousWeek),
    ratio,
    zone: ratio == null ? null : zoneFor(ratio),
    baselineReady,
    daysUntilBaseline: Math.max(0, 14 - historyDays),
    last7,
  };
}
