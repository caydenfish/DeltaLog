import { useEffect, useState } from "react";
import { fetchTemplates } from "./lib/queries";
import { IconPlus, IconBolt } from "./Icons";

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
// there is one), start from scratch, or one of your templates. Generate
// is locked as Coming soon. onChoose receives the intent SetLogger
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

  const shown = (templates || []).slice(0, 3);
  const row = { width: "100%", display: "flex", alignItems: "center", gap: 10, minHeight: 52, padding: "0 2px", background: "none", border: "none", borderBottom: `1px solid ${T.line}`, color: T.text, textAlign: "left" };

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

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 18 }}>
          <span style={{ fontSize: 12.5, color: T.dim }}>Templates</span>
          {templates && templates.length > shown.length && (
            <button onClick={() => onChoose({ kind: "templates" })} style={{ background: "none", border: "none", color: T.dim, fontSize: 12.5, padding: 4 }}>All {templates.length} ›</button>
          )}
        </div>
        <div>
          {templates === null ? (
            <div style={{ color: T.dim, fontSize: 13, padding: "14px 0" }}>Loading…</div>
          ) : shown.length === 0 ? (
            <div style={{ color: T.dim, fontSize: 13, padding: "14px 0", lineHeight: 1.5 }}>No templates yet. Save any workout as a template from its menu.</div>
          ) : (
            shown.map((t, i) => (
              <button key={t.id} onClick={() => onChoose({ kind: "template", template: t })} style={{ ...row, borderBottom: i === shown.length - 1 ? "none" : row.borderBottom }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>{t.exerciseCount} exercise{t.exerciseCount === 1 ? "" : "s"}</div>
                </div>
                <span style={{ color: T.dim, fontSize: 13 }}>Start ›</span>
              </button>
            ))
          )}
        </div>

        <div aria-disabled="true" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 12, padding: "12px 14px", borderRadius: 12, border: `1px solid ${T.line}`, color: T.dim, opacity: 0.6 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}><IconBolt size={14} /> Generate workout</span>
          <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, border: `1px solid ${T.line}`, borderRadius: 999, padding: "3px 8px", whiteSpace: "nowrap" }}>Coming soon</span>
        </div>
      </div>
    </div>
  );
}
