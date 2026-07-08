import { normalizeMuscleList, genericBucket } from "./muscleNomenclature";
import { toLocalDateStr } from "./time";

// Computes total working volume (weight × reps, summed across sets) per
// muscle group from a list of { muscle, secondaryMuscles, sets } entries,
// keeping primary-mover volume and secondary-mover volume separate so the
// heatmap can render them as full-saturation vs muted orange.
// "Full Body" exercises (carries, complexes, Olympic lifts) don't map to a
// single region, so their volume is tracked separately and reported as a
// percentage of total session volume instead.
export function computeMuscleVolumes(entries) {
  const primaryRaw = {};
  const secondaryRaw = {};
  let fullBodyVolume = 0;
  let totalVolume = 0;

  for (const entry of entries) {
    const vol = (entry.sets || []).reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);
    if (vol <= 0) continue;
    totalVolume += vol;

    if (entry.muscle === "Full Body") {
      fullBodyVolume += vol;
      continue;
    }
    primaryRaw[entry.muscle] = (primaryRaw[entry.muscle] || 0) + vol;
    for (const sec of entry.secondaryMuscles || []) {
      if (sec === "Full Body") continue;
      secondaryRaw[sec] = (secondaryRaw[sec] || 0) + vol * 0.5;
    }
  }

  // Both maps normalize against the same max so intensity is comparable
  // across the whole heatmap, not just within primary or secondary alone.
  const max = Math.max(0, ...Object.values(primaryRaw), ...Object.values(secondaryRaw));
  const normalize = (raw) => {
    const out = {};
    for (const [group, v] of Object.entries(raw)) out[group] = max > 0 ? v / max : 0;
    return out;
  };

  return {
    primary: normalize(primaryRaw),
    secondary: normalize(secondaryRaw),
    fullBodyFraction: totalVolume > 0 ? fullBodyVolume / totalVolume : 0,
  };
}

// Counts working sets per muscle group (not weighted by volume) from the
// same { muscle, secondaryMuscles, sets } entries used by
// computeMuscleVolumes. Backs the "Primary Muscles / Secondary Muscles"
// breakdown, which reports real set counts instead of a heatmap intensity.
export function computeMuscleSetCounts(entries) {
  const primary = {};
  const secondary = {};
  let fullBodySets = 0;

  for (const entry of entries) {
    const count = (entry.sets || []).length;
    if (count <= 0) continue;

    if (entry.muscle === "Full Body") {
      fullBodySets += count;
      continue;
    }
    primary[entry.muscle] = (primary[entry.muscle] || 0) + count;
    for (const sec of entry.secondaryMuscles || []) {
      if (sec === "Full Body") continue;
      secondary[sec] = (secondary[sec] || 0) + count;
    }
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
    .map(([key, b]) => ({
      date: rangeKey === "30d" || rangeKey === "365d" ? key : b.lastDate,
      weight: Math.round((b.sum / b.count) * 10) / 10,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
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
    .map(([key, b]) => ({
      date: rangeKey === "30d" || rangeKey === "365d" ? key : b.lastDate,
      volume: Math.round(b.sum),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Raw {date, weight} points, one per workout with a captured weight, for
// the body-weight-over-time chart. Only workouts where a weight was
// actually captured are included — no interpolation or carry-forward here,
// the chart just shows the real data points.
export function summarizeWeightHistory(history) {
  return (history || [])
    .filter((w) => w.body_weight != null)
    .map((w) => ({ date: toLocalDateStr(w.completed_at), weight: Number(w.body_weight) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}


// entries suitable for computeMuscleVolumes, and a parallel list of
// { date, volume } points for the volume-over-time chart.
export function summarizeHistory(history) {
  const entries = [];
  const byDate = {};

  for (const w of history) {
    const date = toLocalDateStr(w.completed_at);
    byDate[date] = byDate[date] || 0;
    for (const we of w.workout_exercises || []) {
      const ex = we.exercises;
      if (!ex) continue;
      const workingSets = (we.sets || []).filter((s) => !s.is_warmup);
      const vol = workingSets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);
      byDate[date] += vol;
      entries.push({ muscle: genericBucket(ex.muscle_group), secondaryMuscles: normalizeMuscleList(ex.secondary_muscles), sets: workingSets, exerciseName: ex.name, date });
    }
  }

  const dailyVolume = Object.entries(byDate)
    .map(([date, volume]) => ({ date, volume: Math.round(volume) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { entries, dailyVolume, byDate };
}
