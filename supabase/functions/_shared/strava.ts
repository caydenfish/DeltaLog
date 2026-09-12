// Shared by strava-oauth-callback, strava-check, and strava-manual.
// Not deployed on its own -- Supabase's edge runtime bundles each
// function directory independently, so this just needs to sit
// somewhere importable via a relative path (../_shared/strava.ts).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

const STRAVA_CLIENT_ID = Deno.env.get("STRAVA_CLIENT_ID")!;
const STRAVA_CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET")!;

// Returns a valid access token for this user, refreshing it first if
// it's expired (or about to be, within a minute -- avoids a request
// landing right on the boundary and getting a 401 mid-flight). Updates
// strava_tokens in place whenever a refresh happens; callers never see
// or need to know a refresh occurred.
export async function getValidAccessToken(supabase: ReturnType<typeof serviceClient>, userId: string) {
  const { data: tok, error } = await supabase
    .from("strava_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!tok) return null; // not connected

  const expiresInMs = new Date(tok.expires_at).getTime() - Date.now();
  if (expiresInMs > 60_000) return tok.access_token;

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: tok.refresh_token,
    }),
  });
  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status}`);
  const refreshed = await res.json();

  await supabase.from("strava_tokens").update({
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  return refreshed.access_token;
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Builds the "logged with DeltaLog" note appended to a Strava
// activity's description -- exercise names plus each working set's
// weight×reps, skipping warmups. Shared by the auto-match path
// (strava-check) and the manual-link path (strava-manual) so both
// produce the same summary.
export async function buildSetSummary(supabase: ReturnType<typeof serviceClient>, workoutId: string) {
  const { data: rows } = await supabase
    .from("workout_exercises")
    .select("position, exercises(name, short), sets(set_number, weight, reps, is_warmup)")
    .eq("workout_id", workoutId)
    .order("position", { ascending: true });
  if (!rows || rows.length === 0) return "Logged with DeltaLog.";
  const lines = rows.map((r: any) => {
    const working = (r.sets || []).filter((s: any) => !s.is_warmup).sort((a: any, b: any) => a.set_number - b.set_number);
    if (working.length === 0) return null;
    const setsStr = working.map((s: any) => `${s.weight}×${s.reps}`).join(", ");
    return `${r.exercises?.short || r.exercises?.name}: ${setsStr}`;
  }).filter(Boolean);
  return `Logged with DeltaLog\n${lines.join("\n")}`;
}

// Appends (rather than overwrites) so a person's own notes on the
// Strava side -- added from their watch/the Strava app, or a caption
// they typed themselves -- are never clobbered.
export async function appendDescription(accessToken: string, activityId: number, addition: string) {
  const getRes = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!getRes.ok) throw new Error(`Strava activity fetch failed: ${getRes.status}`);
  const activity = await getRes.json();
  const existing = (activity.description || "").trim();
  const description = existing ? `${existing}\n\n${addition}` : addition;
  const putRes = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
  if (!putRes.ok) throw new Error(`Strava activity update failed: ${putRes.status}`);
}

// Identifies the calling user from their own Supabase auth header
// (rather than trusting a user_id passed in the request body) --
// shared by every function here that's called directly by the client.
export async function requireUser(supabase: ReturnType<typeof serviceClient>, req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const { data, error } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (error || !data?.user) return null;
  return data.user;
}
