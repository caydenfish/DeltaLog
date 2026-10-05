// Rest timer notifications (v1.14.0).
//
// Two pieces:
//  1. A silent "Resting until 2:41 PM" notification posted the moment a
//     rest starts, so a glance at the lock screen says when to go.
//     Web apps can't tick a live countdown in a notification, so it
//     shows the end time instead.
//  2. A server-scheduled push for the end of the rest, so the "rest's
//     up" alert arrives even when the phone is locked or the app is
//     backgrounded (the page's own timers are suspended then, so the
//     in-page alert can't fire). The flow: the app asks /api/rest-push
//     to schedule a delayed message on Upstash QStash; when the delay
//     runs out QStash calls /api/rest-push-send, which sends a Web Push
//     to this device; public/push-sw.js shows it. Skipping or changing
//     the rest cancels the scheduled message.
//
// Everything here fails quietly: no VAPID key configured, notifications
// denied, push unsupported (iOS needs the app installed to the home
// screen, iOS 16.4+), or the API unreachable all just mean no push --
// the in-app timer, sound and vibration still work.
import { supabase } from "./supabaseClient";
import { getNotificationPermission } from "./restTimerCues";

export const REST_TAG = "deltalog-rest";
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

async function getRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  try { return (await navigator.serviceWorker.getRegistration()) || null; } catch { return null; }
}

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSupported() {
  return !!VAPID_PUBLIC_KEY && typeof window !== "undefined" && "PushManager" in window && "serviceWorker" in navigator;
}

async function getSubscription() {
  if (!pushSupported() || getNotificationPermission() !== "granted") return null;
  const reg = await getRegistration();
  if (!reg || !reg.pushManager) return null;
  try {
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing;
    return await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
  } catch {
    return null;
  }
}

async function callApi(payload) {
  const { data } = await supabase.auth.getSession();
  const token = data && data.session && data.session.access_token;
  if (!token) return null;
  const res = await fetch("/api/rest-push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

// Schedules the end-of-rest push. Resolves to a message id (pass it to
// cancelRestPush) or null if push isn't available.
export async function scheduleRestPush({ endsAt, title, body }) {
  try {
    const subscription = await getSubscription();
    if (!subscription) return null;
    const result = await callApi({ action: "schedule", subscription: subscription.toJSON(), endsAt, title, body, tag: REST_TAG });
    return (result && result.messageId) || null;
  } catch {
    return null;
  }
}

export async function cancelRestPush(messageId) {
  if (!messageId) return;
  try { await callApi({ action: "cancel", messageId }); } catch { /* best effort */ }
}

// Silent, ongoing-style notification while resting. Same tag as the
// end-of-rest alert, so the alert replaces it instead of stacking.
export async function showRestingNotification({ endsAt, body }) {
  if (getNotificationPermission() !== "granted") return;
  const reg = await getRegistration();
  if (!reg) return;
  const time = new Date(endsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  try {
    await reg.showNotification(`Resting until ${time}`, { body, tag: REST_TAG, silent: true, renotify: false, icon: "/icon-192.png", badge: "/icon-192.png", data: { url: "/" } });
  } catch { /* nice-to-have */ }
}

export async function showRestDoneNotification({ title, body }) {
  if (getNotificationPermission() !== "granted") return;
  const reg = await getRegistration();
  if (!reg) return;
  try {
    await reg.showNotification(title, { body, tag: REST_TAG, renotify: true, icon: "/icon-192.png", badge: "/icon-192.png", data: { url: "/" } });
  } catch { /* nice-to-have */ }
}

export async function clearRestNotifications() {
  const reg = await getRegistration();
  if (!reg || !reg.getNotifications) return;
  try { (await reg.getNotifications({ tag: REST_TAG })).forEach((n) => n.close()); } catch { /* ignore */ }
}
