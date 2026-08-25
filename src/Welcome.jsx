import Logo from "./Logo";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

export default function Welcome({ onContinue }) {
  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
        <div style={{ marginBottom: 22 }}>
          <Logo size={64} />
        </div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: T.text, marginBottom: 10, lineHeight: 1.2 }}>
          Let's set up your training
        </div>
        <div style={{ color: T.dim, fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          We just need a few quick things about your goals to build your ideal experience. Takes about a minute.
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 28, textAlign: "left" }}>
          <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>What you'll get</div>
          <div style={{ color: T.text, fontSize: 13, lineHeight: 1.6 }}>
            Targets that adjust to your goal, a strength score you can trust, and a home screen shortcut so it feels like a real app.
          </div>
        </div>
        <button
          onClick={onContinue}
          style={{ width: "100%", padding: "16px 0", borderRadius: 14, border: "none", background: T.accent, color: "#fff", fontSize: 16, fontWeight: 700 }}
        >
          Get started
        </button>
      </div>
    </div>
  );
}
