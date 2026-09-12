// POST { action: "list" | "link" | "dismiss", workout_id, activity_id? }
//
// Backs the manual-link modal that opens from the "couldn't find a
// matching Strava activity" notification -- for a workout that came
// back "unlinked" from strava-check (both the immediate check and the
// 3-minute retry found nothing, most often because sync from the
// watch itself hadn't finished, or ran on a delay strava-check's own
// window didn't cover).
//
//   list    -- activities for the *whole day* the workout happened on
//              (much wider than strava-check's 5-minute window), so a
//              person can pick the right one themselves.
//   link    -- same "fetch existing description, append DeltaLog's
//              summary, PUT it back" flow strava-check uses for an
//              automatic match, just against a person-chosen activity.
//   dismiss -- marks the prompt as closed without linking, so it
//              doesn't keep resurfacing for a workout no one's going
//              to bother linking (e.g. one done without any tracker
//              running at all).

import { serviceClient, getValidAccessToken, jsonResponse, buildSetSummary, appendDescription, requireUser } from "../_shared/strava.ts";

Deno.serve(async (req) => {
  const supabase = serviceClient();
  const user = await requireUser(supabase, req);
  if (!user) return jsonResponse({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const { action, workout_id, activity_id } = body;
  if (!workout_id) return jsonResponse({ error: "workout_id required" }, 400);

  // Every action is scoped to a workout this user actually owns --
  // link_status rows are keyed by workout_id but a mismatched user_id
  // here would mean acting on someone else's workout.
  const { data: link } = await supabase
    .from("strava_link_status")
    .select("user_id")
    .eq("workout_id", workout_id)
    .maybeSingle();
  if (!link || link.user_id !== user.id) return jsonResponse({ error: "not_found" }, 404);

  const accessToken = await getValidAccessToken(supabase, user.id);
  if (!accessToken) return jsonResponse({ error: "not_connected" }, 400);

  if (action === "list") {
    const { data: workout } = await supabase.from("workouts").select("started_at").eq("id", workout_id).maybeSingle();
    if (!workout) return jsonResponse({ error: "not_found" }, 404);
    const day = new Date(workout.started_at);
    const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${Math.floor(dayStart.getTime() / 1000)}&before=${Math.floor(dayEnd.getTime() / 1000)}&per_page=30`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return jsonResponse({ error: "strava_error" }, 502);
    const activities = await res.json();
    return jsonResponse({
      activities: (activities || []).map((a: any) => ({
        id: a.id, name: a.name, type: a.type, start_date: a.start_date, elapsed_time: a.elapsed_time,
      })),
    });
  }

  if (action === "link") {
    if (!activity_id) return jsonResponse({ error: "activity_id required" }, 400);
    const summary = await buildSetSummary(supabase, workout_id);
    await appendDescription(accessToken, activity_id, summary);
    await supabase.from("strava_link_status").update({
      status: "matched", strava_activity_id: activity_id, updated_at: new Date().toISOString(),
    }).eq("workout_id", workout_id);
    return jsonResponse({ ok: true });
  }

  if (action === "dismiss") {
    await supabase.from("strava_link_status").update({
      status: "skipped", updated_at: new Date().toISOString(),
    }).eq("workout_id", workout_id);
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "unknown_action" }, 400);
});
