import { supabase } from "./supabaseClient";
import { normalizeMuscleList } from "./muscleNomenclature";
import { getPrefs } from "./prefs";
import { toDisplay } from "./weight";
import { toLocalDateStr } from "./time";

// The picker's equipment filter works off one bucket per exercise
// (Barbell/Dumbbell/Cable/Machine/Kettlebell/Bodyweight/Other), but the
// library stores a full raw equipment list per exercise (e.g. ["Smith
// Machine", "Bench"]). This picks the single bucket that best represents
// that list — first match wins, most-specific checked first so e.g.
// "Smith Machine" lands on Machine rather than being missed entirely.
const EQUIPMENT_BUCKET_RULES = [
  ["smith", "Machine"],
  ["machine", "Machine"],
  ["cable", "Cable"],
  ["barbell", "Barbell"],
  ["ez-bar", "Barbell"],
  ["ez bar", "Barbell"],
  ["trap bar", "Barbell"],
  ["dumbbell", "Dumbbell"],
  ["kettlebell", "Kettlebell"],
  ["bodyweight", "Bodyweight"],
];

export function deriveEquipmentBucket(equipmentList) {
  for (const item of equipmentList || []) {
    const lower = (item || "").toLowerCase();
    const match = EQUIPMENT_BUCKET_RULES.find(([needle]) => lower.includes(needle));
    if (match) return match[1];
  }
  return "Other";
}

// Maps a Supabase `exercises` row onto the shape the component already
// works with (name/short/targetWeight/muscle/equipment/sessions/
// setupFields/lastWeek). This means the picker, search, filters, and the
// workout generator don't need to change at all — only the two places
// that fetch/mutate data do.
export function normalizeExercise(row) {
  return {
    id: row.id,
    name: row.name,
    short: row.short || row.name,
    targetWeight: Number(row.target_weight) || 0,
    muscle: row.muscle_group,
    primaryMuscles: normalizeMuscleList(row.primary_muscles),
    secondaryMuscles: normalizeMuscleList(row.secondary_muscles),
    // Un-collapsed versions of the above, kept alongside them rather than
    // replacing them: primaryMuscles/secondaryMuscles roll everything up
    // to the 8 generic buckets (needed for volume/set-count aggregation),
    // which loses the granular scientific_name tags entirely. The
    // generator's Detailed/Scientific target-muscle picker needs those
    // raw tags to filter at finer-than-bucket granularity.
    rawPrimaryMuscles: row.primary_muscles || [],
    rawSecondaryMuscles: row.secondary_muscles || [],
    equipment: deriveEquipmentBucket(row.equipment),
    equipmentList: row.equipment || [],
    setupFields: row.setup_fields || [],
    mediaUrl: row.media_url || null,
    isCustom: !!row.created_by,
    aliases: row.aliases || [],
    sessions: 0, // filled in by hydrateExercise when the exercise enters a workout
    lastWeek: [],
  };
}

// Returns the set of exercise IDs the user has performed in any completed
// workout, ever. Used to section exercise-picker lists into "Previously
// Performed" vs "Unperformed" without hydrating every single exercise.
export async function fetchPerformedExerciseIds(userId) {
  const { data, error } = await supabase
    .from("workout_exercises")
    .select("exercise_id, workouts!inner(user_id, completed_at)")
    .eq("workouts.user_id", userId)
    .not("workouts.completed_at", "is", null);
  if (error) throw error;
  return new Set(data.map((r) => r.exercise_id));
}

// Fetches the exercise library. Replaces the hardcoded LIBRARY constant.
export async function fetchExercises() {
  const { data, error } = await supabase.from("exercises").select("*").eq("archived", false).order("name");
  if (error) throw error;
  return data.map(normalizeExercise);
}

// Backs the single, role-aware Exercise Library screen (ExerciseLibraryView).
// Regular users only ever get includeArchived=false. Admins get true, since
// they need to find and fix any exercise regardless of archived state. Raw
// rows on purpose (not normalizeExercise) -- normalizeExercise collapses
// primary_muscles/secondary_muscles down to generic bucket keys for display
// elsewhere, which loses the exact scientific_name values the admin edit
// form needs to pre-fill its pickers and write back unchanged.
export async function fetchExerciseLibrary(includeArchived) {
  let query = supabase.from("exercises").select("*").order("name");
  if (!includeArchived) query = query.eq("archived", false);
  const { data, error } = await query.limit(400);
  if (error) throw error;
  return data;
}

// Admin-only: updates any editable field on a shared exercise. Any field
// can be omitted to leave it untouched. Writes straight to the shared
// `exercises` table (see exercises_update_admin policy, migration_010) --
// takes effect for every user immediately, no separate sync step.
export async function updateExercise(exerciseId, {
  name, equipment, primaryMuscles, muscleGroup, secondaryMuscles, mediaUrl,
} = {}) {
  const payload = {};
  if (name !== undefined) payload.name = name;
  if (equipment !== undefined) payload.equipment = equipment;
  if (primaryMuscles !== undefined) payload.primary_muscles = primaryMuscles;
  if (muscleGroup !== undefined) payload.muscle_group = muscleGroup;
  if (secondaryMuscles !== undefined) payload.secondary_muscles = secondaryMuscles;
  if (mediaUrl !== undefined) payload.media_url = mediaUrl;
  const { error } = await supabase.from("exercises").update(payload).eq("id", exerciseId);
  if (error) throw error;
}

// Tier 1 (Category): the broad buckets that drive the heatmap and
// coloring — readable by everyone, but only admins can add/rename/delete
// (see migration_029 and migration_040).
// Options for the "Muscle group" picker come from whatever muscle_group
// values are actually in use across real exercises right now, not a
// separately-maintained lookup table -- the lookup table (muscle_groups)
// can drift out of sync with reality (e.g. an admin edit years ago left
// it with a handful of oddly-specific entries instead of the broad
// categories actually used), while this can't drift since it's reading
// the same column every exercise's muscle_group actually lives in.
export async function fetchMuscleGroups() {
  const { data, error } = await supabase
    .from("exercise_muscle_groups")
    .select("muscle_group")
    .not("muscle_group", "is", null);
  if (error) throw error;
  const distinct = [...new Set(data.map((r) => r.muscle_group))].sort();
  return distinct.map((m) => ({ key: m, label: m }));
}

export async function addMuscleGroup(label) {
  const key = label.trim();
  const { error } = await supabase.from("muscle_groups").insert({ key, label: key });
  if (error) throw error;
}

export async function updateMuscleGroupLabel(key, label) {
  const { error } = await supabase.from("muscle_groups").update({ label: label.trim() }).eq("key", key);
  if (error) throw error;
}

// Will fail with a foreign-key error (surfaced to the caller) if any
// muscle_detailed row still points at this group — that's intentional,
// forces re-pointing or deleting the children first rather than silently
// orphaning them.
export async function deleteMuscleGroup(key) {
  const { error } = await supabase.from("muscle_groups").delete().eq("key", key);
  if (error) throw error;
}

// Tier 2 (Region): the gym-colloquial middle tier ("Lats", "Front
// Delts"), each belonging to exactly one Category. Migration_040
// promoted this from a bare text field on muscle_taxonomy into its own
// table so it can be managed independently of any one scientific entry.
export async function fetchMuscleDetailed() {
  const { data, error } = await supabase.from("muscle_detailed").select("key, label, generic_group").order("label");
  if (error) throw error;
  return data;
}

function slugify(label) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export async function addMuscleDetailed(label, genericGroup) {
  const key = slugify(label);
  const { error } = await supabase.from("muscle_detailed").insert({ key, label: label.trim(), generic_group: genericGroup });
  if (error) throw error;
}

export async function updateMuscleDetailed(key, { label, genericGroup } = {}) {
  const payload = {};
  if (label !== undefined) payload.label = label.trim();
  if (genericGroup !== undefined) payload.generic_group = genericGroup;
  const { error } = await supabase.from("muscle_detailed").update(payload).eq("key", key);
  if (error) throw error;
}

// Will fail with a foreign-key error if any muscle_taxonomy row still
// points at this detailed entry -- same re-point-or-delete-children-first
// intent as deleteMuscleGroup.
export async function deleteMuscleDetailed(key) {
  const { error } = await supabase.from("muscle_detailed").delete().eq("key", key);
  if (error) throw error;
}

// Tier 3 (Anatomy): what actually gets stored in
// exercises.primary_muscles / secondary_muscles. Each row points at a
// detailed entry via detailed_key; region_name/generic_group are
// deliberately not stored here -- derived through the join below so
// they can never drift out of sync with their parents. Shape kept flat
// ({scientific_name, detailed_name, generic_group}) on purpose:
// setMuscleTaxonomyCache and everything that reads its output
// (muscleLabel, genericBucket, the exercise edit picker) read that flat
// shape rather than a nested one.
export async function fetchMuscleTaxonomy() {
  const { data, error } = await supabase
    .from("muscle_taxonomy")
    .select("scientific_name, detailed_key, muscle_detailed(label, generic_group)")
    .order("scientific_name");
  if (error) throw error;
  return data.map((r) => ({
    scientific_name: r.scientific_name,
    detailed_key: r.detailed_key,
    detailed_name: r.muscle_detailed?.label,
    generic_group: r.muscle_detailed?.generic_group,
  }));
}

export async function addMuscleTaxonomyEntry(scientificName, detailedKey) {
  const { error } = await supabase.from("muscle_taxonomy").insert({ scientific_name: scientificName.trim(), detailed_key: detailedKey });
  if (error) throw error;
}

// Re-points which detailed entry a scientific name rolls up under.
// Renaming the scientific name itself goes through renameMuscleScientific
// instead, since that has to cascade into tagged exercises.
export async function updateMuscleTaxonomyEntry(scientificName, { detailedKey }) {
  const { error } = await supabase.from("muscle_taxonomy").update({ detailed_key: detailedKey }).eq("scientific_name", scientificName);
  if (error) throw error;
}

export async function deleteMuscleTaxonomyEntry(scientificName) {
  const { error } = await supabase.from("muscle_taxonomy").delete().eq("scientific_name", scientificName);
  if (error) throw error;
}

// Admin-only: renames a scientific muscle name and cascades the rename
// into every exercise already tagged with the old name (migration_041).
// A bare table update would silently orphan those exercises since
// primary_muscles/secondary_muscles are raw text arrays, not a real FK.
export async function renameMuscleScientific(oldName, newName) {
  const { error } = await supabase.rpc("admin_rename_muscle_scientific", { old_name: oldName, new_name: newName });
  if (error) throw error;
}

// Admin-editable workout splits (migration_043) -- Push/Pull/Legs/etc,
// each with a set of muscle_groups keys. Read by everyone (the generator,
// exercise picker filters, and FAQ & Glossary all need this), writable
// only by admins. split_muscles is a many-to-many join since a muscle
// can legitimately belong to more than one split (e.g. Shoulders under
// both Push and Pull).
export async function fetchSplits() {
  const { data, error } = await supabase
    .from("splits")
    .select("id, name, sort_order, split_muscles (muscle_group)")
    .order("sort_order");
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    muscles: (row.split_muscles || []).map((m) => m.muscle_group),
  }));
}

export async function addSplit(name) {
  const { data, error } = await supabase.from("splits").insert({ name: name.trim(), sort_order: 999 }).select().single();
  if (error) throw error;
  return { id: data.id, name: data.name, sortOrder: data.sort_order, muscles: [] };
}

export async function renameSplit(id, name) {
  const { error } = await supabase.from("splits").update({ name: name.trim() }).eq("id", id);
  if (error) throw error;
}

// Cascades to split_muscles via the FK's on delete cascade.
export async function deleteSplit(id) {
  const { error } = await supabase.from("splits").delete().eq("id", id);
  if (error) throw error;
}

export async function addSplitMuscle(splitId, muscleGroup) {
  const { error } = await supabase.from("split_muscles").insert({ split_id: splitId, muscle_group: muscleGroup });
  if (error) throw error;
}

export async function removeSplitMuscle(splitId, muscleGroup) {
  const { error } = await supabase.from("split_muscles").delete().eq("split_id", splitId).eq("muscle_group", muscleGroup);
  if (error) throw error;
}

// Admin-only: creates a brand-new exercise straight into the shared
// library (created_by stays null), rather than as a personal custom
// exercise that would need promoting later.
export async function createSharedExercise({ name, muscle, primaryMuscles, secondaryMuscles, equipment, mediaUrl }) {
  const { data, error } = await supabase
    .from("exercises")
    .insert({
      name,
      muscle_group: muscle,
      primary_muscles: primaryMuscles || [],
      secondary_muscles: secondaryMuscles || [],
      equipment: equipment ? [equipment] : [],
      target_weight: 0,
      setup_fields: [],
      created_by: null,
      admin_reviewed: true,
      media_url: mediaUrl || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Admin-only: searches users by email or name for the permissions
// screen. Calls a security-definer function (migration_030) since
// profiles' RLS otherwise locks every user to their own row only.
export async function adminSearchUsers(query) {
  const { data, error } = await supabase.rpc("admin_search_users", { query: query || "" });
  if (error) throw error;
  return data;
}

// Admin-only: grants or revokes admin access for another user. Server
// enforces this actually requires Creator, not just admin (migration_049)
// — the check here is just for a clean error message before the round trip.
export async function adminSetIsAdmin(targetUserId, makeAdmin) {
  const { error } = await supabase.rpc("admin_set_is_admin", { target_user_id: targetUserId, make_admin: makeAdmin });
  if (error) throw error;
}

// Creator-only: grants or revokes Creator access for another user.
export async function adminSetIsCreator(targetUserId, makeCreator) {
  const { error } = await supabase.rpc("admin_set_is_creator", { target_user_id: targetUserId, make_creator: makeCreator });
  if (error) throw error;
}

// Admin-only: usage snapshot for every user — last opened (app load),
// last set logged (actual workout activity), and a derived status
// bucket. Calls a security-definer function (migration_048) since
// auth.users isn't reachable from the client directly.
export async function adminGetUserActivity() {
  const { data, error } = await supabase.rpc("admin_get_user_activity");
  if (error) throw error;
  return data;
}

// Admin-only: aggregate counts of "How did you hear about us?" responses
// from the setup wizard's referral-source field, for judging which
// marketing channel is actually bringing people in. Calls a
// security-definer function (migration_052) since profiles has no select
// policy for other users' rows.
export async function adminGetReferralSources() {
  const { data, error } = await supabase.rpc("admin_get_referral_sources");
  if (error) throw error;
  return data;
}

// Stamps "last opened" for the current user. Fire-and-forget on app
// load — failures here shouldn't block or surface to the user, it's
// just a usage signal, not something the app depends on functionally.
export async function logAppOpen() {
  const { error } = await supabase.rpc("log_app_open");
  if (error) throw error;
}

// Fetches the sets logged for this exercise in the user's most recent
// *completed* workout. Replaces the hardcoded `lastWeek` array on each
// library item — this is what makes the reps/lbs comparison badges real.
export async function fetchLastSession(userId, exerciseId) {
  const { data: lastWorkoutExercise, error: findErr } = await supabase
    .from("workout_exercises")
    .select("id, workouts!inner(user_id, completed_at)")
    .eq("exercise_id", exerciseId)
    .eq("workouts.user_id", userId)
    .not("workouts.completed_at", "is", null)
    .order("workouts(completed_at)", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findErr) throw findErr;
  if (!lastWorkoutExercise) return [];

  const { data: sets, error: setsErr } = await supabase
    .from("sets")
    .select("weight, reps, rir, set_number, is_warmup")
    .eq("workout_exercise_id", lastWorkoutExercise.id)
    .order("set_number");

  if (setsErr) throw setsErr;
  return (sets || []).map((s) => ({ weight: s.weight, reps: s.reps, rir: s.rir, set_number: s.set_number, isWarmup: !!s.is_warmup }));
}

// Counts how many completed workouts have included this exercise, ever.
// Drives the "X sessions / Not performed" line in the exercise picker.
export async function fetchSessionCount(userId, exerciseId) {
  const { count, error } = await supabase
    .from("workout_exercises")
    .select("id, workouts!inner(user_id, completed_at)", { count: "exact", head: true })
    .eq("exercise_id", exerciseId)
    .eq("workouts.user_id", userId)
    .not("workouts.completed_at", "is", null);
  if (error) throw error;
  return count || 0;
}

// Bundles the three async lookups needed whenever an exercise enters a
// workout: last session's sets, session count, and any saved notes/setup.
// Called from addExercise / replaceExercise / generateWorkout / initial load.
export async function hydrateExercise(userId, normalizedExercise) {
  const [lastWeek, sessions, defaults] = await Promise.all([
    fetchLastSession(userId, normalizedExercise.id),
    fetchSessionCount(userId, normalizedExercise.id),
    fetchExerciseDefaults(userId, normalizedExercise.id),
  ]);
  const unit = getPrefs().units;
  return {
    ...normalizedExercise,
    targetWeight: toDisplay(normalizedExercise.targetWeight, unit),
    lastWeek: lastWeek.map((s) => ({ ...s, weight: toDisplay(s.weight, unit) })),
    sessions,
    savedNotes: defaults.notes,
    savedSetup: defaults.setup,
    savedRestSeconds: defaults.rest_seconds,
    savedWarmupRestSeconds: defaults.warmup_rest_seconds,
  };
}

// Starts a new workout session and returns its id.
export async function startWorkout(userId, ideology) {
  const { data, error } = await supabase
    .from("workouts")
    .insert({ user_id: userId, ideology })
    .select()
    .single();
  if (error) throw error;
  return data.id;
}

// Adds an exercise slot to a workout (mirrors `newItem` in the prototype).
export async function addWorkoutExercise(workoutId, exerciseId, position, plannedSets, notes = "", supersetGroup = null, plannedWarmupSets = 0) {
  const { data, error } = await supabase
    .from("workout_exercises")
    .insert({ workout_id: workoutId, exercise_id: exerciseId, position, planned_sets: plannedSets, notes, superset_group: supersetGroup, planned_warmup_sets: plannedWarmupSets })
    .select()
    .single();
  if (error) throw error;
  return data.id;
}

// Sets (or clears, with null) which superset group a workout exercise
// slot belongs to. Exercises sharing a group are performed back-to-back.
export async function setWorkoutExerciseSuperset(weId, supersetGroup) {
  const { error } = await supabase
    .from("workout_exercises")
    .update({ superset_group: supersetGroup })
    .eq("id", weId);
  if (error) throw error;
}

// Removes a single exercise slot from an in-progress workout (its logged
// sets cascade-delete with it). Mirrors deleteWorkout's cascade behavior
// but scoped to one slot, so "remove exercise" mid-workout actually
// survives a refresh instead of the exercise silently reappearing.
export async function removeWorkoutExercise(weId) {
  const { error } = await supabase.from("workout_exercises").delete().eq("id", weId);
  if (error) throw error;
}

// Persists a new exercise order after a mid-workout drag reorder.
// Mirrors reorderTemplates — same fire-and-forget batch update by id.
export async function reorderWorkoutExercises(orderedWeIds) {
  await Promise.all(orderedWeIds.map((id, i) => supabase.from("workout_exercises").update({ position: i }).eq("id", id)));
}

// Updates the planned set count for one workout exercise slot.
export async function updateWorkoutExercisePlanned(weId, plannedSets) {
  const { error } = await supabase
    .from("workout_exercises")
    .update({ planned_sets: plannedSets })
    .eq("id", weId);
  if (error) throw error;
}

// Updates the planned warmup-set count for one workout exercise slot.
export async function updateWorkoutExerciseWarmupPlanned(weId, plannedWarmupSets) {
  const { error } = await supabase
    .from("workout_exercises")
    .update({ planned_warmup_sets: plannedWarmupSets })
    .eq("id", weId);
  if (error) throw error;
}

// Logs a single set. Called from `saveSet` in the prototype.
export async function logSet(workoutExerciseId, setNumber, weight, reps, rir, isWarmup = false) {
  const { error } = await supabase
    .from("sets")
    .insert({ workout_exercise_id: workoutExerciseId, set_number: setNumber, weight, reps, rir, is_warmup: isWarmup });
  if (error) throw error;
}

// Updates a previously logged set (the "Edit" flow on a SetCard).
export async function updateSet(workoutExerciseId, setNumber, weight, reps, rir, isWarmup) {
  const payload = { weight, reps, rir };
  if (isWarmup !== undefined) payload.is_warmup = isWarmup; // omit to leave existing flag untouched
  const { error } = await supabase
    .from("sets")
    .update(payload)
    .eq("workout_exercise_id", workoutExerciseId)
    .eq("set_number", setNumber);
  if (error) throw error;
}

// Toggles a set's warmup flag without touching weight/reps/rir — the
// click-to-mark-warmup interaction on the set number badge, and the
// assign/unassign control in the workout history edit menu.
export async function setSetWarmup(workoutExerciseId, setNumber, isWarmup) {
  const { error } = await supabase
    .from("sets")
    .update({ is_warmup: isWarmup })
    .eq("workout_exercise_id", workoutExerciseId)
    .eq("set_number", setNumber);
  if (error) throw error;
}

// Deletes a single logged set (used for retroactive edits to a past
// workout) and renumbers whatever came after it down by one, so set
// numbers stay contiguous starting from 1 — the rest of the app assumes
// that invariant when logging new sets.
export async function deleteSet(workoutExerciseId, setNumber) {
  const { error: delErr } = await supabase
    .from("sets")
    .delete()
    .eq("workout_exercise_id", workoutExerciseId)
    .eq("set_number", setNumber);
  if (delErr) throw delErr;

  const { data: rest, error: fetchErr } = await supabase
    .from("sets")
    .select("set_number")
    .eq("workout_exercise_id", workoutExerciseId)
    .gt("set_number", setNumber)
    .order("set_number");
  if (fetchErr) throw fetchErr;

  for (const row of rest || []) {
    const { error } = await supabase
      .from("sets")
      .update({ set_number: row.set_number - 1 })
      .eq("workout_exercise_id", workoutExerciseId)
      .eq("set_number", row.set_number);
    if (error) throw error;
  }
}

// Marks a workout complete (drives the "Finish workout" button).
export async function completeWorkout(workoutId) {
  const { error } = await supabase
    .from("workouts")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", workoutId);
  if (error) throw error;
}

// Deletes a workout entirely (drives "Cancel workout"). workout_exercises
// and sets cascade-delete automatically via their foreign keys.
export async function deleteWorkout(workoutId) {
  const { error } = await supabase.from("workouts").delete().eq("id", workoutId);
  if (error) throw error;
}

// Creates a custom exercise scoped to this user only (created_by is set,
// and the RLS policy on `exercises` keeps it out of other users' views).
// Fetches the user's profile (gender/DOB/weight), used both to gate
// onboarding and to compute DOTS scores. Returns null if not set up yet.
export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveProfile(userId, { gender, dateOfBirth, weight, weightUnit, height, heightUnit, firstName, lastName, heardAboutUs }) {
  const payload = { id: userId, gender, date_of_birth: dateOfBirth, weight, weight_unit: weightUnit || "lb", updated_at: new Date().toISOString() };
  if (height !== undefined) payload.height = height;
  if (heightUnit !== undefined) payload.height_unit = heightUnit || "in";
  if (firstName !== undefined) payload.first_name = firstName;
  if (lastName !== undefined) payload.last_name = lastName;
  if (heardAboutUs !== undefined) payload.heard_about_us = heardAboutUs;
  const { error } = await supabase
    .from("profiles")
    .upsert(payload);
  if (error) throw error;
}

// Records terms & conditions acceptance. Called once from the terms
// gate in App.jsx before a user (new or existing) can reach Home.
export async function acceptTerms(userId) {
  const { error } = await supabase
    .from("profiles")
    .update({ terms_accepted_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export async function createCustomExercise(userId, { name, muscle, primaryMuscles, secondaryMuscles, equipment, mediaUrl }) {
  const { data, error } = await supabase
    .from("exercises")
    .insert({
      name,
      muscle_group: muscle,
      primary_muscles: primaryMuscles || [],
      equipment: equipment ? [equipment] : [],
      secondary_muscles: secondaryMuscles || [],
      target_weight: 0,
      setup_fields: [],
      created_by: userId,
      media_url: mediaUrl || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Uploads a demo photo/gif to the public exercise-media bucket and
// returns its public URL. Path is namespaced by user so RLS ownership
// checks (needed for later replace/delete) resolve correctly.
export async function uploadExerciseMedia(userId, file) {
  const ext = file.name.split(".").pop();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("exercise-media").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("exercise-media").getPublicUrl(path);
  return data.publicUrl;
}

// Progress photos — private per user, one per calendar date. Uploading
// again for the same date replaces the file (upsert) and the row.
export async function uploadProgressPhoto(userId, dateStr, file) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${dateStr}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("progress-photos").upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;
  const { error: rowError } = await supabase
    .from("progress_photos")
    .upsert({ user_id: userId, taken_on: dateStr, storage_path: path }, { onConflict: "user_id,taken_on" });
  if (rowError) throw rowError;
  return path;
}

// Returns { path, url } for a progress photo on a given date, or null
// if none exists. Bucket is private, so url is always a short-lived
// signed URL rather than a permanent public link.
export async function fetchProgressPhoto(userId, dateStr) {
  const { data, error } = await supabase
    .from("progress_photos")
    .select("storage_path")
    .eq("user_id", userId)
    .eq("taken_on", dateStr)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: signed, error: signError } = await supabase.storage
    .from("progress-photos")
    .createSignedUrl(data.storage_path, 3600);
  if (signError) throw signError;
  return { path: data.storage_path, url: signed.signedUrl };
}

export async function deleteProgressPhoto(userId, dateStr, storagePath) {
  await supabase.storage.from("progress-photos").remove([storagePath]);
  const { error } = await supabase
    .from("progress_photos")
    .delete()
    .eq("user_id", userId)
    .eq("taken_on", dateStr);
  if (error) throw error;
}

// The signed-in user's own active (non-archived) custom exercises, newest
// first, for the "My Custom Exercises" settings screen.
export async function fetchMyCustomExercises(userId) {
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .eq("created_by", userId)
    .eq("archived", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Archived custom exercises, for the "Archived Exercises" screen.
export async function fetchArchivedCustomExercises(userId) {
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .eq("created_by", userId)
    .eq("archived", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Edits a custom exercise the user owns. RLS (exercises_update_own)
// already restricts this to rows where created_by = the caller.
export async function updateCustomExercise(exerciseId, { name, muscle, primaryMuscles, secondaryMuscles, equipment, mediaUrl }) {
  const payload = {
    name,
    muscle_group: muscle,
    equipment: equipment ? [equipment] : [],
    media_url: mediaUrl,
  };
  if (primaryMuscles !== undefined) payload.primary_muscles = primaryMuscles;
  if (secondaryMuscles !== undefined) payload.secondary_muscles = secondaryMuscles;
  const { data, error } = await supabase
    .from("exercises")
    .update(payload)
    .eq("id", exerciseId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Deletes a custom exercise the user owns. Fails with a foreign-key
// violation (error.code "23503") if it's referenced by any logged
// workout_exercises row -- that's intentional, it stops a delete from
// silently orphaning real workout history. Callers should catch that
// code and explain rather than treat it as a generic failure.
export async function deleteCustomExercise(exerciseId) {
  const { error } = await supabase.from("exercises").delete().eq("id", exerciseId);
  if (error) throw error;
}

// Archiving is the way out of the delete-is-blocked case above: it hides
// the exercise from fetchExercises (the picker/library) everywhere,
// without touching any workout that already references it. Toggleable
// so a user can unarchive if they change their mind.
export async function setExerciseArchived(exerciseId, archived) {
  const { data, error } = await supabase
    .from("exercises")
    .update({ archived })
    .eq("id", exerciseId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Admin-only: every custom exercise (created_by not null) across all
// users that hasn't been reviewed yet, newest first, so an admin can see
// what people are adding and decide what's worth pulling into the
// shared library. Attaches the creator's first/last name (looked up
// separately rather than via an embedded select, since we can't rely on
// knowing the exact FK constraint name PostgREST would need) so the
// admin screen can show a real name instead of a raw user id.
export async function fetchCustomExercisesForReview() {
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .not("created_by", "is", null)
    .eq("admin_reviewed", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!data || data.length === 0) return data || [];

  const creatorIds = [...new Set(data.map((r) => r.created_by).filter(Boolean))];
  const { data: profilesData, error: profErr } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", creatorIds);
  if (profErr) throw profErr;
  const byId = new Map((profilesData || []).map((p) => [p.id, p]));
  return data.map((r) => {
    const p = byId.get(r.created_by);
    return { ...r, creator_first_name: p?.first_name || null, creator_last_name: p?.last_name || null };
  });
}

// Admin-only: pulls a user's custom exercise into the shared system
// library by clearing created_by. The existing select policy already
// makes created_by = null visible to everyone.
// Promotes a custom exercise submission to the shared library. Routed
// through a security-definer RPC (migration_033) rather than a plain
// update, since promotion also needs to consolidate every OTHER user's
// duplicate copy of the same exercise into this one (reassigning their
// workout history/templates/defaults, then removing the duplicate and
// notifying its creator) — not something a client-side update alone can
// do safely across other people's rows.
export async function promoteExerciseToLibrary(exerciseId) {
  const { error } = await supabase.rpc("admin_promote_exercise", { target_id: exerciseId });
  if (error) throw error;
}

// Admin-only: removes a custom exercise from the review queue without
// touching it in any way the creator would notice — it stays exactly as
// it was, just marked reviewed so it stops showing up for you. Routed
// through admin_dismiss_exercise_submission (migration_061) so the
// admin_reviewed flag, the submission-log update, and clearing every
// admin's "New custom exercise submitted" notice for this exercise all
// happen atomically — addressing a submission any of the three ways
// (promote/merge/dismiss) auto-clears its own review notification.
export async function dismissCustomExercise(exerciseId) {
  const { error } = await supabase.rpc("admin_dismiss_exercise_submission", { target_id: exerciseId });
  if (error) throw error;
}

// Appends a search alias to an exercise, case-insensitive de-duped —
// e.g. recording "Hamstring Curl" as an alias of "Machine Seated Leg
// Curl" so searching the former surfaces the latter everywhere the
// library is searched (picker, generator, etc).
export async function addExerciseAlias(exerciseId, alias) {
  const trimmed = (alias || "").trim();
  if (!trimmed) return;
  const { data: row, error: fetchErr } = await supabase
    .from("exercises")
    .select("aliases")
    .eq("id", exerciseId)
    .single();
  if (fetchErr) throw fetchErr;
  const existing = row.aliases || [];
  if (existing.some((a) => a.toLowerCase() === trimmed.toLowerCase())) return;
  const { error } = await supabase
    .from("exercises")
    .update({ aliases: [...existing, trimmed] })
    .eq("id", exerciseId);
  if (error) throw error;
}

// Admin-only: records a custom-exercise submission's name as a search
// alias of an existing library exercise, then marks the submission
// reviewed so it drops out of the queue. Deliberately does NOT touch
// created_by or delete anything — the submitter keeps their own copy
// exactly as it was; this only stops it from being treated as a
// separate exercise going forward (auto-promotion, future searches).
// Routed through admin_merge_exercise_alias (migration_055) so the
// alias write, the reviewed flag, the submission-log update, and the
// submitter's notification all happen atomically.
export async function mergeCustomExerciseAsAlias(submissionId, submissionName, targetExerciseId) {
  const { error } = await supabase.rpc("admin_merge_exercise_alias", { submission_id: submissionId, target_id: targetExerciseId });
  if (error) throw error;
}

// The signed-in user's own custom exercises that have since been
// resolved into the shared library, either by direct promotion or by
// being merged as an alias into an existing entry -- shown as a
// separate "Promoted Exercises" section in "My Custom Exercises" since
// fetchMyCustomExercises stops seeing them the moment created_by is
// cleared. Skips anything whose resolved exercise was later archived.
export async function fetchMyPromotedExercises(userId) {
  const { data, error } = await supabase
    .from("exercise_submissions")
    .select("id, submitted_name, status, resolved_at, exercise:current_exercise_id(id, name, muscle_group, equipment, media_url, archived)")
    .eq("user_id", userId)
    .in("status", ["promoted", "merged"])
    .not("current_exercise_id", "is", null)
    .order("resolved_at", { ascending: false });
  if (error) throw error;
  return (data || []).filter((r) => r.exercise && !r.exercise.archived);
}

// Admin-only: every custom exercise submission ever made, across every
// status (pending/dismissed/promoted/merged), for a browsable history --
// e.g. confirming an exercise was already promoted before merging a new
// duplicate into it, without relying on the merge-search picker alone.
export async function fetchAllExerciseSubmissions() {
  const { data, error } = await supabase
    .from("exercise_submissions")
    .select("id, submitted_name, muscle_group, equipment, status, created_at, resolved_at, user_id, exercise:current_exercise_id(id, name, muscle_group, equipment, media_url, archived, created_by)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const userIds = [...new Set(data.map((r) => r.user_id).filter(Boolean))];
  const { data: profilesData, error: profErr } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", userIds);
  if (profErr) throw profErr;
  const byId = new Map((profilesData || []).map((p) => [p.id, p]));
  return data.map((r) => {
    const p = byId.get(r.user_id);
    return { ...r, submitter_first_name: p?.first_name || null, submitter_last_name: p?.last_name || null };
  });
}

// Admin-only: sets or replaces the demo photo/gif URL on any exercise
// (system or custom). Used both to seed the library and to fix up a
// promoted custom exercise that didn't include one.
export async function setExerciseMedia(exerciseId, mediaUrl) {
  const { error } = await supabase
    .from("exercises")
    .update({ media_url: mediaUrl })
    .eq("id", exerciseId);
  if (error) throw error;
}

// Admin-only: every feedback/bug/feature-request submission, newest
// first.
export async function fetchFeedbackForAdmin() {
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Admin actions on a submission. All four go through the same RLS
// policy (feedback_update_admin / feedback_delete_admin), which only
// lets someone with profiles.is_admin touch these rows at all.
export async function setFeedbackFlagged(id, flagged) {
  const { error } = await supabase.from("feedback").update({ flagged, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function setFeedbackStatus(id, status) {
  const { error } = await supabase.from("feedback").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function setFeedbackNote(id, note) {
  const { error } = await supabase.from("feedback").update({ admin_note: note, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteFeedback(id) {
  const { error } = await supabase.from("feedback").delete().eq("id", id);
  if (error) throw error;
}

// Gets/sets persisted notes + setup fields for an exercise, replacing
// the in-memory `exerciseMeta` state.
export async function fetchExerciseDefaults(userId, exerciseId) {
  const { data, error } = await supabase
    .from("exercise_defaults")
    .select("setup, notes, rest_seconds, warmup_rest_seconds")
    .eq("user_id", userId)
    .eq("exercise_id", exerciseId)
    .maybeSingle();
  if (error) throw error;
  return data || { setup: {}, notes: "", rest_seconds: null, warmup_rest_seconds: null };
}

export async function saveExerciseDefaults(userId, exerciseId, setup, notes, restSeconds, warmupRestSeconds) {
  const payload = { user_id: userId, exercise_id: exerciseId, setup, notes };
  if (restSeconds !== undefined) payload.rest_seconds = restSeconds; // omit to leave existing value untouched
  if (warmupRestSeconds !== undefined) payload.warmup_rest_seconds = warmupRestSeconds; // omit to leave existing value untouched
  const { error } = await supabase.from("exercise_defaults").upsert(payload);
  if (error) throw error;
}

// Saves the post-workout capture screen (body weight + session notes).
export async function saveWorkoutSummary(workoutId, bodyWeight, sessionNotes) {
  const { error } = await supabase
    .from("workouts")
    .update({ body_weight: bodyWeight, session_notes: sessionNotes })
    .eq("id", workoutId);
  if (error) throw error;
}

// Saves the current workout as a reusable template. When includeDetails is
// false, only the exercise list and set count are saved (notes/setup reset
// to defaults) — a blank-slate template. When true, current notes/setup are
// carried over as the template's defaults.
export async function saveWorkoutAsTemplate(userId, name, workoutItems, includeDetails) {
  const { data: existing, error: countErr } = await supabase
    .from("workout_templates")
    .select("position")
    .eq("user_id", userId)
    .order("position", { ascending: false })
    .limit(1);
  if (countErr) throw countErr;
  const nextPosition = existing && existing.length > 0 ? (existing[0].position ?? 0) + 1 : 0;

  const { data: template, error: templateErr } = await supabase
    .from("workout_templates")
    .insert({ user_id: userId, name, position: nextPosition })
    .select()
    .single();
  if (templateErr) throw templateErr;

  const rows = workoutItems.map((w, i) => ({
    template_id: template.id,
    exercise_id: w.id,
    position: i,
    planned_sets: w.planned,
    planned_warmup_sets: w.plannedWarmup || 0,
    notes: includeDetails ? w.notes || "" : "",
    setup: includeDetails ? w.setup || {} : {},
    superset_group: w.supersetGroup ?? null,
  }));
  const { error: rowsErr } = await supabase.from("template_exercises").insert(rows);
  if (rowsErr) throw rowsErr;
  return template.id;
}

// Lists templates for the picker, with an exercise count for each.
export async function fetchTemplates(userId) {
  const { data, error } = await supabase
    .from("workout_templates")
    .select("id, name, created_at, position, template_exercises(count)")
    .eq("user_id", userId)
    .eq("archived", false)
    .order("position", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((t) => ({ ...t, exerciseCount: t.template_exercises?.[0]?.count || 0 }));
}

// Archived templates, for the "Archived Templates" screen.
export async function fetchArchivedTemplates(userId) {
  const { data, error } = await supabase
    .from("workout_templates")
    .select("id, name, created_at, template_exercises(count)")
    .eq("user_id", userId)
    .eq("archived", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((t) => ({ ...t, exerciseCount: t.template_exercises?.[0]?.count || 0 }));
}

// Archiving hides a template from the main list and the "start from
// template" flow without deleting it. Toggleable so it can be brought back.
export async function setTemplateArchived(templateId, archived) {
  const { error } = await supabase.from("workout_templates").update({ archived }).eq("id", templateId);
  if (error) throw error;
}

// Persists a manually-reordered template list. orderedIds is the full
// list of template ids in their new display order.
export async function reorderTemplates(orderedIds) {
  await Promise.all(orderedIds.map((id, i) => supabase.from("workout_templates").update({ position: i }).eq("id", id)));
}

// Fetches a template's exercises in order, ready to be added to a new workout.
export async function fetchTemplateExercises(templateId) {
  const { data, error } = await supabase
    .from("template_exercises")
    .select("exercise_id, planned_sets, planned_warmup_sets, notes, setup, superset_group")
    .eq("template_id", templateId)
    .order("position");
  if (error) throw error;
  return data;
}

// Fetches a template's name and exercises with full exercise details
// (name, muscle, etc.), shaped for the template builder's `picks` state —
// used to pre-fill the editor when someone edits an existing template.
export async function fetchTemplateForEdit(templateId) {
  const { data: template, error: templateErr } = await supabase
    .from("workout_templates")
    .select("id, name")
    .eq("id", templateId)
    .single();
  if (templateErr) throw templateErr;

  const { data: rows, error: rowsErr } = await supabase
    .from("template_exercises")
    .select("planned_sets, planned_warmup_sets, superset_group, exercises (*)")
    .eq("template_id", templateId)
    .order("position");
  if (rowsErr) throw rowsErr;

  return {
    id: template.id,
    name: template.name,
    picks: rows.map((row) => {
      const ex = normalizeExercise(row.exercises);
      return { id: ex.id, name: ex.name, short: ex.short, muscle: ex.muscle, primaryMuscles: ex.primaryMuscles, secondaryMuscles: ex.secondaryMuscles, planned: row.planned_sets, plannedWarmup: row.planned_warmup_sets || 0, supersetGroup: row.superset_group };
    }),
  };
}

// Renames a template and replaces its exercise list wholesale — simpler
// and safer than diffing, since the builder UI already gives us the full
// desired exercise set every time.
export async function updateTemplate(templateId, name, picks) {
  const { error: renameErr } = await supabase.from("workout_templates").update({ name }).eq("id", templateId);
  if (renameErr) throw renameErr;
  const { error: delErr } = await supabase.from("template_exercises").delete().eq("template_id", templateId);
  if (delErr) throw delErr;
  const rows = picks.map((p, i) => ({ template_id: templateId, exercise_id: p.id, position: i, planned_sets: p.planned, planned_warmup_sets: p.plannedWarmup || 0, notes: "", setup: {}, superset_group: p.supersetGroup ?? null }));
  const { error: insErr } = await supabase.from("template_exercises").insert(rows);
  if (insErr) throw insErr;
}

export async function deleteTemplate(templateId) {
  const { error } = await supabase.from("workout_templates").delete().eq("id", templateId);
  if (error) throw error;
}

function generateShareCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O, 1/I/L
  let code = "";
  for (let i = 0; i < 7; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Exports a template as a short share code someone else can paste into
// "Import template" to add it to their own account. Snapshots the
// exercise list at export time — later edits to the original don't
// change codes already handed out.
export async function exportTemplate(userId, templateId) {
  const { data: template, error: templateErr } = await supabase
    .from("workout_templates")
    .select("name")
    .eq("id", templateId)
    .single();
  if (templateErr) throw templateErr;

  const { data: rows, error: rowsErr } = await supabase
    .from("template_exercises")
    .select("exercise_id, planned_sets, planned_warmup_sets, position")
    .eq("template_id", templateId)
    .order("position");
  if (rowsErr) throw rowsErr;

  const exercises = rows.map((r) => ({ exercise_id: r.exercise_id, planned_sets: r.planned_sets, planned_warmup_sets: r.planned_warmup_sets || 0 }));

  // Retry on the unlikely chance of a code collision (unique constraint).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateShareCode();
    const { error } = await supabase.from("shared_templates").insert({ code, name: template.name, exercises, created_by: userId });
    if (!error) return code;
    if (error.code !== "23505") throw error;
  }
  throw new Error("Couldn't generate a unique share code — try again.");
}

// Looks up a share code and returns its name + exercise picks (shaped
// like the template builder's `picks` state) for the import preview.
// Exercises the current user can't see — someone else's custom exercise,
// since the library itself isn't shared, only the template shape — are
// silently dropped; skippedCount tells the import screen how many.
export async function fetchSharedTemplate(code) {
  const { data, error } = await supabase
    .rpc("get_shared_template_by_code", { p_code: (code || "").trim().toUpperCase() });
  if (error) throw error;
  const shared = data && data[0];
  if (!shared) return null;

  const exerciseIds = shared.exercises.map((e) => e.exercise_id);
  const { data: exRows, error: exErr } = exerciseIds.length
    ? await supabase.from("exercises").select("*").in("id", exerciseIds)
    : { data: [], error: null };
  if (exErr) throw exErr;
  const byId = new Map(exRows.map((r) => [r.id, r]));

  const picks = shared.exercises
    .filter((e) => byId.has(e.exercise_id))
    .map((e) => {
      const ex = normalizeExercise(byId.get(e.exercise_id));
      return { id: ex.id, name: ex.name, short: ex.short, muscle: ex.muscle, primaryMuscles: ex.primaryMuscles, secondaryMuscles: ex.secondaryMuscles, planned: e.planned_sets, plannedWarmup: e.planned_warmup_sets || 0 };
    });

  return { name: shared.name, picks, skippedCount: shared.exercises.length - picks.length };
}

// Creates a new template in the importer's own account from a fetched
// shared template's picks — same `picks` shape saveWorkoutAsTemplate and
// updateTemplate already use.
export async function importSharedTemplate(userId, name, picks) {
  const { data: existing, error: countErr } = await supabase
    .from("workout_templates")
    .select("position")
    .eq("user_id", userId)
    .order("position", { ascending: false })
    .limit(1);
  if (countErr) throw countErr;
  const nextPosition = existing && existing.length > 0 ? (existing[0].position ?? 0) + 1 : 0;

  const { data: template, error: templateErr } = await supabase
    .from("workout_templates")
    .insert({ user_id: userId, name, position: nextPosition })
    .select()
    .single();
  if (templateErr) throw templateErr;

  const rows = picks.map((p, i) => ({ template_id: template.id, exercise_id: p.id, position: i, planned_sets: p.planned, planned_warmup_sets: p.plannedWarmup || 0 }));
  const { error: insErr } = await supabase.from("template_exercises").insert(rows);
  if (insErr) throw insErr;
  return template.id;
}

// Submits a bug report or feature request. `context` is a free-text hint
// about where in the app this came from (e.g. "settings", "workout
// menu"), useful for triage but not required.
export async function submitFeedback(userId, type, message, context) {
  const { error } = await supabase.from("feedback").insert({ user_id: userId, type, message, context: context || null });
  if (error) throw error;
}

// Fetches completed workouts since a given date, with nested sets and each
// exercise's muscle info, for the volume chart, muscle heatmap, and
// calendar view on the home dashboard. One query, computed client-side.
// Finds the user's most recent workout that was never finished (no
// completed_at) or deleted, and returns everything needed to rebuild the
// in-progress session exactly as it was: exercises in order, their
// planned set counts, and any sets already logged. Used on app load so
// backgrounding the browser mid-workout (which can fully unload the page
// on mobile) never loses where someone was.
export async function fetchActiveWorkout(userId) {
  const { data: workout, error } = await supabase
    .from("workouts")
    .select("id, ideology, started_at")
    .eq("user_id", userId)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!workout) return null;

  const { data: exRows, error: exErr } = await supabase
    .from("workout_exercises")
    .select("id, position, planned_sets, planned_warmup_sets, superset_group, exercises (*), sets (set_number, weight, reps, rir, is_warmup)")
    .eq("workout_id", workout.id)
    .order("position");
  if (exErr) throw exErr;

  // An empty in-progress workout (e.g. someone backed out before adding
  // anything) isn't worth resuming into — treat it as if none exists.
  if (!exRows || exRows.length === 0) return null;

  return {
    id: workout.id,
    ideology: workout.ideology,
    startedAt: workout.started_at,
    exerciseRows: exRows.map((row) => ({
      weId: row.id,
      plannedSets: row.planned_sets,
      plannedWarmupSets: row.planned_warmup_sets,
      supersetGroup: row.superset_group,
      exercise: normalizeExercise(row.exercises),
      sets: [...row.sets].sort((a, b) => a.set_number - b.set_number).map((s) => ({ weight: toDisplay(Number(s.weight), getPrefs().units), reps: s.reps, rir: s.rir, isWarmup: !!s.is_warmup })),
    })),
  };
}

export async function fetchWorkoutHistory(userId, sinceISO) {
  let query = supabase
    .from("workouts")
    .select(`
      id, started_at, completed_at, body_weight, session_notes,
      workout_exercises (
        id, exercise_id, position,
        exercises ( name, muscle_group, primary_muscles, secondary_muscles, media_url ),
        sets ( set_number, weight, reps, rir, is_warmup )
      )
    `)
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: true });

  if (sinceISO) query = query.gte("completed_at", sinceISO);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Computes the current day-streak of completed workouts. A single missed
// day (a rest day) doesn't break the streak — e.g. Mon + Wed still counts
// as a 2-day streak. Missing two consecutive days resets it to 0. This
// applies both to the gap since the most recent workout and to gaps
// between earlier sessions in the streak.
export async function fetchStreak(userId) {
  const { data, error } = await supabase
    .from("workouts")
    .select("completed_at")
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false });
  if (error) throw error;

  const days = [...new Set(data.map((w) => toLocalDateStr(w.completed_at)))].sort().reverse();
  if (days.length === 0) return 0;

  const dayMs = 1000 * 60 * 60 * 24;
  const toDate = (s) => new Date(`${s}T00:00:00`);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // More than one full rest day since the last session (2+ days missed)
  // kills the streak entirely.
  const gapFromToday = Math.round((today - toDate(days[0])) / dayMs);
  if (gapFromToday > 2) return 0;

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const gap = Math.round((toDate(days[i - 1]) - toDate(days[i])) / dayMs);
    if (gap <= 2) streak++; // 1-day gap = one rest day, streak continues
    else break;
  }
  return streak;
}

// Returns the set of exercise IDs the user has starred as favorites.
// Favorites are surfaced first in exercise pickers throughout the app.
export async function fetchFavoriteExerciseIds(userId) {
  const { data, error } = await supabase
    .from("exercise_defaults")
    .select("exercise_id")
    .eq("user_id", userId)
    .eq("is_favorite", true);
  if (error) throw error;
  return new Set(data.map((r) => r.exercise_id));
}

// Toggles the favorite flag for one exercise. Uses upsert so favoriting an
// exercise that has no saved notes/setup yet still works, and only touches
// the is_favorite column on existing rows (notes/setup are left alone).
export async function setFavoriteExercise(userId, exerciseId, isFavorite) {
  const { error } = await supabase
    .from("exercise_defaults")
    .upsert({ user_id: userId, exercise_id: exerciseId, is_favorite: isFavorite }, { onConflict: "user_id,exercise_id" });
  if (error) throw error;
}

// Wipes every trace of this user's data: all workouts (and their
// exercises/sets via cascade), templates, saved exercise defaults
// (including favorites), any custom exercises they created, progress
// photos, and their profile. After this the person is dropped back into
// onboarding and has to re-enter gender/DOB/weight/height from scratch —
// this is intentional, it's a full reset, not a partial one. Note this
// keeps the login itself; for deleting the account too, see
// deleteOwnAccount() below.
export async function resetAllUserData(userId) {
  const { error: workoutsErr } = await supabase.from("workouts").delete().eq("user_id", userId);
  if (workoutsErr) throw workoutsErr;

  const { error: templatesErr } = await supabase.from("workout_templates").delete().eq("user_id", userId);
  if (templatesErr) throw templatesErr;

  const { error: defaultsErr } = await supabase.from("exercise_defaults").delete().eq("user_id", userId);
  if (defaultsErr) throw defaultsErr;

  // Only removes exercises this user personally created — the shared
  // library (created_by is null) is untouched.
  const { error: customErr } = await supabase.from("exercises").delete().eq("created_by", userId);
  if (customErr) throw customErr;

  // Progress photos are keyed to the login (auth.users), not the profile
  // row, so they'd otherwise survive a reset. Clean up the storage files
  // first, then the DB rows.
  try {
    await emptyUserStorageFolder("progress-photos", userId);
  } catch { /* best-effort — don't block the reset on a storage hiccup */ }
  const { error: photosErr } = await supabase.from("progress_photos").delete().eq("user_id", userId);
  if (photosErr) throw photosErr;

  const { error: profileErr } = await supabase.from("profiles").delete().eq("id", userId);
  if (profileErr) throw profileErr;
}

// Removes every file a user has in a given storage bucket, under their
// own userId-prefixed folder. Used by deleteOwnAccount() below — files
// aren't cleaned up by the database cascade when the account itself is
// deleted, so this has to happen first, via the Storage API, while the
// user's session (and their storage RLS ownership) is still valid.
async function emptyUserStorageFolder(bucket, userId) {
  const { data: files, error: listErr } = await supabase.storage.from(bucket).list(userId);
  if (listErr) throw listErr;
  if (!files || files.length === 0) return;
  const paths = files.map((f) => `${userId}/${f.name}`);
  const { error: removeErr } = await supabase.storage.from(bucket).remove(paths);
  if (removeErr) throw removeErr;
}

// Full, permanent account deletion — not just data, the login itself.
// Cleans up storage files first (the DB cascade on the auth.users row
// doesn't touch Storage), then calls the delete_own_account() Postgres
// function, which removes every remaining row across every table and
// finally deletes the auth.users row. After this resolves, the caller
// is responsible for signing out client-side (see Home.jsx) — the
// session's JWT stays technically valid until it expires even though
// the account behind it is gone.
export async function deleteOwnAccount(userId) {
  await emptyUserStorageFolder("progress-photos", userId);
  await emptyUserStorageFolder("exercise-media", userId);
  const { error } = await supabase.rpc("delete_own_account");
  if (error) throw error;
}

// Admin-only: count of feedback/bug/feature/privacy submissions created
// since the admin last opened the Feedback & Bugs screen, for the
// notification badge in Settings. Pass null for sinceDate to count
// everything (an admin who's never opened the screen yet).
export async function fetchUnseenFeedbackCount(sinceDate) {
  let query = supabase.from("feedback").select("id", { count: "exact", head: true });
  if (sinceDate) query = query.gt("created_at", sinceDate);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

// Marks the current moment as "seen" for the admin badge, called when
// an admin opens the Feedback & Bugs screen.
export async function markFeedbackViewed(userId) {
  const { error } = await supabase
    .from("profiles")
    .update({ feedback_last_viewed_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

// Personal, per-user notices (e.g. "your custom exercise was promoted").
// Merged into the same Announcements panel as the global broadcast list
// so there's one place to check, rather than a second unread indicator.
export async function fetchMyNotifications(userId) {
  const { data, error } = await supabase
    .from("user_notifications")
    .select("id, message, created_at, read_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

export async function markNotificationsRead(userId) {
  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
}

// Dismisses a single personal notification for good -- unlike read_at
// (which just clears the unread dot), this removes it from the list
// entirely. Safe as an outright delete since these rows are owned by
// exactly one person to begin with.
export async function dismissNotification(id) {
  const { error } = await supabase.from("user_notifications").delete().eq("id", id);
  if (error) throw error;
}

// The current user's set of dismissed announcement ids, so the panel
// (and the unseen-dot check) can filter them out. Announcements are a
// single shared row per broadcast, so dismissal can't touch the row
// itself -- it's tracked per (announcement, user) instead.
export async function fetchDismissedAnnouncementIds(userId) {
  const { data, error } = await supabase
    .from("announcement_dismissals")
    .select("announcement_id")
    .eq("user_id", userId);
  if (error) throw error;
  return (data || []).map((r) => r.announcement_id);
}

// Dismisses a global announcement for just this user. Upserted (not a
// plain insert) so dismissing something already dismissed is a no-op
// instead of a duplicate-key error.
export async function dismissAnnouncementForUser(announcementId, userId) {
  const { error } = await supabase
    .from("announcement_dismissals")
    .upsert({ announcement_id: announcementId, user_id: userId }, { onConflict: "announcement_id,user_id" });
  if (error) throw error;
}

// Newest-first list of admin announcements for the announcements panel.
// Non-admins only ever see non-archived rows (also enforced by RLS);
// pass includeArchived to also pull archived ones for the admin-only
// archive view.
export async function fetchAnnouncements({ includeArchived = false } = {}) {
  let query = supabase
    .from("announcements")
    .select("id, message, created_at, updated_at, author_id, archived, poll")
    .order("created_at", { ascending: false })
    .limit(50);
  if (!includeArchived) query = query.eq("archived", false);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Admin-only: posts a new announcement, broadcast to every user. `poll`
// is optional: { question, options: [{ id, label }] }, or null.
export async function postAnnouncement(userId, message, poll = null) {
  const { error } = await supabase.from("announcements").insert({ author_id: userId, message, poll });
  if (error) throw error;
}

// Admin-only: edits an existing announcement's message and/or poll.
export async function updateAnnouncement(id, { message, poll } = {}) {
  const payload = { updated_at: new Date().toISOString() };
  if (message !== undefined) payload.message = message;
  if (poll !== undefined) payload.poll = poll;
  const { error } = await supabase.from("announcements").update(payload).eq("id", id);
  if (error) throw error;
}

// Admin-only: archives or unarchives an announcement instead of deleting
// it outright, so past posts and their poll results aren't lost.
export async function setAnnouncementArchived(id, archived) {
  const { error } = await supabase.from("announcements").update({ archived }).eq("id", id);
  if (error) throw error;
}

export async function deleteAnnouncement(id) {
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw error;
}

// Raw poll votes for a set of announcement ids, used to compute per-option
// tallies and the current user's own vote client-side.
export async function fetchPollVotes(announcementIds) {
  if (!announcementIds || announcementIds.length === 0) return [];
  const { data, error } = await supabase
    .from("announcement_poll_votes")
    .select("announcement_id, user_id, option_id")
    .in("announcement_id", announcementIds);
  if (error) throw error;
  return data;
}

// Casts or changes the current user's vote on a poll — upserts on the
// (announcement_id, user_id) primary key so re-voting moves the vote
// instead of erroring.
export async function castPollVote(announcementId, userId, optionId) {
  const { error } = await supabase
    .from("announcement_poll_votes")
    .upsert({ announcement_id: announcementId, user_id: userId, option_id: optionId }, { onConflict: "announcement_id,user_id" });
  if (error) throw error;
}

// Marks the current moment as "seen" for the home-screen announcements
// dot, called when someone opens the announcements panel.
export async function markAnnouncementsViewed(userId) {
  const { error } = await supabase
    .from("profiles")
    .update({ announcements_last_viewed_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

// One exercise's full set history across completed workouts, for the
// per-exercise weight/reps/volume charts in the Exercise Library. Mirrors
// fetchExercisePRBaselines' workouts!inner join pattern, but keeps
// completed_at per row (for date bucketing) instead of collapsing to a
// single baseline.
export async function fetchExerciseHistory(userId, exerciseId) {
  const { data, error } = await supabase
    .from("workout_exercises")
    .select("sets(weight, reps, is_warmup), workouts!inner(user_id, completed_at)")
    .eq("exercise_id", exerciseId)
    .eq("workouts.user_id", userId)
    .not("workouts.completed_at", "is", null);
  if (error) throw error;
  return data;
}


// single-set volume from completed workouts only — the workout currently
// being finished is excluded explicitly (belt-and-suspenders alongside the
// completed_at filter, since the caller fetches this before marking the
// current workout complete). Used to detect PRs on the workout summary.
export async function fetchExercisePRBaselines(userId, exerciseIds, excludeWorkoutId) {
  if (!exerciseIds || exerciseIds.length === 0) return {};
  let query = supabase
    .from("workout_exercises")
    .select("exercise_id, workout_id, sets(weight, reps, is_warmup), workouts!inner(user_id, completed_at)")
    .eq("workouts.user_id", userId)
    .not("workouts.completed_at", "is", null)
    .in("exercise_id", exerciseIds);
  if (excludeWorkoutId) query = query.neq("workout_id", excludeWorkoutId);

  const { data, error } = await query;
  if (error) throw error;

  const baselines = {};
  for (const row of data) {
    const id = row.exercise_id;
    if (!baselines[id]) baselines[id] = { maxWeight: 0, maxReps: 0, maxSetVolume: 0 };
    for (const s of row.sets || []) {
      if (s.is_warmup) continue;
      const vol = (s.weight || 0) * (s.reps || 0);
      if (s.weight > baselines[id].maxWeight) baselines[id].maxWeight = s.weight;
      if (s.reps > baselines[id].maxReps) baselines[id].maxReps = s.reps;
      if (vol > baselines[id].maxSetVolume) baselines[id].maxSetVolume = vol;
    }
  }
  return baselines;
}

// Shares a completed workout as a public link. `snapshot` is a plain
// object built by the caller (WorkoutHistory) with everything needed to
// render it read-only — exercise names, set-by-set detail, totals — so
// the viewer needs no login and no join back to the owner's live data.
export async function shareWorkout(userId, snapshot) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateShareCode();
    const { error } = await supabase.from("shared_workouts").insert({ code, snapshot, created_by: userId });
    if (!error) return code;
    if (error.code !== "23505") throw error;
  }
  throw new Error("Couldn't generate a unique share code — try again.");
}

// Public fetch by code — works with no session, for anyone who opens a
// share link. Returns null if the code doesn't exist.
export async function fetchSharedWorkout(code) {
  const { data, error } = await supabase
    .rpc("get_shared_workout_by_code", { p_code: (code || "").trim().toUpperCase() });
  if (error) throw error;
  return data && data[0] ? data[0].snapshot : null;
}

// Real percentile rank (0-100) of the current user's all-time best DOTS
// score against every other eligible user's all-time best DOTS score.
// Computed server-side (see migration_008_dots_percentile.sql) so no
// other user's raw data ever reaches the client. Returns null if the
// person isn't eligible yet (no gender/weight, no completed lift) or the
// comparison pool is too small to be meaningful.
export async function fetchDotsPercentile() {
  const { data, error } = await supabase.rpc("get_dots_percentile");
  if (error) throw error;
  return data;
}

// The signed-in user's weekly set targets per muscle group, backing the
// My Plan home module. Returns a plain { [muscle_group]: weekly_target_sets }
// map (not the raw rows) since that's the shape every caller wants —
// missing muscle groups just aren't in the map, callers fall back to a
// sensible default rather than this function inventing one.
export async function fetchMuscleGroupTargets(userId) {
  const { data, error } = await supabase
    .from("muscle_group_targets")
    .select("muscle_group, weekly_target_sets")
    .eq("user_id", userId);
  if (error) throw error;
  const map = {};
  for (const row of data || []) map[row.muscle_group] = row.weekly_target_sets;
  return map;
}

// Upserts a single muscle group's weekly set target (one row per
// muscle_group per user). Called per-slider on My Plan, debounced
// client-side so dragging a slider doesn't fire a write per tick.
export async function saveMuscleGroupTarget(userId, muscleGroup, weeklyTargetSets) {
  const { error } = await supabase
    .from("muscle_group_targets")
    .upsert({ user_id: userId, muscle_group: muscleGroup, weekly_target_sets: weeklyTargetSets, updated_at: new Date().toISOString() });
  if (error) throw error;
}
