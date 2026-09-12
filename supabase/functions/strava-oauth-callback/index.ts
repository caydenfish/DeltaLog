// GET /strava-oauth-callback?code=...&state=...
//
// This is the redirect_uri registered on the Strava API application.
// The client never talks to this function directly -- it's reached
// only via the browser following Strava's redirect after the person
// approves the connection on Strava's own consent screen.
//
// `state` is a single-use token minted by the client (inserted into
// strava_oauth_state right before redirecting to Strava) rather than
// the user's own id or JWT, so a guessed/replayed state can't be used
// to attach someone else's Strava account to your user id -- it has
// to be a token this server itself issued for this specific user,
// and it's deleted the moment it's consumed.

import { serviceClient } from "../_shared/strava.ts";

const STRAVA_CLIENT_ID = Deno.env.get("STRAVA_CLIENT_ID")!;
const STRAVA_CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET")!;
// Where to send the browser back to once this is done -- DeltaLog's
// own deployed URL, e.g. https://deltalog.vercel.app
const APP_URL = Deno.env.get("APP_URL")!;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error"); // e.g. "access_denied" if they declined

  if (error) {
    return Response.redirect(`${APP_URL}/?strava=denied`, 302);
  }
  if (!code || !state) {
    return Response.redirect(`${APP_URL}/?strava=error`, 302);
  }

  const supabase = serviceClient();

  const { data: stateRow } = await supabase
    .from("strava_oauth_state")
    .select("user_id, created_at")
    .eq("token", state)
    .maybeSingle();

  // Single-use: delete on read regardless of outcome, so a replayed
  // callback URL (e.g. from browser history) can never succeed twice.
  if (stateRow) {
    await supabase.from("strava_oauth_state").delete().eq("token", state);
  }
  // 10-minute validity -- long enough for a normal consent-screen
  // round trip, short enough that a stale/abandoned state can't be
  // reused much later.
  const stale = stateRow && Date.now() - new Date(stateRow.created_at).getTime() > 10 * 60 * 1000;
  if (!stateRow || stale) {
    return Response.redirect(`${APP_URL}/?strava=error`, 302);
  }
  const userId = stateRow.user_id;

  const tokenRes = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    return Response.redirect(`${APP_URL}/?strava=error`, 302);
  }
  const tok = await tokenRes.json();

  await supabase.from("strava_tokens").upsert({
    user_id: userId,
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    expires_at: new Date(tok.expires_at * 1000).toISOString(),
    athlete_id: tok.athlete?.id,
    scope: url.searchParams.get("scope") || null,
    updated_at: new Date().toISOString(),
  });

  await supabase.from("strava_connections").upsert({
    user_id: userId,
    athlete_id: tok.athlete?.id,
    athlete_name: [tok.athlete?.firstname, tok.athlete?.lastname].filter(Boolean).join(" ") || null,
    connected_at: new Date().toISOString(),
  });

  return Response.redirect(`${APP_URL}/?strava=connected`, 302);
});
