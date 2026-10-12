import { ILLUSTRATIONS } from "./illustrations";

const T = { bg: "#101216", surface: "#1A1D23", line: "#2C313B", line2: "#3A404B", text: "#F2F1EC", dim: "#A3A9B4", faint: "#8B919D", accent: "#E8442E" };
const condensed = "'Barlow Condensed', sans-serif";

const VALUE_ROWS = [
  { d: "M4 19V9M10 19V5M16 19v-7M22 19H2", title: "A target for every set", body: "Built from your last session and how hard it felt." },
  { d: "M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM6 21v-4a6 6 0 0 1 12 0v4", title: "See what you actually trained", body: "Weekly sets per muscle against science-backed ranges." },
  { d: "M5 12.5l4.5 4.5L19 7.5", title: "Works with zero signal", body: "Installs like an app and logs offline at the gym." },
];

// First screen anyone sees (v1.19.0). Used by Auth for real signups and
// by the Admin onboarding simulator, so the two can never differ.
export default function WelcomeScreen({ onGoogle, onEmail, onSignIn, onTerms, onPrivacy, banner }) {
  return (
    <div style={{ height: "100dvh", background: T.bg, color: T.text, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 420, boxSizing: "border-box", minHeight: "100dvh", display: "flex", flexDirection: "column", padding: "calc(20px + env(safe-area-inset-top, 0px)) 22px calc(24px + env(safe-area-inset-bottom, 0px))" }}>
        {banner}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 24 }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinejoin="round" aria-hidden="true"><path d="M12 4L21 20H3Z" /></svg>
          </span>
          <span style={{ fontFamily: condensed, fontSize: 26, fontWeight: 700, letterSpacing: "0.05em" }}>DELTALOG</span>
        </div>
        {ILLUSTRATIONS.welcome && (
          <img src={ILLUSTRATIONS.welcome} alt="" aria-hidden="true" style={{ display: "block", height: 150, maxWidth: "100%", objectFit: "contain", margin: "28px 0 -8px", filter: "invert(1) opacity(0.9)" }} />
        )}
        <h1 style={{ margin: "32px 0 0", fontFamily: condensed, fontSize: 46, fontWeight: 700, lineHeight: 0.98, textTransform: "uppercase" }}>
          Log faster.<br />Progress on purpose.
        </h1>
        <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 20 }}>
          {VALUE_ROWS.map((r) => (
            <div key={r.title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span style={{ width: 40, height: 40, borderRadius: 11, background: T.surface, border: `1px solid ${T.line}`, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={r.d} /></svg>
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{r.title}</span>
                <span style={{ fontSize: 14, lineHeight: 1.4, color: T.dim }}>{r.body}</span>
              </span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minHeight: 28 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={onGoogle} style={{ height: 54, border: "none", borderRadius: 14, background: T.text, color: T.bg, fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, whiteSpace: "nowrap" }}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" /><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" /><path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" /><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" /></svg>
            Continue with Google
          </button>
          <button onClick={onEmail} style={{ height: 54, border: `1px solid ${T.line2}`, borderRadius: 14, background: "transparent", color: T.text, fontSize: 17, fontWeight: 600, whiteSpace: "nowrap" }}>
            Continue with email
          </button>
          <button onClick={onSignIn} style={{ height: 44, border: "none", background: "transparent", color: T.dim, fontSize: 15, fontWeight: 600 }}>
            I already have an account
          </button>
          <p style={{ margin: "2px 0 0", textAlign: "center", fontSize: 12.5, lineHeight: 1.5, color: T.faint }}>
            By continuing you agree to the{" "}
            <button onClick={onTerms} style={{ background: "none", border: "none", padding: 0, color: "#FF6A55", fontSize: 12.5, textDecoration: "underline" }}>Terms</button>
            {" "}and{" "}
            <button onClick={onPrivacy} style={{ background: "none", border: "none", padding: 0, color: "#FF6A55", fontSize: 12.5, textDecoration: "underline" }}>Privacy Policy</button>.
          </p>
        </div>
      </div>
    </div>
  );
}
