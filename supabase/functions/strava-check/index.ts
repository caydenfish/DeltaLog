// Two ways to call this:
//
//  1. Immediate mode -- POST { workout_id } with the caller's own
//     Supabase auth header. Called by the client right after
//     completeWorkout() succeeds. Runs the first check; if nothing
//     matches yet, leaves the workout "pending" for the cron retry
//     rather than giving up after one look (Strava/Garmin sync can lag
//     a few minutes).
//
//  2. Batch mode -- POST {} (no workout_id), guarded by the
//     x-cron-secret header instead of a user auth header. Invoked
//     every minute by the pg_cron job in migration_072. Processes
//     every strava_link_status row whose next_check_at has passed --
//     this is the ~3-minute delayed retry, and it runs regardless of
//     whether the person still has the app open.
//
// Matching is deliberately time-window-only, not activity-type-based:
// checking "did *any* activity land in this window" rather than
// special-casing Garmin/Apple Watch/etc.'s different type strings is
// what makes this work the same for every device a person might be
// wearing -- the whole point is never needing to know which watch
// synced it.

import { serviceClient, getValidAccessToken, jsonResponse, buildSetSummary, appendDescription, requireUser } from "../_shared/strava.ts";

const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
const MATCH_WINDOW_SEC = 5 * 60; // 5 minutes either side of the workout's own start/end
const RETRY_DELAY_MS = 3 * 60 * 1000;

async function findMatchingActivity(accessToken: string, startedAt: string, completedAt: string | null) {
  const after = Math.floor(new Date(startedAt).getTime() / 1000) - MATCH_WINDOW_SEC;
  const before = Math.floor(new Date(completedAt || startedAt).getTime() / 1000) + MATCH_WINDOW_SEC;
  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${after}&before=${before}&per_page=30`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Strava activities lookup failed: ${res.status}`);
  const activities = await res.json();
  return Array.isArray(activities) && activities.length > 0 ? activities[0] : null;
}

// Runs one check for one workout, transitioning strava_link_status
// accordingly. `isRetry` is whether this is the delayed second look
// (as opposed to the immediate first one) -- only a failed retry
// gives up and flips to "unlinked"; a failed first check just sets up
// the retry instead of giving up immediately, since sync lag of a few
// minutes is normal and expected.
async function checkWorkout(supabase: ReturnType<typeof serviceClient>, workoutId: string, userId: string, isRetry: boolean) {
  const accessToken = await getValidAccessToken(supabase, userId);
  if (!accessToken) return; // disconnected between the immediate check and the retry

  const { data: workout } = await supabase
    .from("workouts")
    .select("started_at, completed_at")
    .eq("id", workoutId)
    .maybeSingle();
  if (!workout) return;

  const match = await findMatchingActivity(accessToken, workout.started_at, workout.completed_at);
  const now = new Date().toISOString();

  if (match) {
    const summary = await buildSetSummary(supabase, workoutId);
    await appendDescription(accessToken, match.id, summary);
    await supabase.from("strava_link_status").upsert({
      workout_id: workoutId, user_id: userId, status: "matched",
      strava_activity_id: match.id, checked_at: now, next_check_at: null, updated_at: now,
    });
    return;
  }

  if (isRetry) {
    await supabase.from("strava_link_status").upsert({
      workout_id: workoutId, user_id: userId, status: "unlinked",
      checked_at: now, next_check_at: null, updated_at: now,
    });
  } else {
    await supabase.from("strava_link_status").upsert({
      workout_id: workoutId, user_id: userId, status: "pending",
      checked_at: now, next_check_at: new Date(Date.now() + RETRY_DELAY_MS).toISOString(), updated_at: now,
    });
  }
}

Deno.serve(async (req) => {
  const supabase = serviceClient();
  const body = await req.json().catch(() => ({}));

  if (body.workout_id) {
    // Immediate mode -- identify the caller from their own auth header
    // rather than trusting a user_id in the body.
    const user = await requireUser(supabase, req);
    if (!user) return jsonResponse({ error: "unauthorized" }, 401);

    // Silently no-op for someone who isn't connected -- never surface
    // any Strava UI/state for an account that never opted in.
    const accessToken = await getValidAccessToken(supabase, user.id);
    if (!accessToken) return jsonResponse({ skipped: "not_connected" });

    await checkWorkout(supabase, body.workout_id, user.id, false);
    return jsonResponse({ ok: true });
  }

  // Batch mode -- the cron job, guarded by a shared secret instead of
  // a user session (there isn't one; this runs on a schedule).
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }
  const { data: due } = await supabase
    .from("strava_link_status")
    .select("workout_id, user_id")
    .eq("status", "pending")
    .lte("next_check_at", new Date().toISOString());
  for (const row of due || []) {
    await checkWorkout(supabase, row.workout_id, row.user_id, true).catch(() => {
      // One workout's failure (e.g. a since-revoked Strava grant)
      // shouldn't block the rest of the batch.
    });
  }
  return jsonResponse({ checked: (due || []).length });
});
