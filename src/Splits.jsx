import { SPLITS } from "./lib/splits";
import { muscleLabel } from "./lib/muscleNomenclature";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

const DESCRIPTIONS = {
  Push: "Chest, shoulders, and triceps — everything that pushes weight away from your body.",
  Pull: "Back, biceps, and rear delts — everything that pulls weight toward your body.",
  Legs: "Quads, hamstrings, glutes, and calves.",
  Upper: "Everything above the waist, for an upper/lower split.",
  Lower: "Everything below the waist, for an upper/lower split.",
  "Full Body": "A broad spread across major muscle groups, for full-body sessions.",
};

export default function Splits({ onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 30, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 400, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8, position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 13 }}>‹</button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: T.text, textAlign: "center" }}>SPLITS</div>
          <div style={{ width: 26 }} />
        </div>

        <div style={{ padding: 16, flex: 1 }}>
          <div style={{ color: T.dim, fontSize: 13, lineHeight: 1.5, marginBottom: 18 }}>
            These are the same splits available as quick filters when picking exercises — tap Filters in any exercise picker to jump straight to one.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.entries(SPLITS).map(([name, muscles]) => (
              <div key={name} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14 }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 4 }}>{name}</div>
                <div style={{ color: T.dim, fontSize: 12.5, lineHeight: 1.5, marginBottom: 8 }}>{DESCRIPTIONS[name]}</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {muscles.map((m) => (
                    <span key={m} style={{ fontSize: 11, fontWeight: 600, color: T.text, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 999, padding: "3px 9px" }}>{muscleLabel(m)}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
