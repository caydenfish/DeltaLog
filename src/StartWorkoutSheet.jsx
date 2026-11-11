import { useEffect, useState } from "react";
import { fetchTemplates } from "./lib/queries";
import { IconPlus, IconBolt, IconList, IconUsers } from "./Icons";
import { themed } from "./lib/theme";

import { BTN_TEXT, BTN_RADIUS, BTN_HERO } from "./lib/buttons";
const T = themed({
  bg: "#121418",
  surface: "#1B1E23",
  surface2: "#24282E",
  line: "#2F343B",
  text: "#E6E3D9",
  dim: "#8F949C",
  accent: "#C4A35A",
  danger: "#D0614C",
  accentDeep: "#8A6F33",
  spruce: "#3F6E55",
});

// Start Workout sheet (v1.14.0). Opens from Home's Start Workout button
// and decides how the workout starts *before* the workout screen opens,
// in order of how people actually start: resume a saved workout (when
// there is one), start from scratch, or templates. Generate
// is locked as Coming soon. Templates is a single button (v1.14.4) that
// opens the full template picker. onChoose receives the intent SetLogger
// applies after boot: { kind: "scratch" | "template" | "templates" |
// "resume", template? }.
//
// Group Workout (v1.17.0, reworked v1.20.0): calls onStartGroup, which
// opens the friend picker and then the lobby. The plan for a group
// workout is picked in the lobby, so this sheet no longer has a group mode.
//
// New template (v1.21.0): "+ New" beside Templates calls onNewTemplate,
// which opens the template builder. When it comes back with a saved
// template (freshTemplate), a "Start <name>" button leads the sheet.
export default function StartWorkoutSheet({ userId, savedWorkout, onChoose, onClose, onStartGroup, onNewTemplate, freshTemplate }) {
  const choose = onChoose;
  const [templates, setTemplates] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchTemplates(userId)
      .then((t) => { if (!cancelled) setTemplates(t); })
      .catch(() => { if (!cancelled) setTemplates([]); });
    return () => { cancelled = true; };
  }, [userId]);


  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 30, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}>
      <style>{`@keyframes swsUp { from { transform: translateY(100%); } to { transform: translateY(0); } } @keyframes swsFade { from { opacity: 0; } to { opacity: 1; } }`}</style>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(10,11,13,0.6)", animation: "swsFade 0.18s ease" }} />
      <div style={{ position: "relative", width: "100%", maxWidth: 400, boxSizing: "border-box", maxHeight: "88%", overflowY: "auto", background: T.surface, borderTop: `1px solid ${T.line}`, borderRadius: "18px 18px 0 0", padding: "6px 16px calc(18px + env(safe-area-inset-bottom, 0px))", animation: "swsUp 0.22s ease" }}>
        <button onClick={onClose} aria-label="Close" style={{ display: "block", width: 64, height: 26, margin: "0 auto 4px", background: "none", border: "none", padding: 0 }}>
          <span style={{ display: "block", width: 36, height: 4, borderRadius: 4, background: T.line, margin: "0 auto" }} />
        </button>

        {savedWorkout && (
          <button onClick={() => choose({ kind: "resume" })} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "12px 14px", marginBottom: 10, borderRadius: 12, border: `1px dashed ${T.accent}`, background: "rgba(196,163,90,0.08)", color: T.accent, fontSize: 14, fontWeight: 600 }}>
            <span>Resume saved workout</span>
            <span style={{ fontSize: 12, color: T.dim, fontWeight: 500 }}>›</span>
          </button>
        )}

        <button onClick={() => choose({ kind: "scratch" })} style={{ width: "100%", padding: "15px 0", border: "none", background: T.accent, color: T.bg, fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, ...BTN_HERO }}>
          <IconPlus size={16} /> Start from scratch
        </button>

        {freshTemplate && (
          <button onClick={() => choose({ kind: "template", template: freshTemplate })} style={{ width: "100%", marginTop: 10, padding: "14px 16px", borderRadius: 12, border: `1px solid ${T.accent}`, background: "rgba(196,163,90,0.08)", color: T.text, fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}><span style={{ color: T.accent, display: "flex", flexShrink: 0 }}><IconList size={16} /></span><span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Start {freshTemplate.name}</span></span>
            <span style={{ fontSize: 13, color: T.dim, fontWeight: 500, whiteSpace: "nowrap" }}>Just saved ›</span>
          </button>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={() => choose({ kind: "templates" })} style={{ flex: 1, minWidth: 0, padding: "14px 16px", borderRadius: 12, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}><IconList size={16} /> Templates</span>
            <span style={{ fontSize: 13, color: T.dim, fontWeight: 500, whiteSpace: "nowrap" }}>{templates === null ? "" : templates.length === 0 ? "None yet ›" : `${templates.length} saved ›`}</span>
          </button>
          {onNewTemplate && (
            <button onClick={onNewTemplate} aria-label="Build a new template" style={{ flexShrink: 0, padding: "0 14px", border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", ...BTN_TEXT, borderRadius: BTN_RADIUS }}>
              <span style={{ color: T.accent, display: "flex" }}><IconPlus size={15} /></span> New
            </button>
          )}
        </div>

        {onStartGroup && (
          <button onClick={onStartGroup} style={{ width: "100%", marginTop: 10, padding: "14px 16px", borderRadius: 12, border: `1px solid ${T.accent}`, background: "rgba(196,163,90,0.08)", color: T.text, fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}><span style={{ color: T.accent, display: "flex" }}><IconUsers size={18} /></span> Group Workout</span>
            <span style={{ fontSize: 13, color: T.dim, fontWeight: 500, whiteSpace: "nowrap" }}>With friends ›</span>
          </button>
        )}

        <div aria-disabled="true" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 12, padding: "12px 14px", borderRadius: 12, border: `1px solid ${T.line}`, color: T.dim, opacity: 0.6 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}><IconBolt size={14} /> Generate workout</span>
          <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, border: `1px solid ${T.line}`, borderRadius: 999, padding: "3px 8px", whiteSpace: "nowrap" }}>Coming soon</span>
        </div>
      </div>
    </div>
  );
}
