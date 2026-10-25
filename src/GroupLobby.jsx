import { useEffect, useRef, useState } from "react";
import { IconChevronLeft, IconCheck, IconList, IconPlus, IconUsers } from "./Icons";
import { Avatar } from "./Friends";
import GroupWorkoutSheet from "./GroupWorkoutSheet";
import { useBackLayer } from "./lib/backNav";
import { fetchTemplates, fetchTemplateExercises } from "./lib/queries";
import { useGroupSession, setGroupPlan, startGroupSession, leaveGroupSession, displayName, planLabel } from "./lib/social";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
  ready: "#3FC7B4",
};
const condensed = "'Barlow Condensed', sans-serif";
const oneLine = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const label = { fontFamily: condensed, fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: T.dim, whiteSpace: "nowrap" };

// Group workout lobby (v1.20.0). Everyone lands here before lifting: the
// host picks the plan (from scratch or a template), watches friends go
// from Invited to Ready, and starts it for everyone. Members wait here
// and are dropped into the workout the moment the host starts.
//
// onStart(plan) fires once for every member when the session goes active
// (the host's own Start included). onExit(message?) fires after leaving,
// or when the host closes the lobby (with a message for members).
export default function GroupLobby({ user, sessionId, onStart, onExit }) {
  const { session, members } = useGroupSession(sessionId);
  const isHost = !!session && session.host_id === user.id;
  const plan = session?.plan || { kind: "scratch" };
  const [picking, setPicking] = useState(false);
  const [templates, setTemplates] = useState(null);
  const [savingPlan, setSavingPlan] = useState(null); // template id or "scratch"
  const [inviting, setInviting] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const startedRef = useRef(false);

  // Back closes the invite picker or plan list first, then asks before
  // leaving. Above Home's layers (10) since the lobby covers Home.
  useBackLayer(confirmLeave || picking || inviting ? 2 : 1, () => {
    if (inviting) setInviting(false);
    else if (picking) setPicking(false);
    else setConfirmLeave((v) => !v);
  }, 11);

  // Host started (or the session was already running): everyone goes in.
  useEffect(() => {
    if (!session || startedRef.current) return;
    if (session.status === "active") {
      startedRef.current = true;
      onStart(session.plan || { kind: "scratch" });
    } else if (session.status === "ended") {
      startedRef.current = true;
      onExit(isHost ? null : "The host closed the lobby");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status]);

  useEffect(() => {
    if (!isHost || templates !== null) return;
    fetchTemplates(user.id).then(setTemplates).catch(() => setTemplates([]));
  }, [isHost, user.id, templates]);

  async function choosePlan(t) {
    const key = t ? t.id : "scratch";
    setSavingPlan(key); setError(null);
    try {
      let next = { kind: "scratch" };
      if (t) {
        const rows = await fetchTemplateExercises(t.id);
        next = {
          kind: "template",
          template_id: t.id,
          name: t.name,
          // Snapshot without notes/setup: those are the host's personal
          // cues and machine settings, not part of the shared plan.
          exercises: rows.map((r) => ({
            exercise_id: r.exercise_id,
            planned_sets: r.planned_sets,
            planned_warmup_sets: r.planned_warmup_sets || 0,
            superset_group: r.superset_group ?? null,
            rep_scheme: r.rep_scheme || null,
          })),
        };
      }
      await setGroupPlan(sessionId, next);
      setPicking(false);
    } catch (e) {
      setError(e.message);
    }
    setSavingPlan(null);
  }

  async function start() {
    if (starting) return;
    setStarting(true); setError(null);
    try {
      await startGroupSession(sessionId);
      // The status change arrives over Realtime too; don't wait for it.
      if (!startedRef.current) { startedRef.current = true; onStart(plan); }
    } catch (e) {
      setError(e.message);
      setStarting(false);
    }
  }

  async function leave() {
    startedRef.current = true;
    try { await leaveGroupSession(sessionId, "declined"); } catch { /* still leave locally */ }
    onExit(null);
  }

  const host = members.find((m) => m.is_host);
  const hostName = host ? (host.first_name || displayName(host)) : "the host";
  const visible = members.filter((m) => m.status !== "declined");
  const readyCount = visible.filter((m) => m.status === "joined").length;
  const othersReady = visible.filter((m) => m.status === "joined" && m.user_id !== user.id).length;
  const exerciseCount = plan.kind === "template" ? (plan.exercises || []).length : 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 29, background: T.bg, display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 400, height: "100dvh", display: "flex", flexDirection: "column", paddingTop: "env(safe-area-inset-top, 0px)", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 12px 4px" }}>
          <button onClick={() => setConfirmLeave(true)} aria-label="Leave lobby" style={{ width: 44, height: 44, borderRadius: 10, border: "none", background: "transparent", color: T.text, display: "flex", alignItems: "center", justifyContent: "center" }}><IconChevronLeft size={22} /></button>
          <span style={{ fontFamily: condensed, fontSize: 26, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: T.text, ...oneLine }}>Group Workout</span>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 16px", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Plan */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={label}>Plan</span>
            {!picking ? (
              <button onClick={() => isHost && setPicking(true)} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 56, padding: "10px 14px", borderRadius: 12, border: `1px solid ${T.line}`, background: T.surface, color: T.text, textAlign: "left", cursor: isHost ? "pointer" : "default" }}>
                <span style={{ color: T.accent, display: "flex", flexShrink: 0 }}>{plan.kind === "template" ? <IconList size={18} /> : <IconPlus size={18} />}</span>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 15, fontWeight: 600, ...oneLine }}>{session ? planLabel(plan) : " "}</span>
                  <span style={{ fontSize: 12.5, color: T.dim, ...oneLine }}>
                    {plan.kind === "template"
                      ? `${exerciseCount} exercise${exerciseCount === 1 ? "" : "s"}, loaded for everyone`
                      : isHost ? "Exercises you add go to everyone" : `Exercises ${hostName} adds show up for you`}
                  </span>
                </span>
                {isHost && <span style={{ fontSize: 14, fontWeight: 600, color: T.accent, whiteSpace: "nowrap" }}>Change</span>}
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", borderRadius: 12, border: `1px solid ${T.line}`, background: T.surface, overflow: "hidden" }}>
                {[null, ...(templates || [])].map((t, i) => {
                  const on = t ? plan.kind === "template" && plan.template_id === t.id : plan.kind === "scratch";
                  const busy = savingPlan === (t ? t.id : "scratch");
                  return (
                    <button key={t ? t.id : "scratch"} onClick={() => choosePlan(t)} disabled={!!savingPlan} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 50, padding: "0 14px", border: "none", borderTop: i === 0 ? "none" : `1px solid ${T.surface2}`, background: "transparent", color: T.text, textAlign: "left", opacity: savingPlan && !busy ? 0.5 : 1 }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: on ? 700 : 500, ...oneLine }}>{t ? t.name : "From scratch"}</span>
                      <span style={{ fontSize: 12.5, color: T.dim, whiteSpace: "nowrap" }}>{busy ? "Saving..." : t ? `${t.exerciseCount} exercises` : ""}</span>
                      {on && !busy && <span style={{ color: T.accent, display: "flex" }}><IconCheck size={16} /></span>}
                    </button>
                  );
                })}
                {templates === null && <div style={{ padding: "12px 14px", fontSize: 13, color: T.dim }}>Loading templates...</div>}
              </div>
            )}
          </div>

          {/* Lifters */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ ...label, marginBottom: 6 }}>Lifters · {readyCount} of {visible.length} ready</span>
            {visible.map((m) => {
              const me = m.user_id === user.id;
              const ready = m.status === "joined";
              return (
                <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 52 }}>
                  <Avatar person={m} />
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: T.text, ...oneLine }}>{me ? "You" : displayName(m)}</span>
                    {m.handle && <span style={{ fontSize: 13, color: T.dim, ...oneLine }}>@{m.handle}</span>}
                  </span>
                  {m.is_host && <span style={pill(T.dim, T.line)}>Host</span>}
                  {!m.is_host && <span style={ready ? pill(T.ready, T.ready) : pill(T.dim, T.line)}>{ready ? "Ready" : "Invited"}</span>}
                </div>
              );
            })}
            {isHost && visible.length < 8 && (
              <button onClick={() => setInviting(true)} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 48, padding: 0, border: "none", background: "none", color: T.accent, fontSize: 15, fontWeight: 600 }}>
                <span style={{ width: 34, height: 34, borderRadius: 17, border: `1px dashed ${T.accent}`, display: "flex", alignItems: "center", justifyContent: "center" }}><IconPlus size={16} /></span>
                Invite more
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: "12px 16px calc(16px + env(safe-area-inset-bottom, 0px))", borderTop: `1px solid ${T.line}`, display: "flex", flexDirection: "column", gap: 10 }}>
          {error && <div style={{ fontSize: 12.5, color: T.accent, ...oneLine }}>{error}</div>}
          {confirmLeave ? (
            <>
              <div style={{ fontSize: 13, color: T.dim, textAlign: "center" }}>{isHost ? "Leaving closes the lobby for everyone." : "You can rejoin if the host invites you again."}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setConfirmLeave(false)} style={{ flex: 1, height: 50, borderRadius: 12, border: `1px solid ${T.line}`, background: T.surface, color: T.text, fontSize: 15, fontWeight: 600 }}>Stay</button>
                <button onClick={leave} style={{ flex: 1, height: 50, borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 15, fontWeight: 700, whiteSpace: "nowrap" }}>{isHost ? "Close lobby" : "Leave lobby"}</button>
              </div>
            </>
          ) : isHost ? (
            <>
              <div style={{ fontSize: 12.5, color: T.dim, textAlign: "center", ...oneLine }}>
                {othersReady === 0 ? "No one's ready yet. Friends can still join after you start." : "Anyone still invited can join after you start."}
              </div>
              <button onClick={start} disabled={starting || !session} style={{ height: 52, borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 16, fontWeight: 700, opacity: starting || !session ? 0.6 : 1, whiteSpace: "nowrap", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <IconUsers size={18} /> {starting ? "Starting..." : othersReady === 0 ? "Start now" : "Start for everyone"}
              </button>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 32, fontSize: 14, color: T.dim, whiteSpace: "nowrap" }}>
                <span className="lobby-pulse" style={{ width: 8, height: 8, borderRadius: 4, background: T.ready }} />
                Waiting for {hostName} to start
              </div>
              <button onClick={() => setConfirmLeave(true)} style={{ height: 48, borderRadius: 12, border: `1px solid ${T.line}`, background: "transparent", color: T.dim, fontSize: 14, fontWeight: 600 }}>Leave lobby</button>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes lobbyPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } } .lobby-pulse { animation: lobbyPulse 1.4s ease-in-out infinite; }`}</style>

      {inviting && (
        <GroupWorkoutSheet
          user={user}
          inviteSessionId={sessionId}
          excludeIds={visible.map((m) => m.user_id)}
          onClose={() => setInviting(false)}
          onInvited={() => setInviting(false)}
        />
      )}
    </div>
  );
}

function pill(color, border) {
  return { fontSize: 12, fontWeight: 600, color, border: `1px solid ${border}`, borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap", flexShrink: 0 };
}
