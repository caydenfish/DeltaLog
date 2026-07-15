// Science engine for the multi-week Program Generator. Pure functions
// only -- no Supabase calls in here (that's programQueries.js) and no
// React -- so the progression math can be tested and reasoned about in
// isolation from data-fetching and UI.
//
// Three progression models, one per Training Focus by default, each
// selectable as a manual override on any program or exercise:
//   - double_progression: work up to the top of the rep range across
//     all sets at a fixed weight, then add weight and drop back to the
//     bottom of the range. Simplest, most forgiving of noisy logging,
//     the standard prescription for hypertrophy and endurance rep
//     ranges in the literature.
//   - percent_e1rm: weight is a percentage of a *smoothed* rolling e1RM
//     (never a single session's estimate, which is noisy on its own),
//     with the percentage climbing across the block. Standard for
//     low-rep strength work, where a fixed weight-jump rule is too
//     coarse.
//   - rir_autoregulation: percent_e1rm's output nudged up or down based
//     on whether last session's logged RIR came in easier or harder
//     than prescribed. Highest ceiling, but only as good as how
//     honestly RIR gets logged -- offered as an explicit opt-in, not a
//     default, for exactly that reason.
//
// Every prescription carries a reasonCode + reasonText so the caller
// (ProgramView / SetLogger) can show the person why a number moved
// rather than presenting it as an unexplained black box.

import { IDEOLOGIES } from "./ideologies";

const WEIGHT_STEP = { lbs: 5, kg: 2.5 };

export const PROGRESSION_MODELS = {
  double_progression: "Double Progression",
  percent_e1rm: "% of e1RM",
  rir_autoregulation: "RIR Autoregulation",
};

// Short, plain-language blurbs for the setup wizard -- one per model,
// written for the person picking a program, not for someone reading the
// engine source. Keep in lockstep with the technical notes at the top of
// this file if the underlying behavior ever changes.
export const PROGRESSION_MODEL_DESCRIPTIONS = {
  double_progression: "Work up to the top of your rep range at the same weight, then add weight next time and start back at the bottom. Simple and forgiving if your logging isn't perfectly consistent.",
  percent_e1rm: "Your weight is set as a percentage of your estimated max, climbing gradually across the block. Built for lower-rep strength work, where jumping by a fixed weight increment is too coarse.",
  rir_autoregulation: "Same idea as % of max, but nudges the weight based on how hard your last session actually felt. The most responsive option, but only as good as how honestly you log reps in reserve.",
};

// Same formula as SetLogger.jsx's local e1RM/weightForReps -- duplicated
// rather than imported so this module has zero dependency on the logger,
// but kept in lockstep intentionally. Change one, change both.
export function e1RM(weight, reps, rir) {
  const eff = reps + rir;
  if (eff <= 0 || weight <= 0) return 0;
  if (eff === 1) return weight;
  if (eff <= 6) return weight / (1.0278 - 0.0278 * eff);
  return weight * (1 + eff / 30);
}

export function weightForReps(oneRM, reps) {
  if (reps <= 6) return oneRM * (1.0278 - 0.0278 * reps);
  return oneRM / (1 + reps / 30);
}

function roundToStep(weight, unit) {
  const step = WEIGHT_STEP[unit] || 5;
  return Math.round(weight / step) * step;
}

// Default progression model per Training Focus. Overridable per program
// or per exercise -- this is only the fallback when no override is set.
export function defaultModelForFocus(focus) {
  if (focus === "Strength") return "percent_e1rm";
  return "double_progression"; // Hypertrophy, Endurance
}

// A session's *working* sets (warmups already filtered out by the
// caller) reduced to its single best e1RM and the set that produced it.
function bestSetOf(sets) {
  if (!sets || sets.length === 0) return null;
  return sets.reduce((best, s) => (e1RM(s.weight, s.reps, s.rir) > e1RM(best.weight, best.reps, best.rir) ? s : best));
}

// Rolling e1RM anchor: weighted average of the best e1RM from up to the
// last 3 sessions, most-recent weighted highest. This is the smoothing
// step that keeps one rough or one lucky session from whipsawing the
// prescribed weight -- a single session's e1RM is noisy on its own.
// `sessions` is newest-first: [{ sets: [{weight,reps,rir}], completedAt }]
const SMOOTHING_WEIGHTS = [0.5, 0.3, 0.2];
export function smoothedE1RM(sessions) {
  const usable = (sessions || []).filter((s) => bestSetOf(s.sets));
  if (usable.length === 0) return 0;
  let weightedSum = 0;
  let weightTotal = 0;
  usable.slice(0, 3).forEach((session, i) => {
    const best = bestSetOf(session.sets);
    const w = SMOOTHING_WEIGHTS[i] ?? 0.1;
    weightedSum += e1RM(best.weight, best.reps, best.rir) * w;
    weightTotal += w;
  });
  return weightTotal > 0 ? weightedSum / weightTotal : 0;
}

// Layoff detection: a 10+ day gap since the last logged session for this
// exercise warrants a re-entry buffer rather than blindly continuing the
// block's progression as if nothing happened.
const GAP_DAYS_THRESHOLD = 10;
export function detectGap(sessions) {
  if (!sessions || sessions.length === 0) return false;
  const last = sessions[0]?.completedAt;
  if (!last) return false;
  const days = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24);
  return days >= GAP_DAYS_THRESHOLD;
}

// Plateau detection: missed the prescribed rep target on the top set two
// sessions running. Used to back off intensity or flag an early deload
// rather than mechanically pushing the number up into a wall.
export function detectPlateau(sessions, targetReps) {
  if (!sessions || sessions.length < 2) return false;
  const missed = sessions.slice(0, 2).every((session) => {
    const best = bestSetOf(session.sets);
    return best && best.reps < targetReps;
  });
  return missed;
}

// Percent-of-e1RM schedule across a block: climbs from 70% to 87.5% by
// the final working week (the deload week is handled separately). Week
// numbers are 1-indexed against durationWeeks *excluding* the deload.
function percentForWeek(week, workingWeeks) {
  if (workingWeeks <= 1) return 0.75;
  const frac = (week - 1) / (workingWeeks - 1);
  return 0.70 + frac * (0.875 - 0.70);
}

// The core call: given everything known about one exercise slot in an
// active program, compute this session's prescription. `sessions` is
// this exercise's recent completed-session history, newest first, sets
// already filtered to working sets only by the caller.
export function computePrescription({
  trainingFocus,
  progressionModel, // override, or null to use the focus default
  weekNumber, // 1-indexed, "sessions completed" based, not calendar
  durationWeeks,
  isDeloadWeek,
  sessions,
  unit,
  fallbackWeight, // library default weight (exercises.target_weight) -- last-resort only, since it's 0 for nearly the entire library
  fallbackEstimate, // optional { e1RM, source: 'similar_exercises' | 'bodyweight' } -- a smarter starting point than the library default, derived by the caller from the person's own training data (see fetchFallbackWeightEstimate / estimateFallbackE1RM). Takes priority over fallbackWeight whenever present.
}) {
  const model = progressionModel || defaultModelForFocus(trainingFocus);
  const { low, high } = IDEOLOGIES[trainingFocus];
  const midReps = Math.round((low + high) / 2);
  const hasHistory = sessions && sessions.length > 0 && bestSetOf(sessions[0].sets);
  const gap = detectGap(sessions);
  const plateau = detectPlateau(sessions, midReps);

  // Deload week overrides every model with a flat, unambiguous cut:
  // bottom of the rep range, ~60% of the smoothed e1RM (or a light
  // fallback with no history yet).
  if (isDeloadWeek) {
    const baseE1RM = hasHistory ? smoothedE1RM(sessions) : e1RM(fallbackWeight, midReps, 2);
    const weight = roundToStep(weightForReps(baseE1RM, low) * 0.6, unit);
    return {
      weight,
      reps: low,
      reasonCode: "deload",
      reasonText: "Deload week: volume and intensity reduced so you recover before the next block.",
      isDeload: true,
    };
  }

  if (!hasHistory) {
    const baseE1RM = fallbackEstimate ? fallbackEstimate.e1RM : e1RM(fallbackWeight, midReps, 2);
    const weight = roundToStep(weightForReps(baseE1RM, midReps), unit);
    const reasonBySource = {
      similar_exercises: "No logs for this one yet — starting weight estimated from your recent training on similar exercises.",
      bodyweight: "No training history to estimate from yet — a light starting point based on your bodyweight. This adjusts fast once you log a session.",
    };
    return {
      weight,
      reps: midReps,
      reasonCode: fallbackEstimate ? `estimated_from_${fallbackEstimate.source}` : "no_history",
      reasonText: fallbackEstimate ? reasonBySource[fallbackEstimate.source] : "First time on this one, starting from the library default.",
      isDeload: false,
    };
  }

  // A layoff takes priority over normal progression logic regardless of
  // model: ease back in rather than resuming the block's plan cold.
  if (gap) {
    const baseE1RM = smoothedE1RM(sessions);
    const weight = roundToStep(weightForReps(baseE1RM, midReps) * 0.9, unit);
    return {
      weight,
      reps: midReps,
      reasonCode: "gap_reentry",
      reasonText: "It's been a while since this one, easing back in below your last working weight.",
      isDeload: false,
    };
  }

  if (model === "double_progression") {
    const last = sessions[0];
    const lastBest = bestSetOf(last.sets);
    const allHitCeiling = last.sets.every((s) => s.reps >= high);
    if (allHitCeiling) {
      const weight = roundToStep(lastBest.weight + (WEIGHT_STEP[unit] || 5), unit);
      return {
        weight,
        reps: low,
        reasonCode: "dp_weight_up",
        reasonText: "Hit the top of your rep range last time, adding weight and resetting reps.",
        isDeload: false,
      };
    }
    if (plateau) {
      const weight = roundToStep(lastBest.weight * 0.9, unit);
      return {
        weight,
        reps: low,
        reasonCode: "plateau_backoff",
        reasonText: "Reps stalled the last two sessions, backing off weight to build back up.",
        isDeload: false,
      };
    }
    const reps = Math.min(high, lastBest.reps + 1);
    return {
      weight: lastBest.weight,
      reps,
      reasonCode: "dp_reps_up",
      reasonText: "Same weight as last time, working toward the top of your rep range.",
      isDeload: false,
    };
  }

  if (model === "percent_e1rm") {
    const baseE1RM = smoothedE1RM(sessions);
    const workingWeeks = Math.max(1, durationWeeks - 1); // last week is deload
    const percent = plateau ? percentForWeek(Math.max(1, weekNumber - 1), workingWeeks) : percentForWeek(weekNumber, workingWeeks);
    const weight = roundToStep(baseE1RM * percent, unit);
    return {
      weight,
      reps: low,
      reasonCode: plateau ? "percent_plateau_hold" : "percent_scheduled",
      reasonText: plateau
        ? "Progress stalled, holding this week's percentage steady instead of climbing."
        : `Week ${weekNumber} of the block: ${Math.round(percent * 100)}% of your rolling e1RM.`,
      isDeload: false,
    };
  }

  // rir_autoregulation
  const baseE1RM = smoothedE1RM(sessions);
  const lastBest = bestSetOf(sessions[0].sets);
  const targetRIR = 2;
  let weight = roundToStep(weightForReps(baseE1RM, midReps), unit);
  let reasonCode = "rir_hold";
  let reasonText = "Last session's RIR matched target, holding this week's weight steady.";
  if (lastBest.rir > targetRIR + 1) {
    weight = roundToStep(weight + (WEIGHT_STEP[unit] || 5), unit);
    reasonCode = "rir_too_easy";
    reasonText = "Last session had more reps in reserve than targeted, adding weight.";
  } else if (lastBest.rir < targetRIR - 1) {
    weight = roundToStep(weight - (WEIGHT_STEP[unit] || 5), unit);
    reasonCode = "rir_too_hard";
    reasonText = "Last session came in harder than targeted, easing off slightly.";
  }
  return { weight, reps: midReps, reasonCode, reasonText, isDeload: false };
}

// Suggests an experience level from overall logging history, used to
// pre-select (never silently auto-apply) a value in the setup wizard.
// Requires a minimum amount of data before suggesting anything at all --
// a handful of sessions isn't enough signal either way.
export function suggestExperienceLevel(totalSessionCount) {
  if (totalSessionCount < 8) return null;
  if (totalSessionCount >= 60) return "Advanced";
  if (totalSessionCount >= 20) return "Intermediate";
  return "Beginner";
}

// Short, plain-language blurbs for the setup wizard's Experience step.
export const EXPERIENCE_LEVEL_DESCRIPTIONS = {
  Beginner: "Keeps each day simple: one exercise per muscle group. A good starting point if you're new to structured training.",
  Intermediate: "Two exercises per muscle group per day, enough variety to keep progressing once the basics feel automatic.",
  Advanced: "Three exercises per muscle group per day, for a long training history and the recovery capacity to handle the extra volume.",
};

// Single source of truth for "what day is this program on right now" --
// used by both ProgramView (today's session) and Home's Last Workout
// widget (so the dashboard can say what's coming up without duplicating
// this math). `completedSessionCount` is sessions logged under this
// specific program (fetchProgramSessionCount), not lifetime sessions.
export function computeTodaysProgramDay(program, completedSessionCount) {
  const dayLabels = dayLabelsForSplit(program.splitName);
  const week = computeProgramWeek(completedSessionCount, program.daysPerWeek, program.durationWeeks);
  const deload = isDeloadWeek(week, program.durationWeeks);
  const dayIndex = dayLabels.length > 1 ? completedSessionCount % dayLabels.length : 0;
  return { dayLabels, dayIndex, dayLabel: dayLabels[dayIndex], week, durationWeeks: program.durationWeeks, deload };
}

// Last-resort starting-weight estimate for someone with zero training
// history to draw on for a given exercise AND nothing comparable logged
// anywhere else either (a brand-new lifter's very first session, most
// likely) -- deliberately conservative, deliberately not a real 1RM
// estimate, just enough of a starting point to not show 0. Self-corrects
// within a session or two via the normal double-progression/plateau
// logic once real numbers exist. Returns null (not 0) when there's no
// bodyweight on file to estimate from, so the caller can fall through to
// the library default rather than silently substituting a wrong number.
const BODYWEIGHT_FRACTION = { Compound: 0.3, Isolation: 0.1 };
export function estimateFallbackE1RM({ mechanism, bodyweightDisplay }) {
  if (!bodyweightDisplay || bodyweightDisplay <= 0) return null;
  const fraction = BODYWEIGHT_FRACTION[mechanism] ?? BODYWEIGHT_FRACTION.Isolation;
  return bodyweightDisplay * fraction;
}

// Multi-day split rotations the generator knows how to schedule across a
// week. Each label must be a real entry in getSplits() (admin-editable
// muscle groupings) -- day 0 of "Push/Pull/Legs" pulls from getSplits().Push,
// day 1 from .Pull, day 2 from .Legs, and so on.
export const SPLIT_ROTATIONS = {
  "Full Body": ["Full Body"],
  "Upper/Lower": ["Upper", "Lower"],
  "Push/Pull/Legs": ["Push", "Pull", "Legs"],
};

// Short, plain-language blurbs for the setup wizard's Split step.
export const SPLIT_DESCRIPTIONS = {
  "Full Body": "Trains every major muscle group each session. Best if you're training 2 days a week or fewer.",
  "Upper/Lower": "Alternates upper body and lower body days, giving each muscle group more focused volume than Full Body.",
  "Push/Pull/Legs": "Rotates pushing muscles (chest, shoulders, triceps), pulling muscles (back, biceps, rear delts), and legs across three days.",
};

export function dayLabelsForSplit(splitName) {
  return SPLIT_ROTATIONS[splitName] || ["Full Body"];
}

// Maps a raw days-per-week choice to a sensible default rotation, used by
// Quick Start so the person isn't asked to pick a split by hand. Falls
// back to whichever known rotation the admin-configured splits can
// actually support.
export function defaultSplitForDays(daysPerWeek, availableSplitNames) {
  const has = (name) => availableSplitNames.includes(name);
  if (daysPerWeek <= 2) return "Full Body";
  if (daysPerWeek === 3 && has("Push") && has("Pull") && has("Legs")) return "Push/Pull/Legs";
  if (has("Upper") && has("Lower")) return "Upper/Lower";
  if (has("Push") && has("Pull") && has("Legs")) return "Push/Pull/Legs";
  return "Full Body";
}

// Auto-picks exercises for one training day from the normalized exercise
// library (normalizeExercise() output -- same shape ExercisePicker and
// every other exercise list in the app already uses, so the generator's
// "Your exercises" step can share one fetch and one ExercisePicker
// instance instead of needing a second, differently-shaped library just
// for auto-pick scoring). Compound movements are scored above isolation
// work since they're the sane default backbone of a generated day;
// previously performed exercises break ties so the picks lean toward
// things the person already knows how to do. `perBucket` scales with
// experience level in the caller -- fewer exercises per muscle group
// keeps a beginner's first program simple, more gives an advanced lifter
// the fuller day they'd expect. `excludedRegions` (a Set of
// muscle_detailed keys, from getSplitExclusions -- migration_064) filters
// out exercises whose Region belongs to the *other* side of a shared
// Category, e.g. Rear Delts on a Push day even though "Shoulders" is a
// Push bucket -- without this, a Category match alone can't tell a
// front-delt raise from a rear-delt one and picks both days independently.
export function autoPickExercisesForDay(library, muscleBuckets, performedIds, perBucket = 2, excludedRegions = new Set()) {
  const picks = [];
  const usedIds = new Set();
  for (const bucket of muscleBuckets) {
    const candidates = library
      .filter((r) => r.muscle === bucket && !usedIds.has(r.id) && !excludedRegions.has(r.muscleRegion))
      .sort((a, b) => {
        const scoreA = (a.mechanism === "Compound" ? 2 : 0) + (performedIds.has(a.id) ? 1 : 0);
        const scoreB = (b.mechanism === "Compound" ? 2 : 0) + (performedIds.has(b.id) ? 1 : 0);
        return scoreB - scoreA;
      });
    candidates.slice(0, perBucket).forEach((c) => {
      picks.push({ ...c, plannedSets: 3 });
      usedIds.add(c.id);
    });
  }
  return picks;
}

export function perBucketForExperience(experienceLevel) {
  if (experienceLevel === "Beginner") return 1;
  if (experienceLevel === "Advanced") return 3;
  return 2; // Intermediate
}

// "Sessions completed" -> program week, capped at durationWeeks. This is
// the piece that makes the block restructure around what actually
// happened instead of drifting against a calendar: a missed week simply
// leaves the count where it was.
export function computeProgramWeek(completedSessionCount, daysPerWeek, durationWeeks) {
  const week = Math.floor(completedSessionCount / Math.max(1, daysPerWeek)) + 1;
  return Math.min(week, durationWeeks);
}

export function isDeloadWeek(week, durationWeeks) {
  return week >= durationWeeks;
}
