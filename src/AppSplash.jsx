import { useEffect, useState } from "react";

const T = {
  bg: "#101216",
  text: "#F2F1EC",
  accent: "#E8442E",
};

// Timing for each phase. MIN_LOADING_MS keeps the splash from flashing by
// for a single frame on a fast/cached load — there's always at least a
// beat of the logo on screen before it starts animating away.
const MIN_LOADING_MS = 550;
const EXTEND_MS = 480;
const HORIZON_MS = 700;
const SEPARATE_MS = 520;

// Shown while App.jsx is still resolving session/profile/setup/resume
// state. Once `ready` flips true: the barbell stretches horizontally off
// both edges of the screen, a Tron-style perspective grid horizon fades
// in below the bar for a beat, then the barbell/grid and triangle slide
// apart vertically (down and up respectively) while the backdrop fades,
// so the real app appears to be revealed from behind the logo.
export default function AppSplash({ ready }) {
  const [phase, setPhase] = useState("loading"); // loading -> extend -> horizon -> separate -> done
  const [mountedAt] = useState(() => Date.now());

  useEffect(() => {
    if (!ready || phase !== "loading") return;
    const elapsed = Date.now() - mountedAt;
    const wait = Math.max(0, MIN_LOADING_MS - elapsed);
    const t = setTimeout(() => setPhase("extend"), wait);
    return () => clearTimeout(t);
  }, [ready, phase, mountedAt]);

  useEffect(() => {
    if (phase !== "extend") return;
    const t = setTimeout(() => setPhase("horizon"), EXTEND_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "horizon") return;
    const t = setTimeout(() => setPhase("separate"), HORIZON_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "separate") return;
    const t = setTimeout(() => setPhase("done"), SEPARATE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div
      aria-hidden="true"
      className={`dl-splash-${phase}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: T.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        pointerEvents: "none",
        opacity: phase === "separate" ? 0 : 1,
        transition: phase === "separate" ? `opacity ${SEPARATE_MS}ms ease ${SEPARATE_MS * 0.25}ms` : "none",
      }}
    >
      <style>{`
        @keyframes dl-splash-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        @keyframes dl-horizon-scroll { from { background-position: 0 0, 0 0; } to { background-position: 0 0, 0 46px; } }
        .dl-splash-barbell, .dl-splash-triangle { transform-box: fill-box; }
        .dl-splash-barbell {
          transform-origin: 50% 78%;
          transition: transform ${EXTEND_MS}ms cubic-bezier(0.5,0,0.2,1);
        }
        .dl-splash-triangle {
          transform-origin: 50% 34%;
          transition: transform ${SEPARATE_MS}ms cubic-bezier(0.5,0,0.2,1);
        }
        .dl-splash-loading .dl-splash-barbell,
        .dl-splash-loading .dl-splash-triangle {
          animation: dl-splash-pulse 1.7s ease-in-out infinite;
        }
        .dl-splash-extend .dl-splash-barbell,
        .dl-splash-horizon .dl-splash-barbell,
        .dl-splash-separate .dl-splash-barbell {
          transform: scaleX(18);
        }
        .dl-splash-separate .dl-splash-barbell {
          transition: transform ${SEPARATE_MS}ms cubic-bezier(0.5,0,0.2,1);
          transform: scaleX(18) translateY(140vh);
        }
        .dl-splash-separate .dl-splash-triangle {
          transform: translateY(-140vh);
        }

        /* Tron-style perspective grid horizon, anchored to the barbell's
           bar line (44px below viewport center at this SVG's fixed
           220x154 render size). Fades in as the bar finishes extending,
           holds through the "horizon" dwell phase, then rides down with
           the bar during the split/reveal. */
        .dl-splash-horizon-wrap {
          position: absolute;
          left: 0;
          right: 0;
          top: calc(50% + 44px);
          bottom: 0;
          overflow: hidden;
          opacity: 0;
          transition: opacity ${EXTEND_MS}ms ease;
        }
        .dl-splash-extend .dl-splash-horizon-wrap,
        .dl-splash-horizon .dl-splash-horizon-wrap {
          opacity: 1;
        }
        .dl-splash-separate .dl-splash-horizon-wrap {
          opacity: 0;
          transform: translateY(140vh);
          transition: transform ${SEPARATE_MS}ms cubic-bezier(0.5,0,0.2,1), opacity ${SEPARATE_MS}ms ease;
        }
        .dl-splash-horizon-glow {
          position: absolute;
          top: 0;
          left: 50%;
          width: min(140vw, 1100px);
          height: 160px;
          transform: translate(-50%, -50%);
          background: radial-gradient(ellipse at center, rgba(232,68,46,0.55) 0%, rgba(232,68,46,0.18) 40%, rgba(232,68,46,0) 72%);
          filter: blur(2px);
        }
        .dl-splash-horizon-floor {
          position: absolute;
          top: 0;
          left: 50%;
          width: 320vw;
          height: 140vh;
          transform-origin: top center;
          transform: translateX(-50%) perspective(240px) rotateX(66deg);
          background-image:
            linear-gradient(90deg, rgba(232,68,46,0.55) 1px, transparent 1px),
            linear-gradient(rgba(232,68,46,0.4) 1px, transparent 1px);
          background-size: 46px 46px, 46px 46px;
          -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,1) 12%);
          mask-image: linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,1) 12%);
          animation: dl-horizon-scroll 900ms linear infinite;
        }
      `}</style>
      <div className="dl-splash-horizon-wrap">
        <div className="dl-splash-horizon-glow" />
        <div className="dl-splash-horizon-floor" />
      </div>
      <svg
        className={`dl-splash-${phase}`}
        width={220}
        height={154}
        viewBox="0 0 100 70"
        style={{ overflow: "visible", position: "relative" }}
      >
        <g className="dl-splash-barbell">
          <line x1="0" y1="55" x2="100" y2="55" stroke={T.accent} strokeWidth="3" vectorEffect="non-scaling-stroke" />
          <rect x="0" y="43" width="7.5" height="24" rx="1.5" fill={T.accent} />
          <rect x="8.5" y="40" width="9.5" height="30" rx="1.5" fill={T.accent} />
          <rect x="92.5" y="43" width="7.5" height="24" rx="1.5" fill={T.accent} />
          <rect x="82" y="40" width="9.5" height="30" rx="1.5" fill={T.accent} />
        </g>
        <g className="dl-splash-triangle">
          <polygon points="50,0.5 79,47 21,47" fill="none" stroke={T.text} strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </g>
      </svg>
    </div>
  );
}
