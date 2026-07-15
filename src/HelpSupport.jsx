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

function Row({ onClick, href, title, subtitle, external }) {
  const style = { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", boxSizing: "border-box", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 12, textAlign: "left", textDecoration: "none" };
  const content = (
    <>
      <div style={{ minWidth: 0, overflow: "hidden" }}>
        <div style={{ color: T.text, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        <div style={{ color: T.dim, fontSize: 11, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</div>
      </div>
      <div style={{ color: T.dim, fontSize: 16, flexShrink: 0, marginLeft: 8 }}>{external ? "↗" : "›"}</div>
    </>
  );
  if (href) {
    return <a href={href} target="_blank" rel="noopener noreferrer" style={style}>{content}</a>;
  }
  return <button onClick={onClick} style={style}>{content}</button>;
}

export default function HelpSupport({ onClose, onOpenFAQ, onOpenInstallGuide, onReplaySetup, onOpenFeedback }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 30, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 400, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8, position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
          <button onClick={onClose} aria-label="Close" style={smallBtn}>‹</button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: T.text, textAlign: "center" }}>GUIDES & SUPPORT</div>
          <div style={{ width: 26 }} />
        </div>

        <div style={{ padding: 16, flex: 1 }}>
          <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Get started</div>
          <Row onClick={onReplaySetup} title="Rerun setup wizard" subtitle="Go back through units, training focus, and your other defaults" />
          <Row onClick={onOpenInstallGuide} title="Install as an app" subtitle="Add DeltaLog to your home screen" />

          <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginTop: 12 }}>Guides</div>
          <Row onClick={onOpenFAQ} title="FAQ & Glossary" subtitle="Training terms, plus the Push/Pull/Legs split breakdown" />

          <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginTop: 12 }}>Community & support</div>
          <Row href="https://www.reddit.com/r/DeltaLogApp/" title="r/DeltaLogApp" subtitle="Feedback, requests, and updates" external />
          <Row onClick={onOpenFeedback} title="Report a bug or request a feature" subtitle="Goes straight to the person building this" />
        </div>
      </div>
    </div>
  );
}
