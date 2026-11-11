import { useState, useEffect } from "react";
import Logo from "./Logo";
import { themed, tc } from "./lib/theme";

const T = themed({
  bg: "#121418",
  text: "#E6E3D9",
  dim: "#8F949C",
  accent: "#C4A35A",
  danger: "#D0614C",
  accentDeep: "#8A6F33",
  spruce: "#3F6E55",
});

// v1.27.0: every loading state is the logo, still, with its glitch
// bursting every few seconds (Logo `live`). Replaces the old filling
// triangle.
export function LoadingSpinner({ size = 28 }) {
  return <Logo size={size} live />;
}

// Drop-in replacement for the old bare "Loading…" text blocks scattered
// through lists and panels. Same footprint/spacing, just with the spinner
// above the label.
export function InlineLoading({ label = "Loading…", size = 34, padding = "24px 0" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding }}>
      <LoadingSpinner size={size} />
      {label && <div style={{ color: T.dim, fontSize: 12.5, textAlign: "center" }}>{label}</div>}
    </div>
  );
}

// Full-screen variant for page-level boots (replaces bare dark divs like
// SetLogger's old boot placeholder). Carries its own "this is taking too
// long" watchdog — if it's still mounted after 9s (a hung request after
// the app was backgrounded and resumed, for instance), it surfaces a
// manual reload option instead of leaving someone stuck indefinitely.
export default function LoadingScreen({ label }) {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStuck(true), 9000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, zIndex: 40 }}>
      <LoadingSpinner size={96} />
      {label && <div style={{ color: T.dim, fontSize: 13 }}>{label}</div>}
      {stuck && (
        <button
          onClick={() => window.location.reload()}
          style={{ position: "absolute", bottom: 32, background: tc("#1B1E23"), border: `1px solid ${tc("#2F343B")}`, color: T.dim, borderRadius: 999, padding: "10px 18px", fontSize: 13 }}
        >
          Taking longer than usual — tap to reload
        </button>
      )}
    </div>
  );
}
