import { useState } from "react";
import { IconInfo, IconChevronDown, IconChevronLeft, IconUsers } from "./Icons";
import { useBackLayer } from "./lib/backNav";
import { toDisplay } from "./lib/weight";
import { bestGroupE1RM, colorFor, displayName, initialOf, GROUP_E1RM_MAX_EFFECTIVE_REPS } from "./lib/social";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};
const condensed = "'Barlow Condensed', sans-serif";
const oneLine = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const eyebrow = { fontFamily: condensed, fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: T.dim, whiteSpace: "nowrap" };

const E1RM_TIP = `Estimated 1-rep max: the most you could likely lift once, worked out from a set's weight, reps and reps in reserve. Each person's number is their best working set today. Warmups and sets past ${GROUP_E1RM_MAX_EFFECTIVE_REPS} effective reps are left out, because rep-max estimates lose accuracy past that range.`;

function Dot({ person, isMe, size = 20 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size / 2, background: isMe ? T.accent : colorFor(person.user_id), color: isMe ? "#fff" : "#0F1012", fontSize: Math.round(size * 0.5), fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {initialOf(person)}
    </span>
  );
}

const fmtW = (lb, unit) => toDisplay(lb, unit);
const fmtSet = (s, unit) => `${fmtW(s.w, unit)}×${s.r}`;
const working = (sets) => (sets || []).filter((s) => !s.warm);

// Under the current exercise's sets while in a group workout: each
// friend's latest set on this lift and their best e1RM today. Tapping it
// opens GroupLiftView on this same exercise.
export function GroupLiftRow({ userId, members, lifts, exerciseId, mySnapshot, unit, onOpen }) {
  const [showTip, setShowTip] = useState(false);
  const others = members.filter((m) => m.user_id !== userId && m.status !== "declined");
  const onLift = others.filter((m) => working(lifts[m.user_id]?.[exerciseId]).length > 0);
  const myBest = bestGroupE1RM(mySnapshot);
  const invitedOnly = others.length > 0 && others.every((m) => m.status === "invited");

  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <span style={eyebrow}>On this lift</span>
          <button onClick={() => setShowTip((v) => !v)} aria-label="How estimated 1RM is calculated" aria-expanded={showTip} style={{ width: 28, height: 28, borderRadius: 14, border: "none", background: "transparent", color: T.dim, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IconInfo size={13} />
          </button>
        </div>
        <span style={{ fontSize: 11.5, color: T.dim, whiteSpace: "nowrap" }}>
          Your best e1RM <b style={{ fontFamily: condensed, fontSize: 15, color: T.text }}>{myBest ? Math.round(fmtW(myBest, unit)) : "—"}</b>
        </span>
      </div>
      {showTip && <div style={{ fontSize: 12, lineHeight: 1.45, color: T.dim, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: "8px 10px" }}>{E1RM_TIP}</div>}
      <button onClick={onOpen} aria-label="Show everyone's sets on this lift" style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 56, padding: "8px 12px", borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, textAlign: "left" }}>
        {onLift.length === 0 ? (
          <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.dim, ...oneLine }}>
            <IconUsers size={15} />
            {others.length === 0 ? "Nobody else in this group" : invitedOnly ? "Waiting for friends to join" : "No one else has logged this lift yet"}
          </span>
        ) : (
          <span style={{ flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: `repeat(${Math.min(onLift.length, 3)}, minmax(0, 1fr))`, gap: 8 }}>
            {onLift.slice(0, 3).map((m) => {
              const sets = lifts[m.user_id][exerciseId];
              const w = working(sets);
              const best = bestGroupE1RM(sets);
              return (
                <span key={m.user_id} style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                    <Dot person={m} />
                    <span style={{ fontSize: 14, fontWeight: 600, ...oneLine }}>{fmtSet(w[w.length - 1], unit)}</span>
                  </span>
                  <span style={{ fontSize: 11.5, color: T.dim, ...oneLine }}>Best e1RM <b style={{ color: "#C9CDD3", fontWeight: 600 }}>{best ? Math.round(fmtW(best, unit)) : "—"}</b></span>
                </span>
              );
            })}
          </span>
        )}
        {onLift.length > 3 && <span style={{ fontSize: 12, color: T.dim, whiteSpace: "nowrap" }}>+{onLift.length - 3}</span>}
        <span style={{ color: T.dim, display: "flex", flexShrink: 0 }}><IconChevronDown size={16} /></span>
      </button>
    </div>
  );
}

// Full comparison: tabs for every exercise anyone has logged (yours
// first, in workout order), opened on the exercise it was tapped from.
// One column per person, set-by-set working sets, best e1RM at the bottom.
export function GroupLiftView({ userId, members, lifts, myLifts, exercises, nameFor, initialExerciseId, unit, onClose, onLeave }) {
  useBackLayer(1, onClose, 5);
  const ids = [...exercises.map((e) => e.id)];
  for (const m of members) for (const exId of Object.keys(lifts[m.user_id] || {})) if (!ids.includes(exId)) ids.push(exId);
  const [current, setCurrent] = useState(initialExerciseId || ids[0]);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const me = members.find((m) => m.user_id === userId) || { user_id: userId, first_name: "You" };
  const others = members.filter((m) => m.user_id !== userId && m.status !== "declined");
  const setsOf = (m) => (m.user_id === userId ? myLifts[current] : lifts[m.user_id]?.[current]) || [];
  const people = [me, ...others.filter((m) => working(setsOf(m)).length > 0)];
  const rows = Math.max(1, ...people.map((p) => working(setsOf(p)).length));
  const cols = `34px repeat(${people.length}, minmax(68px, 1fr))`;
  const label = (id) => exercises.find((e) => e.id === id)?.name || nameFor(id) || "Exercise";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: T.bg, display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 400, height: "100dvh", display: "flex", flexDirection: "column", paddingTop: "env(safe-area-inset-top, 0px)", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 12px 8px" }}>
          <button onClick={onClose} aria-label="Back to workout" style={{ width: 44, height: 44, borderRadius: 10, border: "none", background: "transparent", color: T.text, display: "flex", alignItems: "center", justifyContent: "center" }}><IconChevronLeft size={22} /></button>
          <span style={{ fontFamily: condensed, fontSize: 24, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: T.text, ...oneLine }}>On this lift</span>
        </div>

        <div className="no-scrollbar" style={{ display: "flex", gap: 8, padding: "0 16px 12px", overflowX: "auto", flexShrink: 0 }}>
          {ids.map((id) => (
            <button key={id} onClick={() => setCurrent(id)} style={{ height: 36, padding: "0 14px", borderRadius: 18, border: "none", flexShrink: 0, background: id === current ? T.accent : T.surface, color: id === current ? "#fff" : "#C9CDD3", fontSize: 14, fontWeight: id === current ? 700 : 500, whiteSpace: "nowrap" }}>
              {label(id)}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "10px 12px", overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: cols, columnGap: 8, alignItems: "center", height: 34 }}>
              <span style={eyebrow}>Set</span>
              {people.map((p) => (
                <span key={p.user_id} style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                  <Dot person={p} isMe={p.user_id === userId} />
                  <span style={{ fontSize: 12, color: p.user_id === userId ? T.text : "#C9CDD3", fontWeight: p.user_id === userId ? 700 : 500, ...oneLine }}>{p.user_id === userId ? "You" : (p.first_name || displayName(p))}</span>
                </span>
              ))}
            </div>
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: cols, columnGap: 8, alignItems: "center", height: 40, borderTop: `1px solid ${T.surface2}` }}>
                <span style={{ fontFamily: condensed, fontSize: 16, fontWeight: 600, color: T.text }}>{i + 1}</span>
                {people.map((p) => {
                  const s = working(setsOf(p))[i];
                  return <span key={p.user_id} style={{ fontSize: 14, fontWeight: 600, color: s ? T.text : "#5A6068", whiteSpace: "nowrap" }}>{s ? fmtSet(s, unit) : "·"}</span>;
                })}
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: cols, columnGap: 8, alignItems: "center", height: 48, borderTop: `1px solid ${T.line}` }}>
              <span style={{ ...eyebrow, fontSize: 10.5, lineHeight: 1.1, whiteSpace: "normal" }}>Best e1RM</span>
              {people.map((p) => {
                const best = bestGroupE1RM(setsOf(p));
                return <span key={p.user_id} style={{ fontFamily: condensed, fontSize: 20, fontWeight: 700, color: p.user_id === userId ? T.accent : T.text }}>{best ? Math.round(fmtW(best, unit)) : "—"}</span>;
              })}
            </div>
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.45, color: T.dim }}>{E1RM_TIP}</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={eyebrow}>In this group</span>
            {[me, ...others].map((m) => (
              <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 40 }}>
                <Dot person={m} isMe={m.user_id === userId} size={26} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: T.text, ...oneLine }}>{m.user_id === userId ? "You" : displayName(m)}{m.is_host ? <span style={{ color: T.dim }}> · host</span> : null}</span>
                <span style={{ fontSize: 12, color: T.dim, whiteSpace: "nowrap" }}>{m.status === "joined" ? "Lifting" : m.status === "invited" ? "Invited" : "Finished"}</span>
              </div>
            ))}
          </div>

          {confirmLeave ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmLeave(false)} style={{ flex: 1, height: 48, borderRadius: 12, border: `1px solid ${T.line}`, background: T.surface, color: T.text, fontSize: 14, fontWeight: 600 }}>Stay</button>
              <button onClick={onLeave} style={{ flex: 1, height: 48, borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>Leave, keep logging</button>
            </div>
          ) : (
            <button onClick={() => setConfirmLeave(true)} style={{ height: 48, borderRadius: 12, border: `1px solid ${T.line}`, background: "transparent", color: T.dim, fontSize: 14, fontWeight: 600 }}>Leave group</button>
          )}
        </div>
      </div>
    </div>
  );
}
