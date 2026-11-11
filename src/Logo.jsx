import { useId } from "react";
import { T, tc } from "./lib/theme";

// Mark, final (v1.25.0): the "Forged" body (heavy miter delta, square
// plates, 120x100 grid) with the "Scan" glitch. At exactly half the
// delta's height one band tears right, a thin gold band tears left, with
// two faint scanlines. Below ~32px the tears turn to noise, so `plain`
// drops them and thickens the strokes (tiny icons).
//
// v1.27.0: `live` animates the glitch for loading states. The mark sits
// still in its resting pose; every 2.8s a ~400ms burst jumps the tears
// in steps, opens a third tear lower down, flashes a green channel ghost
// and flickers the scanlines, then snaps back. Off for reduced motion.
const DELTA = "60,12 90,64 30,64";
const GREEN = tc("#82AD93");

const GLITCH_CSS = `
@keyframes dl-ga { 0%, 79% { transform: translateX(0); } 80% { transform: translateX(5px); } 83% { transform: translateX(-4px); } 86% { transform: translateX(8px); } 90% { transform: translateX(2px); } 93%, 100% { transform: translateX(0); } }
@keyframes dl-gb { 0%, 79% { transform: translateX(0); } 80% { transform: translateX(-5px); } 83% { transform: translateX(3px); } 86% { transform: translateX(-8px); } 90% { transform: translateX(-2px); } 93%, 100% { transform: translateX(0); } }
@keyframes dl-gc { 0%, 82% { transform: translateX(0); } 83% { transform: translateX(-6px); } 86% { transform: translateX(4px); } 90% { transform: translateX(-3px); } 93%, 100% { transform: translateX(0); } }
@keyframes dl-gg { 0%, 79% { opacity: 0; transform: translateX(0); } 80% { opacity: 0.9; transform: translateX(3px); } 86% { opacity: 0.9; transform: translateX(-4px); } 90% { opacity: 0.6; transform: translateX(5px); } 93%, 100% { opacity: 0; transform: translateX(0); } }
@keyframes dl-gs { 0%, 79% { opacity: 1; transform: translateX(0); } 80% { opacity: 1; transform: translateX(7px); } 83% { opacity: 0.2; } 86% { opacity: 1; transform: translateX(-6px); } 90% { opacity: 0.4; transform: translateX(3px); } 93%, 100% { opacity: 1; transform: translateX(0); } }
.dl-live .dl-ga { animation: dl-ga 2.8s steps(1, end) infinite; }
.dl-live .dl-gb { animation: dl-gb 2.8s steps(1, end) infinite; }
.dl-live .dl-gc { animation: dl-gc 2.8s steps(1, end) infinite; }
.dl-live .dl-gg { animation: dl-gg 2.8s steps(1, end) infinite; }
.dl-live .dl-gs { animation: dl-gs 2.8s steps(1, end) infinite; }
.dl-gg { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .dl-live .dl-ga, .dl-live .dl-gb, .dl-live .dl-gc, .dl-live .dl-gg, .dl-live .dl-gs { animation: none; } }
`;

export function MarkBarbell() {
  return (
    <g fill={T.accent}>
      <rect x="20" y="72.5" width="80" height="5" />
      <rect x="8" y="54" width="11" height="42" rx="1" />
      <rect x="0" y="61" width="7" height="28" rx="1" />
      <rect x="101" y="54" width="11" height="42" rx="1" />
      <rect x="113" y="61" width="7" height="28" rx="1" />
    </g>
  );
}

export function MarkDelta({ plain = false, live = false }) {
  const id = useId().replace(/:/g, "");
  const tri = { fill: "none", strokeWidth: plain ? 11 : 9, strokeLinejoin: "miter", strokeMiterlimit: 10 };
  if (plain) return <polygon points={DELTA} {...tri} stroke={T.text} />;
  const band = (key, y, h) => <clipPath id={`${id}${key}`}><rect x="-20" y={y} width="160" height={h} /></clipPath>;
  const clip = (key) => `url(#${id}${key})`;
  return (
    <g className={live ? "dl-live" : undefined}>
      {live && <style>{GLITCH_CSS}</style>}
      <defs>
        {band("t", -20, 52.5)}
        {band("a", 32.5, 3)}
        {band("m", 35.5, 1.5)}
        {band("b", 37, 2.5)}
        {band("z", 39.5, 6.5)}
        {band("c", 46, 2.5)}
        {band("y", 48.5, 70)}
      </defs>
      <polygon points={DELTA} {...tri} stroke={T.text} clipPath={clip("t")} />
      <g clipPath={clip("a")}>
        {live && <g className="dl-gg"><polygon points={DELTA} {...tri} stroke={GREEN} transform="translate(9.5 0)" /></g>}
        <g className="dl-ga"><polygon points={DELTA} {...tri} stroke={T.text} transform="translate(5.5 0)" /></g>
      </g>
      <polygon points={DELTA} {...tri} stroke={T.text} clipPath={clip("m")} />
      <g clipPath={clip("b")}><g className="dl-gb"><polygon points={DELTA} {...tri} stroke={T.accent} transform="translate(-4 0)" /></g></g>
      <polygon points={DELTA} {...tri} stroke={T.text} clipPath={clip("z")} />
      <g clipPath={clip("c")}><g className="dl-gc"><polygon points={DELTA} {...tri} stroke={T.text} /></g></g>
      <polygon points={DELTA} {...tri} stroke={T.text} clipPath={clip("y")} />
      <g className="dl-gs">
        <rect x="28" y="33.4" width="11" height="0.8" fill={T.text} opacity="0.55" />
        <rect x="84" y="38.1" width="8" height="0.8" fill={T.accent} opacity="0.7" />
      </g>
    </g>
  );
}

export default function Logo({ size = 40, plain = false, live = false }) {
  const height = (size * 100) / 120;
  return (
    <svg width={size} height={height} viewBox="0 0 120 100" style={{ display: "block", overflow: "visible" }} role="img" aria-label="DeltaLog">
      <MarkBarbell />
      <MarkDelta plain={plain} live={live} />
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
