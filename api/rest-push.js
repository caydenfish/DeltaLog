// POST /api/rest-push  (Vercel serverless function)
// { action: "schedule", subscription, endsAt, title, body, tag } -> { messageId }
// { action: "cancel", messageId } -> { ok: true }
//
// Authenticated with the caller's Supabase access token. Scheduling
// publishes a delayed message to Upstash QStash that calls
// /api/rest-push-send when the rest ends. The push subscription travels
// inside the message, so no subscriptions table is needed.
//
// Env (Vercel project settings): QSTASH_TOKEN, PUSH_SEND_SECRET,
// VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY. Optional: QSTASH_URL,
// PUBLIC_BASE_URL (defaults to this request's host).
import { createClient } from "@supabase/supabase-js";

const MAX_DELAY_SEC = 60 * 60; // a rest longer than an hour is not a rest

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { QSTASH_TOKEN, PUSH_SEND_SECRET } = process.env;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!QSTASH_TOKEN || !PUSH_SEND_SECRET || !supabaseUrl || !supabaseAnon) {
    return res.status(503).json({ error: "Rest push not configured" });
  }

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Missing token" });
  const supabase = createClient(supabaseUrl, supabaseAnon, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData || !userData.user) return res.status(401).json({ error: "Invalid token" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const qstashBase = (process.env.QSTASH_URL || "https://qstash.upstash.io").replace(/\/$/, "");

  if (body.action === "cancel") {
    if (typeof body.messageId !== "string" || !body.messageId) return res.status(400).json({ error: "messageId required" });
    // A message that already fired or never existed returns 404; either
    // way there's nothing left to cancel.
    await fetch(`${qstashBase}/v2/messages/${encodeURIComponent(body.messageId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${QSTASH_TOKEN}` },
    }).catch(() => {});
    return res.status(200).json({ ok: true });
  }

  if (body.action !== "schedule") return res.status(400).json({ error: "Unknown action" });

  const sub = body.subscription;
  if (!sub || typeof sub.endpoint !== "string" || !sub.endpoint.startsWith("https://") || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    return res.status(400).json({ error: "Invalid subscription" });
  }
  const endsAt = Number(body.endsAt);
  const delaySec = Math.round((endsAt - Date.now()) / 1000);
  if (!Number.isFinite(delaySec) || delaySec > MAX_DELAY_SEC) return res.status(400).json({ error: "Invalid endsAt" });

  const base = process.env.PUBLIC_BASE_URL || `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
  const destination = `${base.replace(/\/$/, "")}/api/rest-push-send`;
  const message = {
    subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
    title: String(body.title || "Rest's up").slice(0, 120),
    body: String(body.body || "").slice(0, 240),
    tag: String(body.tag || "deltalog-rest").slice(0, 60),
  };

  const qres = await fetch(`${qstashBase}/v2/publish/${destination}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${QSTASH_TOKEN}`,
      "Content-Type": "application/json",
      "Upstash-Delay": `${Math.max(0, delaySec)}s`,
      "Upstash-Retries": "1",
      "Upstash-Forward-X-Deltalog-Secret": PUSH_SEND_SECRET,
    },
    body: JSON.stringify(message),
  });
  if (!qres.ok) return res.status(502).json({ error: "Scheduling failed" });
  const out = await qres.json().catch(() => ({}));
  return res.status(200).json({ messageId: out.messageId || null });
}
