import { TermsBody } from "./lib/termsContent";
import { themed } from "./lib/theme";

import { BTN_TEXT, BTN_RADIUS } from "./lib/buttons";
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

const smallBtn = { background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: BTN_RADIUS, padding: "4px 10px", fontSize: 14, ...BTN_TEXT };
export default function TermsViewer({ onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 30, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 400, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8, position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
          <button onClick={onClose} aria-label="Close" style={smallBtn}>‹</button>
          <div style={{ fontFamily: "'Chakra Petch', sans-serif", fontSize: 22, fontWeight: 700, color: T.text, textAlign: "center" }}>TERMS & CONDITIONS</div>
          <div style={{ width: 26 }} />
        </div>
        <div style={{ padding: 16, flex: 1, color: T.dim, fontSize: 13, lineHeight: 1.6 }}>
          <TermsBody T={T} />
        </div>
      </div>
    </div>
  );
}
