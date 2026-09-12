import { supabase } from "./supabaseClient";

// Public Strava application client id (safe in client code -- the
// secret half of the OAuth exchange only ever lives in the
// strava-oauth-callback edge function's environment).
const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID;

// Reads the non-secret connection mirror (strava_connections) rather
// than strava_tokens, which the client has no RLS access to at all --
// see migration_072.
export async function fetchStravaConnection(userId) {
  const { data } = await supabase.from("strava_connections").select("athlete_name, connected_at").eq("user_id", userId).maybeSingle();
  return data || null;
}

// Kicks off the OAuth connect flow: mints a single-use state token
// (see strava_oauth_state in migration_072) tied to this user, then
// sends the browser to Strava's own consent screen. Strava redirects
// back to strava-oauth-callback with that same state, which is what
// lets the callback attach the resulting tokens to the right account
// without ever trusting a user id passed through the URL directly.
export async function connectStrava(userId) {
  const { data, error } = await supabase.from("strava_oauth_state").insert({ user_id: userId }).select("token").single();
  if (error) throw error;
  const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strava-oauth-callback`;
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: "activity:write,activity:read",
    state: data.token,
  });
  window.location.href = `https://www.strava.com/oauth/authorize?${params.toString()}`;
}

export async function disconnectStrava() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");
  const { error } = await supabase.functions.invoke("strava-disconnect", {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) throw error;
}

// Fire-and-forget: called right after a workout finishes. No-ops
// silently (server-side) for anyone not connected, so this is safe to
// call unconditionally without checking connection status first.
export async function triggerStravaCheck(workoutId) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.functions.invoke("strava-check", {
      body: { workout_id: workoutId },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  } catch {
    // Best-effort -- a failed trigger just means the cron sweep or a
    // manual link later covers it instead.
  }
}

// Workouts currently sitting in "unlinked" (both checks came back with
// no match) -- what drives the manual-link banner on Home.
export async function fetchUnlinkedWorkouts(userId) {
  const { data } = await supabase
    .from("strava_link_status")
    .select("workout_id, created_at")
    .eq("user_id", userId)
    .eq("status", "unlinked")
    .order("created_at", { ascending: false });
  return data || [];
}

async function callManual(action, payload) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");
  const { data, error } = await supabase.functions.invoke("strava-manual", {
    body: { action, ...payload },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) throw error;
  return data;
}

export const listStravaActivitiesForDay = (workoutId) => callManual("list", { workout_id: workoutId });
export const linkStravaActivity = (workoutId, activityId) => callManual("link", { workout_id: workoutId, activity_id: activityId });
export const dismissStravaLink = (workoutId) => callManual("dismiss", { workout_id: workoutId });
