import { TermsBody } from "./lib/termsContent";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

const smallBtn = { background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 13 };

export default function TermsViewer({ onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 30, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 400, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}>
          <button onClick={onClose} aria-label="Close" style={smallBtn}>‹</button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: T.text, textAlign: "center" }}>TERMS & CONDITIONS</div>
          <div style={{ width: 26 }} />
        </div>
        <div style={{ padding: 16, flex: 1, color: T.dim, fontSize: 13, lineHeight: 1.6 }}>
          <TermsBody T={T} />
        </div>
      </div>
    </div>
  );
}
