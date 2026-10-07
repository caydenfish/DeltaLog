// Derived context for the "Save as image" export (ExportWorkoutModal).
// Everything here is pure: it takes the workout being exported (already
// in display units, the same snapshot shape the modal renders) plus the
// user's raw completed-workout history (canonical lb, the
// fetchWorkoutHistory row shape) and returns PRs, last-session deltas,
// a comparable earlier workout, month totals and the streak as of that
// workout's date. History is filtered to workouts completed BEFORE the
// exported one, so exporting an old workout from History judges PRs the
// way they stood on that day, not against sessions that came after it.
import { toDisplay } from "./weight";
import { e1RM } from "./programEngine";
import { toLocalDateStr } from "./time";

const EPS = { weight: 0.05, e1rm: 0.5, volume: 0.5 };
const TYPE_ORDER = ["weight", "e1rm", "volume"];
export const PR_LABEL = { weight: "Weight PR", e1rm: "e1RM PR", volume: "Volume PR" };

function working(sets) {
  return (sets || []).filter((s) => !(s.isWarmup || s.is_warmup) && (s.reps || 0) > 0);
}

function setE1RM(s) {
  return e1RM(Number(s.weight) || 0, s.reps || 0, s.rir ?? 2);
}

function emptyBase() {
  return { maxWeight: 0, maxE1RM: 0, maxSetVolume: 0, seen: false };
}

function absorb(base, sets) {
  for (const s of sets) {
    const w = Number(s.weight) || 0;
    base.seen = true;
    base.maxWeight = Math.max(base.maxWeight, w);
    base.maxE1RM = Math.max(base.maxE1RM, setE1RM(s));
    base.maxSetVolume = Math.max(base.maxSetVolume, w * (s.reps || 0));
  }
}

// PRs for one exercise's working sets against a baseline. Only fires
// once the exercise has prior history, matching the post-workout PR card.
function prsFor(sets, base) {
  if (!base || !base.seen || sets.length === 0) return { prs: [], setFlags: sets.map(() => false) };
  const best = { weight: null, e1rm: null, volume: null };
  const setFlags = sets.map((s, i) => {
    const w = Number(s.weight) || 0;
    const vals = { weight: w, e1rm: setE1RM(s), volume: w * (s.reps || 0) };
    const prev = { weight: base.maxWeight, e1rm: base.maxE1RM, volume: base.maxSetVolume };
    let hit = false;
    for (const t of TYPE_ORDER) {
      if (vals[t] > prev[t] + EPS[t]) {
        hit = true;
        if (!best[t] || vals[t] > best[t].value) best[t] = { type: t, value: vals[t], previous: prev[t], setIndex: i };
      }
    }
    return hit;
  });
  return { prs: TYPE_ORDER.map((t) => best[t]).filter(Boolean), setFlags };
}

function topSet(sets) {
  return sets.reduce((b, s) => {
    if (!b) return s;
    const w = Number(s.weight) || 0, bw = Number(b.weight) || 0;
    return w > bw || (w === bw && (s.reps || 0) > (b.reps || 0)) ? s : b;
  }, null);
}

function displaySets(we, unit) {
  return working(we.sets).map((s) => ({ weight: toDisplay(Number(s.weight), unit), reps: s.reps, rir: s.rir }));
}

function workoutTotals(w, unit) {
  let volume = 0, sets = 0;
  for (const we of w.workout_exercises || []) {
    for (const s of displaySets(we, unit)) { volume += s.weight * s.reps; sets++; }
  }
  const duration = w.started_at && w.completed_at ? Math.max(1, Math.round((new Date(w.completed_at) - new Date(w.started_at)) / 60000)) : null;
  return { volume: Math.round(volume), sets, duration };
}

const dayMs = 86400000;
const dayDate = (s) => new Date(`${s}T00:00:00`);

export function buildExportStats({ data, history }) {
  const unit = data.unit;
  const completedAt = data.completedAt ? new Date(data.completedAt) : new Date();
  const prior = (history || [])
    .filter((w) => w.id !== data.workoutId && w.completed_at && new Date(w.completed_at) < completedAt)
    .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));

  // Running baselines, chronologically, so every prior workout in the
  // month can also be scored for PRs (month PR count) in the same pass.
  const bases = {};
  const prCountByWorkout = {};
  for (const w of prior) {
    let n = 0;
    for (const we of w.workout_exercises || []) {
      const sets = displaySets(we, unit);
      if (sets.length === 0) continue;
      const base = bases[we.exercise_id] || (bases[we.exercise_id] = emptyBase());
      if (prsFor(sets, base).prs.length > 0) n++;
      absorb(base, sets);
    }
    prCountByWorkout[w.id] = n;
  }

  // Per exercise: PRs, set flags, last session top set.
  const exercises = (data.exercises || []).map((ex) => {
    const sets = ex.sets || [];
    const workIdx = [];
    sets.forEach((s, i) => { if (!s.isWarmup && (s.reps || 0) > 0) workIdx.push(i); });
    const workSets = workIdx.map((i) => sets[i]);
    const { prs, setFlags } = prsFor(workSets, bases[ex.exerciseId]);
    const prSetIndexes = new Set(workIdx.filter((_, k) => setFlags[k]));
    const prsWithIdx = prs.map((p) => ({ ...p, setIndex: workIdx[p.setIndex] }));

    let last = null;
    for (let i = prior.length - 1; i >= 0 && !last; i--) {
      const we = (prior[i].workout_exercises || []).find((x) => x.exercise_id === ex.exerciseId && working(x.sets).length > 0);
      if (we) last = { date: prior[i].completed_at, top: topSet(displaySets(we, unit)) };
    }
    const top = topSet(workSets);
    let delta = null;
    if (last && last.top && top) {
      const dw = Math.round(((Number(top.weight) || 0) - (Number(last.top.weight) || 0)) * 100) / 100;
      delta = dw !== 0 ? { kind: "weight", value: dw } : { kind: "reps", value: (top.reps || 0) - (last.top.reps || 0) };
    }
    const volume = workSets.reduce((v, s) => v + (Number(s.weight) || 0) * (s.reps || 0), 0);
    return { prs: prsWithIdx, prSetIndexes, top, last, delta, volume: Math.round(volume), workingCount: workSets.length };
  });

  // Headline PR: weight beats e1RM beats volume; within a type, the
  // biggest relative jump wins.
  let headline = null;
  exercises.forEach((e, i) => {
    for (const p of e.prs) {
      const gain = p.previous > 0 ? p.value / p.previous - 1 : 0;
      const rank = TYPE_ORDER.indexOf(p.type);
      if (!headline || rank < headline.rank || (rank === headline.rank && gain > headline.gain)) {
        headline = { ...p, rank, gain, exerciseIndex: i, name: data.exercises[i].name, set: data.exercises[i].sets[p.setIndex] };
      }
    }
  });
  const prExerciseCount = exercises.filter((e) => e.prs.length > 0).length;

  // Comparable earlier workout: most recent one sharing at least half of
  // this workout's exercises.
  const ids = new Set((data.exercises || []).map((e) => e.exerciseId).filter(Boolean));
  let compare = null;
  for (let i = prior.length - 1; i >= 0 && ids.size > 0; i--) {
    const theirs = new Set((prior[i].workout_exercises || []).filter((we) => working(we.sets).length > 0).map((we) => we.exercise_id));
    let overlap = 0;
    ids.forEach((id) => { if (theirs.has(id)) overlap++; });
    if (overlap / ids.size >= 0.5) {
      const t = workoutTotals(prior[i], unit);
      compare = {
        date: prior[i].completed_at,
        volume: t.volume, sets: t.sets, duration: t.duration,
        volumePct: t.volume > 0 ? Math.round(((data.totalVolume - t.volume) / t.volume) * 100) : null,
        setsDelta: data.totalSets - t.sets,
        durationDelta: data.durationMin != null && t.duration != null ? data.durationMin - t.duration : null,
      };
      break;
    }
  }

  // Month + streak as of this workout's day.
  const today = toLocalDateStr(completedAt);
  const ym = today.slice(0, 7);
  const monthPrior = prior.filter((w) => toLocalDateStr(w.completed_at).slice(0, 7) === ym);
  const activeDays = new Set([...monthPrior.map((w) => toLocalDateStr(w.completed_at)), today]);
  const month = {
    label: completedAt.toLocaleDateString(undefined, { month: "long" }),
    year: completedAt.getFullYear(),
    monthIndex: completedAt.getMonth(),
    todayDay: completedAt.getDate(),
    activeDays,
    workouts: monthPrior.length + 1,
    volume: monthPrior.reduce((v, w) => v + workoutTotals(w, unit).volume, 0) + (data.totalVolume || 0),
    prs: monthPrior.reduce((n, w) => n + (prCountByWorkout[w.id] || 0), 0) + prExerciseCount,
  };
  const days = [...new Set([...prior.map((w) => toLocalDateStr(w.completed_at)), today])].sort().reverse();
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    if (Math.round((dayDate(days[i - 1]) - dayDate(days[i])) / dayMs) <= 2) streak++;
    else break;
  }

  return { exercises, headline, prExerciseCount, compare, month, streak, hasHistory: prior.length > 0 };
}

// Auto title from the muscle groups that got the most working sets
// ("Chest + Shoulders"); falls back to "Workout".
export function autoTitle(exercises) {
  const counts = {};
  for (const ex of exercises || []) {
    const n = (ex.sets || []).filter((s) => !s.isWarmup && (s.reps || 0) > 0).length;
    if (!ex.muscleGroup || n === 0) continue;
    counts[ex.muscleGroup] = (counts[ex.muscleGroup] || 0) + n;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (top.length === 0) return "Workout";
  if (top.length >= 4 && top[0][1] < 0.4 * top.reduce((s, x) => s + x[1], 0)) return "Full body";
  return top.slice(0, 2).map(([g]) => g).join(" + ");
}

// Compact number for big hero stats: 12,420 -> "12.4k".
export function compactNum(n) {
  if (n == null) return "";
  if (Math.abs(n) >= 10000) return `${(Math.round(n / 100) / 10).toLocaleString()}k`;
  return Math.round(n).toLocaleString();
}

export function fmtW(n) {
  if (n == null) return "";
  const r = Math.round(Number(n) * 100) / 100;
  return String(r);
}
