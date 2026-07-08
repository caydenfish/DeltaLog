import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTutorial } from "./TutorialContext";
import { IconCheck } from "./Icons";

const T = {
  bg: "#1A1D23",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

// True if `el` is currently the topmost thing at its own center point —
// i.e. actually visible, not just present in the DOM but covered by
// another full-screen panel (Settings and Templates stay mounted as
// siblings in this app, so a plain querySelector match isn't enough).
function isVisible(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) return false;
  const top = document.elementFromPoint(cx, cy);
  return Boolean(top) && (top === el || el.contains(top) || top.contains(el));
}

// Small looping animation for the plate-calculator step: plates slide
// onto the bar from either side, sit for a beat, then slide back off.
function PlateCalcVisual() {
  return (
    <div style={{ width: "100%", height: 46, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @keyframes dl-slide-left { 0% { transform: translateX(-14px); opacity: 0; } 30%, 70% { transform: translateX(0); opacity: 1; } 100% { transform: translateX(-14px); opacity: 0; } }
        @keyframes dl-slide-right { 0% { transform: translateX(14px); opacity: 0; } 30%, 70% { transform: translateX(0); opacity: 1; } 100% { transform: translateX(14px); opacity: 0; } }
      `}</style>
      <svg width="140" height="40" viewBox="0 0 140 40">
        <line x1="10" y1="20" x2="130" y2="20" stroke={T.dim} strokeWidth="3" />
        <rect x="30" y="10" width="6" height="20" rx="1" fill={T.dim} opacity="0.5" />
        <rect x="104" y="10" width="6" height="20" rx="1" fill={T.dim} opacity="0.5" />
        <g style={{ animation: "dl-slide-left 2.2s ease-in-out infinite" }}>
          <rect x="12" y="4" width="10" height="32" rx="2" fill={T.accent} />
        </g>
        <g style={{ animation: "dl-slide-left 2.2s ease-in-out infinite 0.15s" }}>
          <rect x="24" y="7" width="7" height="26" rx="2" fill={T.accent} opacity="0.75" />
        </g>
        <g style={{ animation: "dl-slide-right 2.2s ease-in-out infinite" }}>
          <rect x="118" y="4" width="10" height="32" rx="2" fill={T.accent} />
        </g>
        <g style={{ animation: "dl-slide-right 2.2s ease-in-out infinite 0.15s" }}>
          <rect x="109" y="7" width="7" height="26" rx="2" fill={T.accent} opacity="0.75" />
        </g>
      </svg>
    </div>
  );
}

const MARGIN = 5;
const EDGE = 12; // minimum gap between the card and any screen edge
const NAV_RENDER_DELAY = 400; // lets a newly opened screen render before the next tip anchors

export default function TutorialOverlay() {
  const { active, step, stepIndex, totalSteps, next, prev, skip } = useTutorial();
  const [rect, setRect] = useState(null);
  const [cardH, setCardH] = useState(160);
  const rafRef = useRef(null);
  const timerRef = useRef(null);
  const cardRef = useRef(null);

  // Track the highlighted element's position each frame so the ring and
  // card follow it through scrolls and layout shifts. Purely passive —
  // nothing in here ever advances the tour on its own.
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const el = step.target ? document.querySelector(step.target) : null;
      const visible = el && isVisible(el);
      setRect((prev2) => {
        if (!visible) return null;
        const r = el.getBoundingClientRect();
        if (prev2 && Math.abs(prev2.top - r.top) < 0.5 && Math.abs(prev2.left - r.left) < 0.5 && Math.abs(prev2.width - r.width) < 0.5) return prev2;
        return { top: r.top, left: r.left, width: r.width, height: r.height };
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, step]);

  // Measure the card's real height after each render so placement can
  // clamp it fully on-screen instead of guessing.
  useLayoutEffect(() => {
    if (cardRef.current) {
      const h = cardRef.current.getBoundingClientRect().height;
      if (Math.abs(h - cardH) > 1) setCardH(h);
    }
  });

  // When a step activates, scroll its target to the middle of the screen
  // (retrying briefly, since a just-opened panel may still be rendering).
  // Prevents the ring anchoring to a half-off-screen element.
  useEffect(() => {
    if (!active || !step.target) return;
    let tries = 0;
    const id = setInterval(() => {
      const el = document.querySelector(step.target);
      tries += 1;
      if (el) {
        el.scrollIntoView({ block: "center", inline: "nearest" });
        clearInterval(id);
      } else if (tries > 10) {
        clearInterval(id);
      }
    }, 120);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex]);

  if (!active) return null;

  // Next: for "nav" steps, taps the real element first (so the tour does
  // the navigating, never the person), then advances once the new screen
  // has had a moment to render. `onAdvance` closes a screen the tour
  // opened on the way out. "info" steps just move on.
  function handleNext() {
    const proceed = () => {
      if (step.onAdvance) {
        const closeEl = document.querySelector(step.onAdvance);
        if (closeEl) {
          closeEl.click();
          timerRef.current = setTimeout(next, NAV_RENDER_DELAY);
          return;
        }
      }
      next();
    };
    if (step.mode === "nav") {
      const el = step.target ? document.querySelector(step.target) : null;
      if (el) {
        el.click();
        timerRef.current = setTimeout(proceed, NAV_RENDER_DELAY);
        return;
      }
    }
    proceed();
  }

  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const box = rect
    ? { top: rect.top - MARGIN, left: rect.left - MARGIN, width: rect.width + MARGIN * 2, height: rect.height + MARGIN * 2 }
    : null;

  // Small coach-mark card anchored next to the target, clamped hard to
  // the viewport on every side using its measured height. With no target
  // (concept steps), it sits low on screen like a toast.
  const cardWidth = Math.min(step.visual ? 280 : 252, vw - EDGE * 2);
  let cardStyle;
  if (box) {
    const spaceBelow = vh - (box.top + box.height);
    const placeBelow = spaceBelow >= cardH + EDGE * 2 || spaceBelow > box.top;
    let top = placeBelow ? box.top + box.height + 10 : box.top - cardH - 10;
    top = Math.max(EDGE, Math.min(top, vh - cardH - EDGE));
    let left = box.left + box.width / 2 - cardWidth / 2;
    left = Math.max(EDGE, Math.min(left, vw - cardWidth - EDGE));
    cardStyle = { position: "fixed", top, left, width: cardWidth };
  } else {
    cardStyle = { position: "fixed", left: Math.max(EDGE, (vw - cardWidth) / 2), bottom: 28, width: cardWidth };
  }

  const arrowBtn = (disabled) => ({
    width: 30, height: 30, borderRadius: 999, flexShrink: 0,
    border: `1px solid ${disabled ? T.line : T.accent}`,
    background: disabled ? "none" : T.accent,
    color: disabled ? T.line : "#fff",
    fontSize: 15, fontWeight: 700, lineHeight: 1,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none" }}>
      {/* A soft highlight ring around the real target — no dimming, no
          click-blocking, the rest of the screen stays fully usable. */}
      {box && (
        <div style={{
          position: "fixed", pointerEvents: "none", top: box.top, left: box.left, width: box.width, height: box.height,
          borderRadius: 12, border: `2px solid ${T.accent}`, boxShadow: "0 0 0 4px rgba(232,68,46,0.18)",
          transition: "top 0.15s, left 0.15s, width 0.15s, height 0.15s",
        }} />
      )}

      <div ref={cardRef} style={{ ...cardStyle, maxWidth: `calc(100vw - ${EDGE * 2}px)`, pointerEvents: "auto", background: T.bg, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 14px", boxSizing: "border-box", boxShadow: "0 6px 20px rgba(0,0,0,0.45)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, color: T.text, lineHeight: 1.2 }}>{step.title}</div>
          <button onClick={skip} style={{ background: "none", border: "none", color: T.dim, fontSize: 10, padding: 0, flexShrink: 0 }}>Skip tour</button>
        </div>

        {step.visual === "plateCalc" && <PlateCalcVisual />}

        <div style={{ fontSize: 12, color: T.dim, lineHeight: 1.45, marginBottom: 10 }}>{step.body}</div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={prev} disabled={stepIndex === 0} aria-label="Back" style={arrowBtn(stepIndex === 0)}>‹</button>
          <div style={{ display: "flex", gap: 3, flex: 1, justifyContent: "center", minWidth: 0, flexWrap: "wrap" }}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} style={{ width: i === stepIndex ? 12 : 4, height: 4, borderRadius: 999, background: i === stepIndex ? T.accent : T.line, transition: "width 0.15s" }} />
            ))}
          </div>
          <button onClick={handleNext} aria-label={stepIndex === totalSteps - 1 ? "Done" : "Next"} style={arrowBtn(false)}>
            {stepIndex === totalSteps - 1 ? <IconCheck size={13} /> : "›"}
          </button>
        </div>
      </div>
    </div>
  );
}
