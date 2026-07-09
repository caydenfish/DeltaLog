import { useState, useEffect, useId } from "react";

const T = {
  bg: "#101216",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

// The triangle mark stays put — the loading motion is an orange wave
// that rises and drains inside the outline, its surface rippling
// sideways the whole time so it reads like a flag filling rather than a
// liquid gauge. Two independent animations layered in nested <g>s: one
// group translates vertically (the fill level), one translates the wave
// path horizontally (the ripple), both clipped to the triangle shape.
export function LoadingSpinner({ size = 28 }) {
  const clipId = `dl-loader-clip-${useId()}`;
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 100 70" style={{ overflow: "visible", display: "block" }}>
      <style>{`
        @keyframes dl-loader-fill {
          0%, 100% { transform: translateY(52px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes dl-loader-ripple {
          from { transform: translateX(0); }
          to { transform: translateX(-40px); }
        }
        .dl-loader-fillgroup { animation: dl-loader-fill 2.8s ease-in-out infinite; }
        .dl-loader-wave { animation: dl-loader-ripple 1.1s linear infinite; }
      `}</style>
      <defs>
        <clipPath id={clipId}>
          <polygon points="50,0.5 79,47 21,47" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <g className="dl-loader-fillgroup">
          <path
            className="dl-loader-wave"
            fill={T.accent}
            d="M -20,0 C -10,-4 0,4 10,0 C 20,-4 30,4 40,0 C 50,-4 60,4 70,0 C 80,-4 90,4 100,0 C 110,-4 120,4 130,0 L 130,80 L -20,80 Z"
          />
        </g>
      </g>
      <polygon points="50,0.5 79,47 21,47" fill="none" stroke={T.text} strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
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
      <LoadingSpinner size={72} />
      {label && <div style={{ color: T.dim, fontSize: 13 }}>{label}</div>}
      {stuck && (
        <button
          onClick={() => window.location.reload()}
          style={{ position: "absolute", bottom: 32, background: "#1A1D23", border: "1px solid #2C313B", color: T.dim, borderRadius: 999, padding: "10px 18px", fontSize: 13 }}
        >
          Taking longer than usual — tap to reload
        </button>
      )}
    </div>
  );
}
