const T = {
  line: "#2C313B",
  dim: "#8B919D",
  accent: "#E8442E",
};

// One continuous progress bar spans the whole onboarding sequence --
// profile (Onboarding.jsx), terms (TermsGate.jsx), and the setup wizard's
// own steps -- so it reads as one guided flow rather than three separate
// screens each with their own (or no) sense of progress.
export default function OnboardingProgress({ step, total }) {
  return (
    <div style={{ width: "100%", maxWidth: 380, margin: "0 auto 22px" }}>
      <div style={{ display: "flex", gap: 5, marginBottom: 6 }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < step ? T.accent : T.line }} />
        ))}
      </div>
      <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, textAlign: "center" }}>
        Step {step} of {total}
      </div>
    </div>
  );
}
