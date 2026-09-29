import { useState } from "react";
import { acceptTerms } from "./lib/queries";
import { TermsBody } from "./lib/termsContent";
import Logo from "./Logo";
import IntroShell from "./IntroShell";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

export default function TermsGate({ user, onAccepted }) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleAccept() {
    if (!checked) return;
    setSaving(true);
    setError(null);
    try {
      await acceptTerms(user.id);
      onAccepted();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  return (
    <IntroShell
      maxWidth={400}
      footer={
        <>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12, cursor: "pointer" }}>
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} style={{ marginTop: 2, width: 20, height: 20, flexShrink: 0 }} />
            <span style={{ color: T.text, fontSize: 13, lineHeight: 1.4 }}>I have read and agree to the Terms & Conditions above.</span>
          </label>
          {error && <div style={{ color: T.accent, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
          <button
            onClick={handleAccept}
            disabled={!checked || saving}
            style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: !checked || saving ? T.surface2 : T.accent, color: !checked || saving ? T.dim : "#fff", fontSize: 15, fontWeight: 700 }}
          >
            {saving ? "Saving…" : "Accept & Continue"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <Logo size={48} />
      </div>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: T.text, textAlign: "center", marginBottom: 6 }}>
        Terms & Conditions
      </div>
      <div style={{ color: T.dim, fontSize: 13, textAlign: "center", marginBottom: 16, lineHeight: 1.5 }}>
        Please read and accept before continuing. This applies to everyone, including existing accounts.
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, color: T.dim, fontSize: 12.5, lineHeight: 1.6, overflowWrap: "anywhere" }}>
        <TermsBody T={T} />
        <p style={{ marginBottom: 0 }}>By checking the box below and continuing, you confirm you have read and agree to these terms.</p>
      </div>
    </IntroShell>
  );
}
