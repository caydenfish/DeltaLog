const T = {
  bg: "#101216",
  text: "#F2F1EC",
  dim: "#8B919D",
};

// The triangle mark, quietly pulsing in place — used anywhere the app
// needs a loading indicator. No motion beyond a slow opacity fade, so it
// reads as a calm "working on it" rather than a spectacle.
export function LoadingSpinner({ size = 28 }) {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 100 70" style={{ overflow: "visible", display: "block" }}>
      <style>{`
        @keyframes dl-loader-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        .dl-loader-triangle { animation: dl-loader-pulse 1.6s ease-in-out infinite; }
      `}</style>
      <polygon className="dl-loader-triangle" points="50,0.5 79,47 21,47" fill="none" stroke={T.text} strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Drop-in replacement for the old bare "Loading…" text blocks scattered
// through lists and panels. Same footprint/spacing, just with the spinner
// above the label.
export function InlineLoading({ label = "Loading…", size = 22, padding = "24px 0" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding }}>
      <LoadingSpinner size={size} />
      {label && <div style={{ color: T.dim, fontSize: 12.5, textAlign: "center" }}>{label}</div>}
    </div>
  );
}

// Full-screen variant for page-level boots (replaces bare dark divs like
// SetLogger's old boot placeholder).
export default function LoadingScreen({ label }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, zIndex: 40 }}>
      <LoadingSpinner size={72} />
      {label && <div style={{ color: T.dim, fontSize: 13 }}>{label}</div>}
    </div>
  );
}
