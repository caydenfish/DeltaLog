import { useState } from "react";
import { IconX } from "./Icons";
import { themed } from "./lib/theme";

import { BTN_TEXT, BTN_RADIUS } from "./lib/buttons";
const T = themed({
  bg: "#121418",
  surface: "#1B1E23",
  surface2: "#24282E",
  line: "#2F343B",
  text: "#E6E3D9",
  dim: "#8F949C",
  accent: "#C4A35A",
  danger: "#D0614C",
  accentDeep: "#8A6F33",
  spruce: "#3F6E55",
});

function detectPlatform() {
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return "android"; // reasonable default for desktop Chrome testing
}

const STEPS = {
  ios: [
    { text: "Open DeltaLog in Safari (not Chrome — Add to Home Screen is Safari-only on iPhone)." },
    { text: "Tap the Share button — the square with an arrow pointing up, in the bottom toolbar." },
    { text: 'Scroll down and tap "Add to Home Screen".' },
    { text: 'Tap "Add" in the top right. DeltaLog now opens full-screen from your home screen, just like any other app.' },
  ],
  android: [
    { text: "Open DeltaLog in Chrome, then tap the three-dot menu in the top right." },
    { text: 'Tap "Install app" (or "Add to Home screen" on some devices).' },
    { text: "Confirm the install prompt. DeltaLog now opens full-screen from your home screen, just like any other app." },
  ],
};

export default function InstallGuide({ onClose }) {
  const [platform, setPlatform] = useState(detectPlatform);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.75)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 400, maxHeight: "88vh", overflowY: "auto", background: T.bg, borderTop: `1px solid ${T.line}`, borderRadius: "20px 20px 0 0", padding: 20, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: "'Chakra Petch', sans-serif", fontSize: 22, fontWeight: 700, color: T.text }}>Put DeltaLog on your home screen</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, padding: "4px 10px", fontSize: 13, flexShrink: 0, marginLeft: 8, borderRadius: BTN_RADIUS }}><IconX size={12} /></button>
        </div>
        <div style={{ color: T.dim, fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
          DeltaLog works like a native app once it's installed — full-screen, its own icon, no browser bar. Takes about 10 seconds.
        </div>

        <div style={{ display: "flex", background: T.surface2, borderRadius: 10, padding: 3, gap: 3, marginBottom: 18 }}>
          {[{ key: "ios", label: "iPhone (Safari)" }, { key: "android", label: "Android (Chrome)" }].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setPlatform(opt.key)}
              style={{ flex: 1, padding: "9px 0", fontSize: 14, fontWeight: 600, border: "none", background: platform === opt.key ? T.accent : "transparent", color: platform === opt.key ? T.bg : T.dim, ...BTN_TEXT, borderRadius: BTN_RADIUS }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          {STEPS[platform].map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 999, background: T.surface2, color: T.text, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
              <div style={{ color: T.text, fontSize: 13.5, lineHeight: 1.5, paddingTop: 4 }}>{step.text}</div>
            </div>
          ))}
        </div>

        <button onClick={onClose} style={{ width: "100%", padding: "13px 0", border: "none", background: T.accent, color: T.bg, fontSize: 15, fontWeight: 700, ...BTN_TEXT, borderRadius: BTN_RADIUS }}>
          Got it
        </button>
      </div>
    </div>
  );
}
