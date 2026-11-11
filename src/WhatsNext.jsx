import { WHATS_NEXT } from "./lib/whatsNext";
import { IconX } from "./Icons";
import { themed } from "./lib/theme";

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

const smallBtn = { background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 13 };

// Customer-facing roadmap — what's planned but not shipped yet. Pairs
// with WhatsNew.jsx (what already shipped); this one has no version
// numbers since nothing here has a release yet.
export default function WhatsNext({ onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 30, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 400, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8, position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
          <button onClick={onClose} aria-label="Close" style={smallBtn}><IconX size={12} /></button>
          <div style={{ fontFamily: "'Chakra Petch', sans-serif", fontSize: 22, fontWeight: 700, color: T.text, textAlign: "center" }}>WHAT'S NEXT</div>
          <div style={{ width: 26 }} />
        </div>

        <div style={{ padding: 16, flex: 1 }}>
          <div style={{ color: T.dim, fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
            Here's what we're building next. Nothing here has a ship date yet, but it's on the list.
          </div>

          {WHATS_NEXT.length === 0 ? (
            <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>Nothing queued up right now — check back soon.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {WHATS_NEXT.map((item, i) => (
                <div key={i} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                    <div style={{ background: "rgba(196,163,90,0.14)", color: T.accent, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, borderRadius: 6, padding: "2px 7px", flexShrink: 0, marginTop: 2 }}>Planned</div>
                    <div style={{ fontFamily: "'Saira Condensed', sans-serif", fontSize: 17, fontWeight: 700, color: T.text }}>{item.title}</div>
                  </div>
                  <div style={{ color: T.dim, fontSize: 13, lineHeight: 1.5 }}>{item.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
