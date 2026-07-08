import { useState } from "react";
import { muscleLabel, isRealMuscle } from "./lib/muscleNomenclature";
import { formatWeight } from "./lib/weight";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
};

const chevron = (open) => ({ display: "inline-block", transition: "transform 0.15s", transform: open ? "rotate(90deg)" : "rotate(0deg)", color: T.dim, fontSize: 14, flexShrink: 0 });

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// Drill-down sheet behind a muscle's "N sets" count on Home -- lists every
// exercise entry that contributed to that count (role-filtered: primary
// mover vs. assisting/secondary), each expandable to the individual set's
// weight and reps. Reuses the same `entries` shape volume.js already
// builds for the heatmap, so no extra fetch is needed. `muscle` is the
// already-labeled name at the caller's selected naming mode (as produced
// by computeMuscleSetCounts), so matching re-derives each entry's label
// at that same mode rather than comparing raw muscle values directly.
export default function MuscleSetsDetail({ muscle, role, entries, nameMode, units, onClose }) {
  const [openIdx, setOpenIdx] = useState(null);

  const rows = (entries || [])
    .filter((e) => e.muscle !== "Full Body")
    .filter((e) => {
      if (role === "primary") {
        const rawPrimary = e.primaryMuscles && e.primaryMuscles.length > 0 ? e.primaryMuscles : [e.muscle];
        return rawPrimary.some((p) => isRealMuscle(p) && muscleLabel(p, nameMode) === muscle);
      }
      return (e.secondaryMuscles || []).some((sec) => isRealMuscle(sec) && sec !== "Full Body" && muscleLabel(sec, nameMode) === muscle);
    })
    .map((e) => ({ exerciseName: e.exerciseName, date: e.date, sets: e.sets }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalSets = rows.reduce((sum, r) => sum + r.sets.length, 0);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.8)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 420, maxHeight: "85vh", overflowY: "auto", background: T.bg, borderTop: `1px solid ${T.line}`, borderRadius: "20px 20px 0 0", padding: 20, boxSizing: "border-box" }}>
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 19, fontWeight: 700, color: T.text }}>{muscle}</div>
          <div style={{ fontSize: 12, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>{role === "primary" ? "Primary" : "Secondary"} &middot; {totalSets} set{totalSets === 1 ? "" : "s"}</div>
        </div>

        <div style={{ marginTop: 14 }}>
          {rows.length === 0 && <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "20px 0" }}>Nothing logged in this range.</div>}
          {rows.map((r, i) => {
            const open = openIdx === i;
            return (
              <div key={i} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
                <button
                  onClick={() => setOpenIdx(open ? null : i)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: 12, background: "none", border: "none", textAlign: "left" }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: T.text, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.exerciseName}</div>
                    <div style={{ color: T.dim, fontSize: 11 }}>{formatDate(r.date)} &middot; {r.sets.length} set{r.sets.length === 1 ? "" : "s"}</div>
                  </div>
                  <span style={chevron(open)}>&rsaquo;</span>
                </button>
                {open && (
                  <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                    {r.sets.map((s, j) => (
                      <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderTop: `1px solid ${T.surface2}` }}>
                        <span style={{ color: T.dim }}>Set {j + 1}</span>
                        <span style={{ color: T.text, fontWeight: 600 }}>{formatWeight(s.weight, units)} {units} &times; {s.reps}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={onClose} style={{ width: "100%", marginTop: 12, padding: "12px 0", borderRadius: 12, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 14, fontWeight: 600 }}>Close</button>
      </div>
    </div>
  );
}
