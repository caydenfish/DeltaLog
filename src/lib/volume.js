import { muscleLabel, isRealMuscle, isFullBody, FULL_BODY } from "./muscleTaxonomy";
import { toLocalDateStr } from "./time";

// Sets arrive from two different shapes depending on caller: raw DB rows
// (workout_exercises.sets, snake_case is_warmup -- summarizeHistory) and
// SetLogger's own live in-workout state (camelCase isWarmup). Checking
// both once here means every consumer of a set's warmup status agrees,
// rather than each call site guessing which shape it was handed.
function isWarmupSet(s) {
  return !!(s.is_warmup ?? s.isWarmup);
}

// Fractional set counting (v1.13.8): a set counts 1.0 toward each
// muscle it trains directly (primary) and 0.5 toward each muscle it
// trains indirectly (secondary). This is the "fractional" method from
// Pelland et al. (Sports Medicine, 2025), which predicted hypertrophy
// and strength outcomes better than counting indirect sets as full sets
// or ignoring them. computeMuscleSetCounts still returns RAW primary and
// secondary counts (so "4 primary, 6 secondary" stays literal); anything
// that combines them into a single per-muscle number goes through
// effectiveSets() so every surface agrees.
export const SECONDARY_SET_WEIGHT = 0.5;

// An exercise only counts as "worked" (v1.14.5) if at least one working
// (non-warmup) set with reps was logged for it. Planned-but-skipped and
// warmup-only exercises don't count anywhere they'd be read as trained:
// the Today card's muscles, history exercise counts, and "last session".
// (Volume, heat map, weekly volume and training load already sum only
// working sets, so those exercises contribute nothing there.)
export function isWorkedExercise(we) {
  return (we && we.sets ? we.sets : []).some((s) => !s.is_warmup && !s.isWarmup && (s.reps || 0) > 0);
}

// Hard sets (v1.14.2): weekly-volume research counts sets taken close to
// failure (in Pelland et al. ~78% of effects were trained to failure),
// and Robinson et al. (Sports Medicine, 2024) found hypertrophy falls off
// as sets end further from failure. So the Weekly volume card only counts
// working sets logged at RIR 4 or less. Sets with no RIR logged still
// count, since there's nothing to say they were easy. RIR 4 is the common
// "hard set" convention, not a sharp physiological line.
export const HARD_SET_MAX_RIR = 4;
export function isHardSet(s) {
  return s.rir == null || s.rir <= HARD_SET_MAX_RIR;
}
function hardOnlyEntries(entries) {
  return entries.map((e) => ({ ...e, sets: (e.sets || []).filter(isHardSet) }));
}
export function effectiveSets(primaryCount, secondaryCount) {
  return (primaryCount || 0) + SECONDARY_SET_WEIGHT * (secondaryCount || 0);
}
// Fractional set totals render with at most one decimal ("7.5"), whole
// numbers without one ("8").
export function formatSets(n) {
  const r = Math.round((n || 0) * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

// Counts working sets per muscle group (not weighted by volume) from the
// same { muscle, primaryMuscles, secondaryMuscles, sets } entries used by
// computeMuscleVolumes. Backs the "Primary Muscles / Secondary Muscles"
// breakdown, which reports real set counts instead of a heatmap intensity.
// `nameMode` ("generic" | "detailed" | "scientific") controls the
// granularity of the grouping itself, not just the label shown afterward —
// e.g. under "detailed" mode, "Front Delts" and "Rear Delts" show up as
// separate rows instead of both collapsing into "Shoulders". Primary
// grouping prefers each exercise's tagged `primaryMuscles` (real
// per-exercise granularity from the muscle taxonomy) and falls back to
// the broad `muscle` bucket for exercises that predate that tagging.
// `setsFilter` ("working" | "warmup" | "both") decides which of an
// entry's sets get counted -- "working" (the default, matching every
// existing call site's prior behavior) excludes warmup sets, "warmup"
// counts only warmup sets, "both" counts everything. Callers whose sets
// were already pre-filtered before reaching here (SetLogger's live
// heatmap, Templates' synthetic planning entries) are unaffected either
// way since there's nothing to filter out.
export function computeMuscleSetCounts(entries, nameMode = "generic", setsFilter = "working") {
  const primary = {};
  const secondary = {};
  let fullBodySets = 0;

  for (const entry of entries) {
    const rawSets = entry.sets || [];
    const filteredSets =
      setsFilter === "both" ? rawSets
      : setsFilter === "warmup" ? rawSets.filter(isWarmupSet)
      : rawSets.filter((s) => !isWarmupSet(s));
    const count = filteredSets.length;
    if (count <= 0) continue;

    if (isFullBody(entry.muscle)) {
      fullBodySets += count;
      continue;
    }

    const rawPrimary = entry.primaryMuscles && entry.primaryMuscles.length > 0 ? entry.primaryMuscles : [entry.muscle];
    const primaryLabels = new Set();
    for (const p of rawPrimary) {
      if (!isRealMuscle(p)) continue;
      primaryLabels.add(muscleLabel(p, nameMode));
    }
    for (const label of primaryLabels) primary[label] = (primary[label] || 0) + count;

    // A muscle that's already a primary mover for this exercise isn't
    // also counted as secondary. Previously it was, and since
    // computeRollingWeeklyTotals sums primary + secondary, that inflated
    // Weekly Set Goals progress for any exercise tagged both ways (or
    // whose primary and secondary tags collapse to the same key at the
    // active tier, e.g. Category mode).
    const secondaryLabels = new Set();
    for (const sec of entry.secondaryMuscles || []) {
      if (!isRealMuscle(sec) || isFullBody(sec)) continue;
      const label = muscleLabel(sec, nameMode);
      if (!primaryLabels.has(label)) secondaryLabels.add(label);
    }
    for (const label of secondaryLabels) secondary[label] = (secondary[label] || 0) + count;
  }

  return { primary, secondary, fullBodySets };
}

// Groups completed workouts by calendar date, independent of any range
// filter the volume chart might be using — a calendar should reflect real
// training history no matter what "7D/30D/90D" happens to be selected.
// Returns a volume-per-day map (for shading intensity) alongside the raw
// workouts for each date (for click-through to the workout detail view).
export function groupWorkoutsByDate(history) {
  const byDate = {};
  const workoutsByDate = {};
  for (const w of history || []) {
    const date = toLocalDateStr(w.completed_at);
    const vol = (w.workout_exercises || []).reduce(
      (sum, we) => sum + (we.sets || []).filter((set) => !set.is_warmup).reduce((s, set) => s + (set.weight || 0) * (set.reps || 0), 0),
      0
    );
    byDate[date] = (byDate[date] || 0) + vol;
    (workoutsByDate[date] = workoutsByDate[date] || []).push(w);
  }
  return { byDate, workoutsByDate };
}


// Shared bucketing rule for any date-series chart that needs to shrink
// resolution as its time range widens: daily for a week is readable, but
// a year of daily points is a wall of overlapping dots. 7d stays daily,
// 30d buckets into calendar weeks, 90d into 14-day windows, 365d into
// months. Exported so any per-day series (bodyweight, volume, and
// anything added later) can reuse the exact same rule instead of drifting
// out of sync with each other.
export function dateBucketKeyFor(dateStr, rangeKey) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (rangeKey === "30d") {
    // Calendar week, Monday-anchored.
    const dow = d.getDay(); // 0 = Sun
    const diffToMonday = (dow + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - diffToMonday);
    return toLocalDateStr(monday);
  }
  if (rangeKey === "90d") {
    // 14-day windows, anchored to the Unix epoch so buckets are stable
    // regardless of which dates happen to be in range.
    const epochDay = Math.floor(d.getTime() / 86400000);
    return `biweek-${Math.floor(epochDay / 14)}`;
  }
  if (rangeKey === "365d") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return dateStr; // 7d (and anything unrecognized): one bucket per day
}

// Converts a bucket's date string into a real epoch-ms timestamp, so
// charts can plot points on an actual time scale instead of evenly
// spaced categories -- July 6/7/8 sit close together and July 8 to
// July 12 sits visibly further apart, rather than every point being
// the same distance from its neighbor regardless of the real gap.
// 365d buckets are "YYYY-MM" (no day), so they're anchored to the 1st.
function bucketDateToTs(dateStr, rangeKey) {
  const iso = rangeKey === "365d" ? `${dateStr}-01` : dateStr;
  return new Date(`${iso}T00:00:00`).getTime();
}

// Buckets bodyweight points to match how far back the chart is zoomed.
// Multiple entries landing in the same bucket (including two workouts
// logged the same day) are averaged together — this is also what fixes a
// bucket's date otherwise showing up twice on the 7-day view when a user
// logged bodyweight in more than one workout that day.
export function bucketWeightHistory(points, rangeKey) {
  if (!points || points.length === 0) return [];

  const buckets = new Map();
  for (const p of points) {
    const key = dateBucketKeyFor(p.date, rangeKey);
    const b = buckets.get(key) || { sum: 0, count: 0, lastDate: p.date };
    b.sum += p.weight;
    b.count += 1;
    if (p.date > b.lastDate) b.lastDate = p.date;
    buckets.set(key, b);
  }

  // Weekly and monthly buckets label themselves with the bucket key (start
  // of week, or "YYYY-MM") rather than whichever raw date happened to be
  // most recent in that bucket — reads as "the week of" / "the month of"
  // instead of an arbitrary day. Daily and biweekly buckets don't have a
  // clean key to show, so they use the latest real date in the bucket.
  return [...buckets.entries()]
    .map(([key, b]) => {
      const date = rangeKey === "30d" || rangeKey === "365d" ? key : b.lastDate;
      return {
        date,
        ts: bucketDateToTs(date, rangeKey),
        weight: Math.round((b.sum / b.count) * 10) / 10,
      };
    })
    .sort((a, b) => a.ts - b.ts);
}

// Buckets a { date, volume } series (the volume-over-time chart) the same
// way bucketWeightHistory does, except volume is additive — total volume
// moved that week/month, not an average — so widening the range actually
// changes what the chart shows instead of just cramming more daily dots
// into the same width.
export function bucketDailyVolume(points, rangeKey) {
  if (!points || points.length === 0) return [];

  const buckets = new Map();
  for (const p of points) {
    const key = dateBucketKeyFor(p.date, rangeKey);
    const b = buckets.get(key) || { sum: 0, lastDate: p.date };
    b.sum += p.volume;
    if (p.date > b.lastDate) b.lastDate = p.date;
    buckets.set(key, b);
  }

  return [...buckets.entries()]
    .map(([key, b]) => {
      const date = rangeKey === "30d" || rangeKey === "365d" ? key : b.lastDate;
      return {
        date,
        ts: bucketDateToTs(date, rangeKey),
        volume: Math.round(b.sum),
      };
    })
    .sort((a, b) => a.ts - b.ts);
}

// Turns fetchExerciseHistory's rows into three raw (unbucketed) daily
// series for one exercise: top set weight that day, total working reps,
// and total volume (weight × reps, summed across working sets). Multiple
// workouts hitting the same exercise on the same calendar day are merged
// into that day's point rather than shown as separate entries. Warmup
// sets are excluded from all three, same as the rest of the app's volume
// math.
export function summarizeExerciseHistory(rows) {
  const byDate = {};
  for (const row of rows || []) {
    const date = toLocalDateStr(row.workouts.completed_at);
    const day = byDate[date] || (byDate[date] = { maxWeight: 0, totalReps: 0, volume: 0 });
    for (const s of row.sets || []) {
      if (s.is_warmup) continue;
      const weight = s.weight || 0;
      const reps = s.reps || 0;
      if (weight > day.maxWeight) day.maxWeight = weight;
      day.totalReps += reps;
      day.volume += weight * reps;
    }
  }
  const dates = Object.keys(byDate).sort();
  return {
    weight: dates.map((date) => ({ date, weight: byDate[date].maxWeight })),
    reps: dates.map((date) => ({ date, reps: byDate[date].totalReps })),
    volume: dates.map((date) => ({ date, volume: Math.round(byDate[date].volume) })),
  };
}

// Generic bucketing for a single-field {date, [field]: value} series,
// following the exact same widen-as-range-grows rule as
// bucketWeightHistory/bucketDailyVolume. `mode` is "avg" (weight, reps —
// e.g. top set that week, averaged) or "sum" (volume — total moved that
// week). Exported as one function rather than duplicating
// bucketWeightHistory/bucketDailyVolume a third time for the per-exercise
// charts.
export function bucketSeries(points, rangeKey, field, mode) {
  if (!points || points.length === 0) return [];
  const buckets = new Map();
  for (const p of points) {
    const key = dateBucketKeyFor(p.date, rangeKey);
    const b = buckets.get(key) || { sum: 0, count: 0, lastDate: p.date };
    b.sum += p[field];
    b.count += 1;
    if (p.date > b.lastDate) b.lastDate = p.date;
    buckets.set(key, b);
  }
  return [...buckets.entries()]
    .map(([key, b]) => {
      const date = rangeKey === "30d" || rangeKey === "365d" ? key : b.lastDate;
      return {
        date,
        ts: bucketDateToTs(date, rangeKey),
        [field]: mode === "sum" ? Math.round(b.sum) : Math.round((b.sum / b.count) * 10) / 10,
      };
    })
    .sort((a, b) => a.ts - b.ts);
}


// the body-weight-over-time chart. Only workouts where a weight was
// actually captured are included — no interpolation or carry-forward here,
// the chart just shows the real data points.
export function summarizeWeightHistory(history) {
  return (history || [])
    .filter((w) => w.body_weight != null)
    .map((w) => ({ date: toLocalDateStr(w.completed_at), weight: Number(w.body_weight) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}


// Per-workout duration (completed_at - started_at, in whole minutes),
// keyed by the day the workout was completed on — feeds the Workout
// Time chart the same way summarizeWeightHistory feeds the bodyweight
// chart. Multiple workouts finished the same day are summed (matching
// dailyVolume's "total moved that day" behavior, not averaged), since
// two sessions in one day really did take that much combined time.
// Skips anything missing either timestamp or with a non-positive
// duration (clock skew, a workout started and completed in the same
// instant via some edge-case flow) rather than plotting a bogus 0.
export function summarizeWorkoutDuration(history) {
  const byDate = {};
  for (const w of history || []) {
    if (!w.started_at || !w.completed_at) continue;
    const minutes = Math.round((new Date(w.completed_at).getTime() - new Date(w.started_at).getTime()) / 60000);
    if (minutes <= 0) continue;
    const date = toLocalDateStr(w.completed_at);
    byDate[date] = (byDate[date] || 0) + minutes;
  }
  return Object.entries(byDate)
    .map(([date, minutes]) => ({ date, minutes }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Per-muscle-group set totals (primary+secondary combined, Full Body
// tracked separately via its own set count) for the trailing 7 days —
// today back 6 days, independent of whatever Training Range a chart
// happens to be showing. Backs "My Plan" (the weekly-set-target module)
// and its matching body-map coloring mode, both of which need "this
// week" specifically, not "however many days is currently selected."
// `nameMode` ("generic" | "detailed" | "scientific", default "generic")
// controls the granularity of the grouping itself, matching whichever
// tier Weekly Set Goals is currently tracking targets at (see
// getMuscleGroupOptions in muscleTaxonomy.js) -- e.g. in "detailed"
// mode, Lats and Traps come back as separate keys instead of both

// Average fractional sets per week over the last `weeks` weeks (default
// 4), per muscle -- the Weekly volume card's "4-week avg" view. Same keys
// and weighting as computeRollingWeeklyTotals.
export function computeAverageWeeklyTotals(history, nameMode = "generic", weeks = 4, { hardOnly = false } = {}) {
  const cutoff = toLocalDateStr(new Date(Date.now() - (weeks * 7 - 1) * 86400000));
  const { entries } = summarizeHistory(history || []);
  const inWindow = entries.filter((e) => e.date >= cutoff);
  const windowed = hardOnly ? hardOnlyEntries(inWindow) : inWindow;
  const { primary, secondary, fullBodySets } = computeMuscleSetCounts(windowed, nameMode);
  const totals = {};
  for (const label of new Set([...Object.keys(primary), ...Object.keys(secondary)])) {
    totals[label] = effectiveSets(primary[label], secondary[label]) / weeks;
  }
  totals[FULL_BODY] = fullBodySets / weeks;
  return totals;
}

// Entries (summarizeHistory shape) from the last `days` days, for drilling
// into one muscle's sets behind a windowed total.
export function entriesSince(history, days, { hardOnly = false } = {}) {
  const cutoff = toLocalDateStr(new Date(Date.now() - (days - 1) * 86400000));
  const windowed = summarizeHistory(history || []).entries.filter((e) => e.date >= cutoff);
  return hardOnly ? hardOnlyEntries(windowed) : windowed;
}

// collapsing into "Back".
export function computeRollingWeeklyTotals(history, nameMode = "generic", { hardOnly = false } = {}) {
  const cutoff = toLocalDateStr(new Date(Date.now() - 6 * 86400000));
  const { entries } = summarizeHistory(history || []);
  const windowed = entries.filter((e) => e.date >= cutoff);
  const rolling = hardOnly ? hardOnlyEntries(windowed) : windowed;
  const { primary, secondary, fullBodySets } = computeMuscleSetCounts(rolling, nameMode);
  const totals = {};
  for (const label of new Set([...Object.keys(primary), ...Object.keys(secondary)])) {
    totals[label] = effectiveSets(primary[label], secondary[label]);
  }
  totals[FULL_BODY] = fullBodySets;
  return totals;
}

// entries suitable for computeMuscleSetCounts, and a parallel list of
// { date, volume } points for the volume-over-time chart. `entries[].sets`
// carries every logged set (working and warmup both, is_warmup intact)
// rather than pre-filtering warmup out -- computeMuscleSetCounts' own
// setsFilter decides which ones count for a given caller, so the same
// entries serve the volume chart (always working-set volume, computed
// below regardless of what a caller later does with entries) and the
// muscle breakdown heatmap (whose Sets criteria toggle needs both kinds
// available to filter between).
export function summarizeHistory(history) {
  const entries = [];
  const byDate = {};

  for (const w of history) {
    const date = toLocalDateStr(w.completed_at);
    byDate[date] = byDate[date] || 0;
    for (const we of w.workout_exercises || []) {
      const ex = we.exercises;
      if (!ex) continue;
      const allSets = we.sets || [];
      const workingVol = allSets.filter((s) => !s.is_warmup).reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);
      byDate[date] += workingVol;
      entries.push({ muscle: ex.muscle_group, primaryMuscles: ex.primary_muscles || [], secondaryMuscles: ex.secondary_muscles || [], sets: allSets, exerciseName: ex.name, date });
    }
  }

  const dailyVolume = Object.entries(byDate)
    .map(([date, volume]) => ({ date, volume: Math.round(volume) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { entries, dailyVolume, byDate };
}
