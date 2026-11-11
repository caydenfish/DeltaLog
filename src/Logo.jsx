import { useId } from "react";
import { T } from "./lib/theme";

// Mark, final (v1.25.0): the "Forged" body (heavy miter delta, square
// plates, 120x100 grid) with the "Scan" glitch. At exactly half the
// delta's height one band tears right, a thin gold band tears left, with
// two faint scanlines. Below ~32px the tears turn to noise, so `plain`
// drops them and thickens the strokes (tiny icons).
const DELTA = "60,12 90,64 30,64";

export default function Logo({ size = 40, plain = false }) {
  const id = useId().replace(/:/g, "");
  const height = (size * 100) / 120;
  const tri = { fill: "none", strokeWidth: plain ? 11 : 9, strokeLinejoin: "miter", strokeMiterlimit: 10 };
  return (
    <svg width={size} height={height} viewBox="0 0 120 100" style={{ display: "block" }} role="img" aria-label="DeltaLog">
      <g fill={T.accent}>
        <rect x="20" y="72.5" width="80" height="5" />
        <rect x="8" y="54" width="11" height="42" rx="1" />
        <rect x="0" y="61" width="7" height="28" rx="1" />
        <rect x="101" y="54" width="11" height="42" rx="1" />
        <rect x="113" y="61" width="7" height="28" rx="1" />
      </g>
      {plain ? (
        <polygon points={DELTA} {...tri} stroke={T.text} />
      ) : (
        <>
          <defs>
            <clipPath id={`${id}t`}><rect x="0" y="0" width="120" height="32.5" /></clipPath>
            <clipPath id={`${id}a`}><rect x="0" y="32.5" width="120" height="3" /></clipPath>
            <clipPath id={`${id}m`}><rect x="0" y="35.5" width="120" height="1.5" /></clipPath>
            <clipPath id={`${id}b`}><rect x="0" y="37" width="120" height="2.5" /></clipPath>
            <clipPath id={`${id}z`}><rect x="0" y="39.5" width="120" height="70" /></clipPath>
          </defs>
          <polygon points={DELTA} {...tri} stroke={T.text} clipPath={`url(#${id}t)`} />
          <g clipPath={`url(#${id}a)`}><polygon points={DELTA} {...tri} stroke={T.text} transform="translate(5.5 0)" /></g>
          <polygon points={DELTA} {...tri} stroke={T.text} clipPath={`url(#${id}m)`} />
          <g clipPath={`url(#${id}b)`}><polygon points={DELTA} {...tri} stroke={T.accent} transform="translate(-4 0)" /></g>
          <polygon points={DELTA} {...tri} stroke={T.text} clipPath={`url(#${id}z)`} />
          <rect x="28" y="33.4" width="11" height="0.8" fill={T.text} opacity="0.55" />
          <rect x="84" y="38.1" width="8" height="0.8" fill={T.accent} opacity="0.7" />
        </>
      )}
    </svg>
  );
}

// Wordmark: "Delta" matches the delta (text color), "Log" the barbell (gold).
export function Wordmark({ size = 26 }) {
  return (
    <span style={{ fontFamily: "'Chakra Petch', sans-serif", fontSize: size, fontWeight: 700, letterSpacing: 0.3, whiteSpace: "nowrap" }}>
      <span style={{ color: T.text }}>Delta</span>
      <span style={{ color: T.accent }}>Log</span>
    </span>
  );
}
