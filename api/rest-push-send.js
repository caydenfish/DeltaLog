// POST /api/rest-push-send  (called by Upstash QStash, not the app)
// Sends the end-of-rest Web Push. QStash forwards the shared secret from
// /api/rest-push as the X-Deltalog-Secret header; anything without it is
// rejected.
//
// Env: PUSH_SEND_SECRET, VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT (e.g. mailto:you@example.com).
import webpush from "web-push";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const secret = process.env.PUSH_SEND_SECRET;
  if (!secret || req.headers["x-deltalog-secret"] !== secret) return res.status(401).end();

  const publicKey = process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return res.status(503).json({ error: "VAPID not configured" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const { subscription, title, body: text, tag } = body || {};
  if (!subscription || !subscription.endpoint) return res.status(400).end();

  webpush.setVapidDetails(subject, publicKey, privateKey);
  try {
    await webpush.sendNotification(subscription, JSON.stringify({ title, body: text, tag }), { TTL: 120, urgency: "high" });
  } catch (err) {
    // 404/410: the subscription is gone (app uninstalled, permission
    // revoked). Nothing to retry, so don't let QStash retry either.
    if (err && (err.statusCode === 404 || err.statusCode === 410)) return res.status(200).json({ gone: true });
    return res.status(500).json({ error: "Push failed" });
  }
  return res.status(200).json({ ok: true });
}
