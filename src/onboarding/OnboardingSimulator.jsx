import { useState } from "react";
import { ScreenHeader } from "../SettingsUI";
import OnboardingFlow, { ONBOARDING_STEPS, STEP_LABELS } from "./OnboardingFlow";

const T = { bg: "#101216", surface: "#1A1D23", surface2: "#22262E", line: "#2C313B", text: "#F2F1EC", dim: "#A3A9B4", accent: "#E8442E", green: "#3BA55D" };
const eyebrow = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: T.dim };

// Admin > Onboarding simulator (v1.19.0). Launches the real OnboardingFlow
// in simulate mode: same screens a new signup sees, from any step,
// blank or filled with your own answers, and dry by default.
export default function OnboardingSimulator({ user, profile, onClose }) {
  const [start, setStart] = useState("welcome");
  const [fill, setFill] = useState("blank");
  const [dryRun, setDryRun] = useState(true);
  const [running, setRunning] = useState(false);
  const [runKey, setRunKey] = useState(0);

  if (running) {
    return <OnboardingFlow key={runKey} user={user} profile={profile} mode="simulate" startStep={start} fill={fill} dryRun={dryRun} onExit={() => setRunning(false)} />;
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 40, background: T.bg, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 400, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <ScreenHeader title="Onboarding simulator" eyebrow="Admin" onBack={onClose} />
        <div style={{ padding: "4px 16px 32px", display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: T.dim }}>Runs the exact screens a new signup sees, welcome through finish. Same components, so what you see here is what they get.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={eyebrow}>Start at</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ONBOARDING_STEPS.map((s) => (
                <button key={s} onClick={() => setStart(s)} aria-pressed={start === s} style={{ height: 38, padding: "0 12px", borderRadius: 19, border: start === s ? "none" : `1px solid ${T.line}`, background: start === s ? T.accent : T.surface, color: start === s ? "#fff" : "#C9CDD3", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>{STEP_LABELS[s]}</button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={eyebrow}>Fill with</span>
            <div role="group" aria-label="Fill with" style={{ display: "flex", gap: 4, padding: 4, borderRadius: 12, background: T.surface2 }}>
              {[["blank", "Blank, like a new user"], ["mine", "My answers"]].map(([k, l]) => (
                <button key={k} onClick={() => setFill(k)} aria-pressed={fill === k} style={{ flex: 1, height: 44, border: "none", borderRadius: 9, background: fill === k ? T.accent : "transparent", color: fill === k ? "#fff" : T.dim, fontSize: 14.5, fontWeight: 700, whiteSpace: "nowrap" }}>{l}</button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 56, borderTop: `1px solid ${T.surface2}`, paddingTop: 12 }}>
            <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Dry run</span>
              <span style={{ fontSize: 12.5, lineHeight: 1.4, color: T.dim }}>{dryRun ? "Nothing is saved. Your profile, ID and preferences stay as they are." : "Live: every answer saves to your own account, like a real run."}</span>
            </span>
            <button role="switch" aria-checked={dryRun} aria-label="Dry run" onClick={() => setDryRun((v) => !v)} style={{ width: 50, height: 30, borderRadius: 15, border: "none", background: dryRun ? T.green : "#3A404B", position: "relative", flexShrink: 0 }}>
              <span style={{ position: "absolute", top: 3, left: dryRun ? 23 : 3, width: 24, height: 24, borderRadius: 12, background: "#fff", transition: "left 0.15s" }} />
            </button>
          </div>
          {!dryRun && fill === "blank" && (
            <div style={{ fontSize: 12.5, lineHeight: 1.45, color: "#FF8A78" }}>Live with blank answers will overwrite your profile with whatever you enter.</div>
          )}

          <div style={{ flex: 1 }} />
          <button onClick={() => { setRunKey((k) => k + 1); setRunning(true); }} style={{ height: 54, border: "none", borderRadius: 14, background: T.accent, color: "#fff", fontSize: 17, fontWeight: 700 }}>Launch simulation</button>
        </div>
      </div>
    </div>
  );
}
