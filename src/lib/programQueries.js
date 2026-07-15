// Data layer for the Program Generator. Mirrors the conventions already
// used throughout queries.js (normalizeExercise for library rows, toDisplay
// for unit conversion) but kept in its own file since it's a self-contained
// feature bolted onto the existing workout/exercise schema.

import { supabase } from "./supabaseClient";
import { normalizeExercise } from "./queries";
import { getPrefs } from "./prefs";
import { toDisplay } from "./weight";

// ---------- Programs ----------

export async function createProgram(userId, { trainingFocus, experienceLevel, durationWeeks, daysPerWeek, splitName }) {
  const { data, error } = await supabase
    .from("programs")
    .insert({
      user_id: userId,
      training_focus: trainingFocus,
      experience_level: experienceLevel,
      duration_weeks: durationWeeks,
      days_per_week: daysPerWeek,
      split_name: splitName,
    })
    .select()
    .single();
  if (error) throw error;
  return data.id;
}

// exercisesArr: [{ exerciseId, position, dayIndex, plannedSets, progressionModel }]
export async function addProgramExercises(programId, exercisesArr) {
  const rows = exercisesArr.map((e) => ({
    program_id: programId,
    exercise_id: e.exerciseId,
    position: e.position,
    day_index: e.dayIndex ?? 0,
    planned_sets: e.plannedSets ?? 3,
    progression_model: e.progressionModel || null,
  }));
  const { error } = await supabase.from("program_exercises").insert(rows);
  if (error) throw error;
}

export async function fetchActiveProgram(userId) {
  const { data: program, error } = await supabase
    .from("programs")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!program) return null;

  const { data: exRows, error: exErr } = await supabase
    .from("program_exercises")
    .select("id, position, day_index, planned_sets, progression_model, exercises (*)")
    .eq("program_id", program.id)
    .order("position");
  if (exErr) throw exErr;

  return {
    id: program.id,
    trainingFocus: program.training_focus,
    experienceLevel: program.experience_level,
    durationWeeks: program.duration_weeks,
    daysPerWeek: program.days_per_week,
    splitName: program.split_name,
    status: program.status,
    createdAt: program.created_at,
    exercises: (exRows || []).map((row) => ({
      programExerciseId: row.id,
      position: row.position,
      dayIndex: row.day_index,
      plannedSets: row.planned_sets,
      progressionModel: row.progression_model,
      exercise: normalizeExercise(row.exercises),
    })),
  };
}

export async function updateProgramStatus(programId, status) {
  const { error } = await supabase
    .from("programs")
    .update({ status, ended_at: status === "active" ? null : new Date().toISOString() })
    .eq("id", programId);
  if (error) throw error;
}

// Sessions completed so far under this program -- one completed workout
// tagged with this program_id counts as one session, regardless of which
// exercises it contained. This (not a calendar date) is what program week
// number is computed from, so a missed week just waits rather than
// desyncing the block.
export async function fetchProgramSessionCount(programId) {
  const { data, error } = await supabase
    .from("workout_exercises")
    .select("workout_id, workouts!inner(completed_at)")
    .eq("program_id", programId)
    .not("workouts.completed_at", "is", null);
  if (error) throw error;
  return new Set((data || []).map((r) => r.workout_id)).size;
}

// ---------- History for the progression engine ----------

// Last `limit` *completed* sessions for one exercise, newest first, each
// with its working sets only (warmups excluded -- the engine's e1RM math
// has no use for them). This is deliberately broader than
// fetchLastSession in queries.js (which only looks at the single most
// recent session): the engine needs 2-3 sessions of history for
// smoothing and plateau detection.
export async function fetchRecentSessions(userId, exerciseId, limit = 3) {
  const { data: rows, error } = await supabase
    .from("workout_exercises")
    .select("id, workouts!inner(user_id, completed_at), sets (weight, reps, rir, is_warmup, set_number)")
    .eq("exercise_id", exerciseId)
    .eq("workouts.user_id", userId)
    .not("workouts.completed_at", "is", null)
    .order("workouts(completed_at)", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const unit = getPrefs().units;
  return (rows || []).map((row) => ({
    completedAt: row.workouts.completed_at,
    sets: (row.sets || [])
      .filter((s) => !s.is_warmup)
      .sort((a, b) => a.set_number - b.set_number)
      .map((s) => ({ weight: toDisplay(Number(s.weight), unit), reps: s.reps, rir: s.rir })),
  }));
}

// Total completed sessions across every exercise, ever -- the signal
// used to suggest (never silently apply) an experience level in setup.
export async function fetchTotalSessionCount(userId) {
  const { count, error } = await supabase
    .from("workouts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("completed_at", "is", null);
  if (error) throw error;
  return count || 0;
}

// Stamps the program engine's computed prescription onto a workout_exercises
// row right after it's created via the existing addWorkoutExercise. Kept as
// a separate, additive call rather than changing addWorkoutExercise's
// signature, so every other call site of that function is untouched.
export async function tagWorkoutExerciseWithProgram(weId, { programId, programWeek, prescribedWeight, prescribedReps, progressionReason }) {
  const { error } = await supabase
    .from("workout_exercises")
    .update({
      program_id: programId,
      program_week: programWeek,
      prescribed_weight: prescribedWeight,
      prescribed_reps: prescribedReps,
      progression_reason: progressionReason,
    })
    .eq("id", weId);
  if (error) throw error;
}
