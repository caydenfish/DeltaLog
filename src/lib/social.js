import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

// Friends, user IDs (handles) and live group workouts (migration_076).
// Other people's names and handles only ever come back through the
// security definer RPCs, never a direct profiles read.

function rpcError(error) {
  // Postgres `raise exception` messages are written for people; pass them through.
  return new Error(error?.message || "Something went wrong");
}

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw rpcError(error);
  return data;
}

// ── Handles ─────────────────────────────────────────────────────────
export const HANDLE_PATTERN = /^[a-z0-9][a-z0-9_.]{2,19}$/;
export function normalizeHandle(raw) {
  return String(raw || "").trim().replace(/^@+/, "").toLowerCase();
}
export async function fetchMyHandle(userId) {
  const { data, error } = await supabase.from("profiles").select("handle, first_name").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data || { handle: null, first_name: null };
}
export function setMyHandle(handle) {
  return rpc("set_my_handle", { p_handle: normalizeHandle(handle) });
}

// ── Friends ─────────────────────────────────────────────────────────
export function searchUsersByHandle(query) {
  return rpc("search_users_by_handle", { p_query: normalizeHandle(query) }).then((r) => r || []);
}
export function sendFriendRequest(userId) {
  return rpc("send_friend_request", { p_target: userId });
}
export function respondFriendRequest(friendshipId, accept) {
  return rpc("respond_friend_request", { p_friendship: friendshipId, p_accept: accept });
}
export async function removeFriendship(friendshipId) {
  const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
  if (error) throw error;
}
// -> { friends, incoming, outgoing }, friends sorted by most recent workout
export async function fetchFriends() {
  const rows = (await rpc("get_my_friends")) || [];
  const friends = rows.filter((r) => r.status === "accepted")
    .sort((a, b) => (b.last_workout_at || "").localeCompare(a.last_workout_at || "") || displayName(a).localeCompare(displayName(b)));
  return {
    friends,
    incoming: rows.filter((r) => r.status === "pending" && r.direction === "incoming"),
    outgoing: rows.filter((r) => r.status === "pending" && r.direction === "outgoing"),
  };
}
export function displayName(p) {
  if (!p) return "";
  const first = (p.first_name || "").trim();
  if (!first) return p.handle ? `@${p.handle}` : "Friend";
  return p.last_initial ? `${first} ${p.last_initial}.` : first;
}
export function initialOf(p) {
  return ((p && (p.first_name || p.handle)) || "?").trim().charAt(0).toUpperCase();
}

// Stable per-person color, so someone keeps the same chip color across
// screens. Distinct in lightness as well as hue, and never the accent.
const FRIEND_COLORS = ["#5B9DFF", "#3FC7B4", "#B98CFF", "#E8B04B", "#F07FB2", "#9AD45E", "#7FD3F0"];
export function colorFor(userId) {
  let h = 0;
  for (const c of String(userId || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return FRIEND_COLORS[h % FRIEND_COLORS.length];
}

export function lastLiftedLabel(iso) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Lifted today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return "A while ago";
}

// ── Saved groups ────────────────────────────────────────────────────
export async function fetchFriendGroups(userId) {
  const { data, error } = await supabase.from("friend_groups").select("id, name, member_ids").eq("owner_id", userId).order("created_at");
  if (error) throw error;
  return data || [];
}
export async function saveFriendGroup(userId, name, memberIds) {
  const { data, error } = await supabase.from("friend_groups").insert({ owner_id: userId, name, member_ids: memberIds }).select().single();
  if (error) throw error;
  return data;
}
export async function deleteFriendGroup(groupId) {
  const { error } = await supabase.from("friend_groups").delete().eq("id", groupId);
  if (error) throw error;
}

// ── Group sessions ──────────────────────────────────────────────────
export function createGroupSession(friendIds) {
  return rpc("create_group_session", { p_friend_ids: friendIds });
}
export function joinGroupSession(sessionId, workoutId = null) {
  return rpc("join_group_session", { p_session: sessionId, p_workout: workoutId });
}
export function attachGroupWorkout(sessionId, workoutId) {
  return rpc("attach_group_workout", { p_session: sessionId, p_workout: workoutId });
}
export function leaveGroupSession(sessionId, status = "finished") {
  return rpc("leave_group_session", { p_session: sessionId, p_status: status });
}
export function fetchGroupInvites() {
  return rpc("get_my_group_invites").then((r) => r || []);
}
export function fetchGroupSessionForWorkout(workoutId) {
  return rpc("get_group_session_for_workout", { p_workout: workoutId });
}
// Lobby (v1.20.0, migration_077)
export function inviteToGroupSession(sessionId, friendIds) {
  return rpc("invite_to_group_session", { p_session: sessionId, p_friend_ids: friendIds });
}
export function setGroupPlan(sessionId, plan) {
  return rpc("set_group_plan", { p_session: sessionId, p_plan: plan });
}
export function startGroupSession(sessionId) {
  return rpc("start_group_session", { p_session: sessionId });
}
export function setGroupHostExercises(sessionId, exercises) {
  return rpc("set_group_host_exercises", { p_session: sessionId, p_exercises: exercises });
}
export function fetchMyOpenLobby() {
  return rpc("get_my_open_lobby");
}
export function fetchGroupSessionMembers(sessionId) {
  return rpc("get_group_session_members", { p_session: sessionId }).then((r) => r || []);
}
// -> { id, host_id, status, plan, host_exercises, started_at } or null
export async function fetchGroupSession(sessionId) {
  const { data, error } = await supabase.from("group_sessions")
    .select("id, host_id, status, plan, host_exercises, started_at").eq("id", sessionId).maybeSingle();
  if (error) throw error;
  return data;
}
export function planLabel(plan) {
  if (!plan || plan.kind !== "template") return "From scratch";
  return plan.name || "Template";
}
export async function publishGroupLift(sessionId, userId, exerciseId, sets) {
  const { error } = await supabase.from("group_session_lifts").upsert(
    { session_id: sessionId, user_id: userId, exercise_id: exerciseId, sets, updated_at: new Date().toISOString() },
    { onConflict: "session_id,user_id,exercise_id" }
  );
  if (error) throw error;
}

// Live view of a session: members (with names) and every member's lifts.
// Realtime pushes changes; a full refetch runs on subscribe, when the app
// comes back to the foreground and when the connection returns, so a
// dropped socket at the gym never leaves gaps.
// -> { session, members, lifts: { [userId]: { [exerciseId]: sets[] } }, refresh }
// session is the group_sessions row (status, plan, host_exercises).
export function useGroupSession(sessionId) {
  const [session, setSession] = useState(null);
  const [members, setMembers] = useState([]);
  const [lifts, setLifts] = useState({});
  const refreshRef = useRef(() => {});

  useEffect(() => {
    if (!sessionId) { setSession(null); setMembers([]); setLifts({}); return; }
    let cancelled = false;

    async function loadMembers() {
      try {
        const m = await rpc("get_group_session_members", { p_session: sessionId });
        if (!cancelled) setMembers(m || []);
      } catch { /* keep last known */ }
    }
    async function loadLifts() {
      const { data, error } = await supabase.from("group_session_lifts").select("user_id, exercise_id, sets").eq("session_id", sessionId);
      if (error || cancelled) return;
      const next = {};
      for (const row of data || []) (next[row.user_id] ||= {})[row.exercise_id] = row.sets || [];
      setLifts(next);
    }
    async function loadSession() {
      try {
        const row = await fetchGroupSession(sessionId);
        if (!cancelled && row) setSession(row);
      } catch { /* keep last known */ }
    }
    function refresh() { loadSession(); loadMembers(); loadLifts(); }
    refreshRef.current = refresh;
    refresh();

    const channel = supabase
      .channel(`group-session-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_session_lifts", filter: `session_id=eq.${sessionId}` }, (payload) => {
        const row = payload.new && payload.new.user_id ? payload.new : null;
        if (!row) { loadLifts(); return; }
        setLifts((prev) => ({ ...prev, [row.user_id]: { ...(prev[row.user_id] || {}), [row.exercise_id]: row.sets || [] } }));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_session_members", filter: `session_id=eq.${sessionId}` }, () => loadMembers())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "group_sessions", filter: `id=eq.${sessionId}` }, (payload) => {
        if (payload.new && payload.new.id) setSession((prev) => ({ ...(prev || {}), ...payload.new }));
        else loadSession();
      })
      .subscribe((status) => { if (status === "SUBSCRIBED") refresh(); });

    function onVisible() { if (document.visibilityState === "visible") refresh(); }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refresh);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refresh);
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return { session, members, lifts, refresh: () => refreshRef.current() };
}

// ── Strength math ───────────────────────────────────────────────────
// Same estimate SetLogger uses for its own Best e1RM (RIR-adjusted
// effective reps; Brzycki-style up to 6, Epley above). Sets whose
// effective reps pass 12 are left out: rep-max formulas lose accuracy
// quickly beyond that range, and a light burnout set shouldn't outrank
// a real working set. Warmups are excluded.
export const GROUP_E1RM_MAX_EFFECTIVE_REPS = 12;
export function groupE1RM(weight, reps, rir) {
  const eff = (reps || 0) + (rir || 0);
  if (eff <= 0 || weight <= 0 || eff > GROUP_E1RM_MAX_EFFECTIVE_REPS) return 0;
  if (eff === 1) return weight;
  if (eff <= 6) return weight / (1.0278 - 0.0278 * eff);
  return weight * (1 + eff / 30);
}
export function bestGroupE1RM(sets) {
  let best = 0;
  for (const s of sets || []) if (!s.warm) best = Math.max(best, groupE1RM(s.w, s.r, s.rir));
  return best;
}

// ── Sharing ─────────────────────────────────────────────────────────
export const APP_URL = "https://deltalog.vercel.app";

// Invite links (v1.19.1): deltalog.vercel.app/?add=<handle>. Opening one
// remembers the ID (through sign-up and setup if needed) and shows an
// "Add friend" screen once the person reaches Home.
const PENDING_ADD_KEY = "deltalog.pendingAdd";
export function inviteLink(handle) {
  return handle ? `${APP_URL}/?add=${encodeURIComponent(handle)}` : APP_URL;
}
// Call once at startup: moves ?add=… out of the URL into storage.
export function capturePendingAdd() {
  try {
    const params = new URLSearchParams(window.location.search);
    const h = normalizeHandle(params.get("add"));
    if (!h) return;
    if (HANDLE_PATTERN.test(h)) localStorage.setItem(PENDING_ADD_KEY, h);
    params.delete("add");
    const q = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : "") + window.location.hash);
  } catch { /* storage or history unavailable: ignore */ }
}
export function getPendingAdd() {
  try { return localStorage.getItem(PENDING_ADD_KEY) || null; } catch { return null; }
}
export function clearPendingAdd() {
  try { localStorage.removeItem(PENDING_ADD_KEY); } catch { /* ignore */ }
}
// Exact-ID lookup built on the prefix search.
export async function findUserByHandle(handle) {
  const h = normalizeHandle(handle);
  const rows = await searchUsersByHandle(h);
  return rows.find((r) => (r.handle || "").toLowerCase() === h) || null;
}

export function inviteText(handle) {
  return handle
    ? `I'm logging my lifts on DeltaLog. Add me as a friend (@${handle}):`
    : "I'm logging my lifts on DeltaLog. Come lift with me.";
}
// Native share sheet where supported (iOS and Android both), clipboard
// otherwise. Resolves to "shared" | "copied" | "cancelled".
export async function shareDeltaLog({ title = "DeltaLog", text, url = APP_URL } = {}) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(text ? `${text} ${url}` : url);
    return "copied";
  } catch {
    return "cancelled";
  }
}

// Contact Picker API: Chrome on Android only at the time of writing; iOS
// Safari and desktop browsers don't expose it, so callers hide the
// contacts option when this is false.
export function contactsSupported() {
  return typeof navigator !== "undefined" && "contacts" in navigator && "ContactsManager" in window;
}
export async function pickContacts() {
  return navigator.contacts.select(["name", "tel", "email"], { multiple: true });
}
