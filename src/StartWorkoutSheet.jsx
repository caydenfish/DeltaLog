import { useEffect, useState } from "react";
import { fetchTemplates } from "./lib/queries";
import { IconPlus, IconBolt, IconList } from "./Icons";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

// Start Workout sheet (v1.14.0). Opens from Home's Start Workout button
// and decides how the workout starts *before* the workout screen opens,
// in order of how people actually start: resume a saved workout (when
// there is one), start from scratch, or templates. Generate
// is locked as Coming soon. Templates is a single button (v1.14.4) that
// opens the full template picker. onChoose receives the intent SetLogger
// applies after boot: { kind: "scratch" | "template" | "templates" |
// "resume", template? }.
export default function StartWorkoutSheet({ userId, savedWorkout, onChoose, onClose }) {
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
          <button onClick={() => onChoose({ kind: "resume" })} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "12px 14px", marginBottom: 10, borderRadius: 12, border: `1px dashed ${T.accent}`, background: "rgba(232,68,46,0.08)", color: T.accent, fontSize: 14, fontWeight: 600 }}>
            <span>Resume saved workout</span>
            <span style={{ fontSize: 12, color: T.dim, fontWeight: 500 }}>›</span>
          </button>
        )}

        <button onClick={() => onChoose({ kind: "scratch" })} style={{ width: "100%", padding: "15px 0", borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <IconPlus size={16} /> Start from scratch
        </button>

        <button onClick={() => onChoose({ kind: "templates" })} style={{ width: "100%", marginTop: 10, padding: "14px 16px", borderRadius: 12, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}><IconList size={16} /> Templates</span>
          <span style={{ fontSize: 13, color: T.dim, fontWeight: 500 }}>{templates === null ? "" : templates.length === 0 ? "None yet ›" : `${templates.length} saved ›`}</span>
        </button>

        <div aria-disabled="true" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 12, padding: "12px 14px", borderRadius: 12, border: `1px solid ${T.line}`, color: T.dim, opacity: 0.6 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}><IconBolt size={14} /> Generate workout</span>
          <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, border: `1px solid ${T.line}`, borderRadius: 999, padding: "3px 8px", whiteSpace: "nowrap" }}>Coming soon</span>
        </div>
      </div>
    </div>
  );
}
