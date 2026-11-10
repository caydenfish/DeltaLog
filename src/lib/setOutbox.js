// Durable retry queue for set writes made during a live workout (v1.23.0).
//
// logSet/updateSet used to be fire-and-forget: if the request failed (gym
// dead zone, the phone waking with no network yet, an auth refresh
// mid-flight) the set stayed on screen with a 4-second "didn't sync"
// toast and was then gone for good the moment the page reloaded. Failed
// writes now land here, in localStorage, and get replayed until the
// server has them. fetchActiveWorkout also folds anything still queued
// back into the resumed workout, so a reload while offline doesn't hide
// sets that were logged.
//
// Each write is applied as an upsert keyed on (workout_exercise_id,
// set_number): if the row already exists it's updated, otherwise
// inserted. That makes replays idempotent even when the original
// request actually reached the server and only the response was lost.

import { supabase } from "./supabaseClient";

const KEY = "dl_pending_sets";
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function read() {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable; nothing more we can do
  }
}

const sameSlot = (a, b) => a.weId === b.weId && a.setNumber === b.setNumber;

// op: { weId, setNumber, weight (canonical), reps, rir, isWarmup }
export function queueSetWrite(op) {
  if (!op || !op.weId || !op.setNumber) return;
  const list = read().filter((x) => !sameSlot(x, op));
  list.push({ ...op, qid: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ts: Date.now() });
  write(list);
}

// Drops any queued write for a slot (set deleted / renumbered locally).
export function dropQueuedSet(weId, setNumber) {
  write(read().filter((x) => !(x.weId === weId && x.setNumber === setNumber)));
}

export function pendingSetWrites() {
  return read();
}

export function hasPendingSetWrites() {
  return read().length > 0;
}

function isPermanent(err) {
  // 23503: the workout_exercise row is gone (slot removed or workout
  // cancelled), so the set has nowhere to live. 22P02/23502: malformed.
  return !!err && (err.code === "23503" || err.code === "22P02" || err.code === "23502");
}

async function apply(op) {
  const payload = { weight: op.weight, reps: op.reps, rir: op.rir };
  if (op.isWarmup !== undefined && op.isWarmup !== null) payload.is_warmup = !!op.isWarmup;
  const { data: existing, error: selErr } = await supabase
    .from("sets")
    .select("id")
    .eq("workout_exercise_id", op.weId)
    .eq("set_number", op.setNumber)
    .limit(1);
  if (selErr) throw selErr;
  if (existing && existing.length > 0) {
    const { error } = await supabase.from("sets").update(payload).eq("id", existing[0].id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("sets")
      .insert({ workout_exercise_id: op.weId, set_number: op.setNumber, is_warmup: !!op.isWarmup, ...payload });
    if (error) throw error;
  }
}

let inFlight = null;

// Replays everything queued. Resolves to the number still pending.
// Concurrent callers share one run.
export function flushPendingSets() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const snapshot = read();
    if (snapshot.length === 0) return 0;
    const done = new Set();
    for (const op of snapshot) {
      if (Date.now() - (op.ts || 0) > MAX_AGE_MS) { done.add(op.qid); continue; }
      try {
        await apply(op);
        done.add(op.qid);
      } catch (err) {
        if (isPermanent(err)) done.add(op.qid);
        // Network-type failure: stop early, the rest will fail the same way.
        else if (!err || !err.code) break;
      }
    }
    // Re-read so writes queued while this ran aren't clobbered.
    const remaining = read().filter((x) => !done.has(x.qid));
    write(remaining);
    return remaining.length;
  })().finally(() => { inFlight = null; });
  return inFlight;
}
