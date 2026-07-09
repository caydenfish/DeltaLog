const T = {
  bg: "#101216",
  text: "#F2F1EC",
  dim: "#8B919D",
};

// The triangle mark, shrunk slightly, spinning up from a standstill to a
// fast spin and back down before stopping semi-abruptly, then growing
// back to full size right as it settles — used anywhere the app needs a
// loading indicator. Rotation lands on 720deg (two full turns) so the
// infinite loop never visibly snaps at the seam.
export function LoadingSpinner({ size = 28 }) {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 100 70" style={{ overflow: "visible", display: "block" }}>
      <style>{`
        @keyframes dl-loader-spin {
          0%   { transform: rotate(0deg); }
          18%  { transform: rotate(38deg); }
          50%  { transform: rotate(430deg); }
          76%  { transform: rotate(675deg); }
          88%  { transform: rotate(712deg); }
          100% { transform: rotate(720deg); }
        }
        @keyframes dl-loader-scale {
          0%   { transform: scale(1); }
          12%  { transform: scale(0.8); }
          78%  { transform: scale(0.8); }
          90%  { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        .dl-loader-scalewrap { transform-box: fill-box; transform-origin: 50% 50%; animation: dl-loader-scale 1900ms ease-in-out infinite; }
        .dl-loader-triangle { transform-box: fill-box; transform-origin: 50% 50%; animation: dl-loader-spin 1900ms cubic-bezier(0.4,0,0.2,1) infinite; }
      `}</style>
      <g className="dl-loader-scalewrap">
        <g className="dl-loader-triangle">
          <polygon points="50,0.5 79,47 21,47" fill="none" stroke={T.text} strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </g>
      </g>
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
