// POST (no body) -- disconnects the calling user's Strava account.
// A dedicated function rather than another strava-manual action since
// it isn't scoped to a workout the way list/link/dismiss are.
//
// Actually revokes the grant with Strava (not just deleting our own
// copy of the token) so the connection also disappears from the
// "connected apps" list on the Strava side, rather than silently
// dangling there while DeltaLog just stops using it.

import { serviceClient, getValidAccessToken, jsonResponse, requireUser } from "../_shared/strava.ts";

Deno.serve(async (req) => {
  const supabase = serviceClient();
  const user = await requireUser(supabase, req);
  if (!user) return jsonResponse({ error: "unauthorized" }, 401);

  const accessToken = await getValidAccessToken(supabase, user.id);
  if (accessToken) {
    await fetch("https://www.strava.com/oauth/deauthorize", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => {
      // Revoke failing (e.g. Strava's already-revoked-it-themselves
      // case) shouldn't block clearing our own side.
    });
  }

  await supabase.from("strava_tokens").delete().eq("user_id", user.id);
  await supabase.from("strava_connections").delete().eq("user_id", user.id);

  return jsonResponse({ ok: true });
});
