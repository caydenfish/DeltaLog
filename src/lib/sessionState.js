// Persists small bits of in-progress-workout UI state (which screen, which
// exercise, the rest timer) to localStorage, keyed by workout id. This is
// what lets a refresh/backgrounding/app-relaunch drop someone back exactly
// where they left off instead of resetting to the top of the workout.
//
// Deliberately NOT used for workout content itself (exercise list, sets,
// order) — that's persisted straight to Supabase via queries.js so it's
// durable across devices too. This module is purely ephemeral client UI
// state that would be annoying, not dangerous, to lose.

const KEY_PREFIX = "dl_session_";

export function saveSessionState(workoutId, state) {
  if (!workoutId) return;
  try {
    localStorage.setItem(KEY_PREFIX + workoutId, JSON.stringify(state));
  } catch {
    // localStorage can throw in private-browsing/quota-exceeded edge cases;
    // losing the UI-resume convenience isn't worth surfacing an error for.
  }
}

export function loadSessionState(workoutId) {
  if (!workoutId) return null;
  try {
    const raw = localStorage.getItem(KEY_PREFIX + workoutId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSessionState(workoutId) {
  if (!workoutId) return;
  try {
    localStorage.removeItem(KEY_PREFIX + workoutId);
  } catch {
    // no-op
  }
}
