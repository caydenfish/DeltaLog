import { useState } from "react";
import { T, THEME, THEMES, setTheme } from "./lib/theme";

// Theme chooser (v1.25.0). Full screen once per device before anything
// else after sign-in (new users ahead of setup, existing users on their
// next launch); the same cards appear in setup and Settings > Theme.
// Built from THEMES, so new themes show up here with no changes. Previews
// use each theme's own swatches, not T, so every card shows itself.
const condensed = "'Saira Condensed', sans-serif";

function Preview({ theme, on, onPick }) {
  const p = theme.preview;
  return (
    <button onClick={onPick} aria-pressed={on} style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 8, padding: 8, borderRadius: 16, border: `2px solid ${on ? T.accent : T.line}`, background: T.surface, textAlign: "left" }}>
      <div aria-hidden="true" style={{ height: 150, borderRadius: 10, background: p.bg, border: `1px solid ${p.line}`, padding: 9, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 7, overflow: "hidden" }}>
        <div style={{ background: p.surface, border: `1px solid ${p.line}`, borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontFamily: "'Saira Condensed', sans-serif", fontSize: 15, fontWeight: 700, color: p.text, lineHeight: 1 }}>Push A</span>
          <span style={{ height: 22, borderRadius: 5, background: p.accent, color: p.onAccent, fontFamily: "'Saira Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, display: "flex", alignItems: "center", justifyContent: "center" }}>START</span>
        </div>
        <div style={{ background: p.surface, border: `1px solid ${p.line}`, borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {[1, 0.6, 0.35].map((w, i) => (
            <span key={i} style={{ height: 5, borderRadius: 3, background: p.track, overflow: "hidden", display: "block" }}>
              <span style={{ display: "block", height: 5, width: `${w * 100}%`, background: i === 0 ? p.green : p.accent }} />
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px 2px" }}>
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <span style={{ fontFamily: "'Chakra Petch', sans-serif", fontSize: 20, fontWeight: 700, textTransform: "uppercase", color: T.text, lineHeight: 1.1 }}>{theme.name}</span>
          <span style={{ fontSize: 12, color: T.dim, lineHeight: 1.3 }}>{theme.blurb}</span>
        </span>
        <span style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 10, boxSizing: "border-box", border: `2px solid ${on ? T.accent : T.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {on && <span style={{ width: 10, height: 10, borderRadius: 5, background: T.accent }} />}
        </span>
      </div>
    </button>
  );
}

// Just the cards, two per row, for embedding.
export function ThemeChoice({ value, onChange }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
      {THEMES.map((t) => <Preview key={t.id} theme={t} on={value === t.id} onPick={() => onChange(t.id)} />)}
    </div>
  );
}

// Settings > Theme: picking a card applies it right away (reloads).
export function ThemeSettings() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ThemeChoice value={THEME} onChange={(id) => setTheme(id)} />
      <span style={{ fontSize: 13, color: T.dim }}>Applies right away. Saved on this device.</span>
    </div>
  );
}

export default function ThemePicker({ onDone }) {
  const [choice, setChoice] = useState(THEME);
  function confirm() {
    // Reloads when the theme changes; otherwise just records the choice.
    if (!setTheme(choice)) onDone();
  }
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, background: T.bg, color: T.text, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 420, boxSizing: "border-box", minHeight: "100dvh", display: "flex", flexDirection: "column", gap: 20, padding: "calc(28px + env(safe-area-inset-top, 0px)) 20px calc(24px + env(safe-area-inset-bottom, 0px))" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{ margin: 0, fontFamily: "'Chakra Petch', sans-serif", fontSize: 40, fontWeight: 700, lineHeight: 1, textTransform: "uppercase" }}>Pick a theme</h1>
          <span style={{ fontSize: 15, color: T.dim }}>Change it anytime in Settings.</span>
        </div>
        <ThemeChoice value={choice} onChange={setChoice} />
        <button onClick={confirm} style={{ marginTop: "auto", height: 52, borderRadius: 14, border: "none", background: T.accent, color: T.bg, fontFamily: "'Saira Condensed', sans-serif", fontSize: 19, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>Continue</button>
      </div>
    </div>
  );
}
