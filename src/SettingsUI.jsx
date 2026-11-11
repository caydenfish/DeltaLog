import { Children, cloneElement, isValidElement } from "react";
import { IconChevronLeft, IconChevronRight, IconSearch } from "./Icons";
import { themed, tc } from "./lib/theme";

// Shared building blocks for every Settings screen: grouped cards of
// full-width rows (tinted icon square, title, short subtitle, current
// value, chevron). Kept in one file so Home's Settings hub and every
// Preferences sub-screen can't drift apart visually.

const T = themed({
  bg: "#121418",
  surface: "#1B1E23",
  surface2: "#24282E",
  line: "#2F343B",
  text: "#E6E3D9",
  dim: "#8F949C",
  soft: "#BEBDB6",
  accent: "#C4A35A",
  danger: "#D0614C",
  accentDeep: "#8A6F33",
  spruce: "#3F6E55",
});

const condensed = "'Saira Condensed', sans-serif";
const oneLine = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

// A navigation row (v1.26.0). Settings used to be a two-up tile grid,
// which truncated titles and subtitles with ellipses; every destination
// is now a full-width row inside a grouped card (TileGrid), so text has
// the room it needs. Titles never truncate; subtitles wrap rather than
// clip if a phone is very narrow. `value` is the setting's current state
// ("Region", "2:00", "lb"), shown before the chevron. `wide` is accepted
// for old callers and ignored. `disabled` renders it inert.
export function SettingsTile({ title, subtitle, icon, value, badge, onClick, danger, disabled, divider }) {
  const titleColor = danger ? T.danger : T.text;
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 64, padding: "10px 14px", background: "transparent", border: "none", borderTop: divider ? `1px solid ${T.line}` : "none", textAlign: "left", opacity: disabled ? 0.55 : 1, cursor: disabled ? "default" : "pointer", boxSizing: "border-box" }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, background: danger ? `${T.danger}1F` : T.surface2, display: "flex", alignItems: "center", justifyContent: "center", color: danger ? T.danger : T.text, flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "'Chakra Petch', sans-serif", fontSize: 17, fontWeight: 600, color: titleColor, lineHeight: 1.2 }}>{title}</span>
          {badge}
        </div>
        {subtitle && <span style={{ fontSize: 13, color: danger ? T.danger : T.dim, lineHeight: 1.3 }}>{subtitle}</span>}
      </div>
      {value && <span style={{ fontFamily: "'Saira Condensed', sans-serif", fontSize: 16, fontWeight: 600, color: T.soft, flexShrink: 0, whiteSpace: "nowrap" }}>{value}</span>}
      {!disabled && <IconChevronRight size={16} style={{ color: T.dim, flexShrink: 0 }} />}
    </button>
  );
}

// Grouped card holding a section's rows, with dividers between them.
export function TileGrid({ children, style }) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <div style={{ display: "flex", flexDirection: "column", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, overflow: "hidden", ...style }}>
      {rows.map((c, i) => (isValidElement(c) && c.type === SettingsTile ? cloneElement(c, { divider: i > 0 }) : c))}
    </div>
  );
}

// Small uppercase group label above a TileGrid.
export function SettingsSectionLabel({ children }) {
  return <div style={{ fontFamily: "'Saira Condensed', sans-serif", fontSize: 14, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: T.soft, margin: "4px 4px 8px" }}>{children}</div>;
}

// Sticky screen header: 44px back button, left-aligned condensed title,
// optional small eyebrow line above it (the breadcrumb, e.g. "Settings").
export function ScreenHeader({ title, eyebrow, onBack, backLabel = "Back", right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 12px 10px", position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
      <button onClick={onBack} aria-label={backLabel} style={{ width: 44, height: 44, borderRadius: 10, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: T.text, flexShrink: 0 }}>
        <IconChevronLeft size={22} />
      </button>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {eyebrow && <div style={{ fontSize: 12, color: T.dim, letterSpacing: 0.6, textTransform: "uppercase", ...oneLine }}>{eyebrow}</div>}
        <div style={{ fontFamily: "'Chakra Petch', sans-serif", fontSize: 24, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: T.text, ...oneLine }}>{title}</div>
      </div>
      {right}
    </div>
  );
}

// 48px search field with a leading icon.
export function SettingsSearch({ value, onChange, placeholder = "Search settings" }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, height: 48, padding: "0 14px", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, color: T.dim, boxSizing: "border-box" }}>
      <IconSearch size={18} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: T.text, fontSize: 16, fontFamily: "inherit" }}
      />
    </label>
  );
}

// A stacked list of selectable option tiles (label + one-line example),
// for settings where the choice needs explaining, like Muscle Names.
export function OptionTiles({ options, value, onChange }) {
  return (
    <div role="radiogroup" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {options.map((opt) => {
        const locked = Boolean(opt.comingSoon);
        const on = !locked && value === opt.key;
        return (
          <button
            key={opt.key}
            role="radio"
            aria-checked={on}
            aria-disabled={locked}
            disabled={locked}
            onClick={() => { if (!locked) onChange(opt.key); }}
            style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 60, padding: "10px 14px", borderRadius: 12, background: on ? `${T.accent}14` : T.surface2, border: `1px solid ${on ? T.accent : T.line}`, textAlign: "left", boxSizing: "border-box", width: "100%", opacity: locked ? 0.55 : 1, cursor: locked ? "default" : "pointer" }}
          >
            <div style={{ width: 20, height: 20, borderRadius: 10, border: `2px solid ${on ? T.accent : tc("#4A4F57")}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxSizing: "border-box" }}>
              {on && <div style={{ width: 10, height: 10, borderRadius: 5, background: T.accent }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontFamily: "'Saira Condensed', sans-serif", fontSize: 18, fontWeight: 600, color: T.text, ...oneLine }}>{opt.label}</span>
              {opt.example && <span style={{ fontSize: 13, color: T.dim, ...oneLine }}>{opt.example}</span>}
            </div>
            {locked && <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: T.dim, border: `1px solid ${T.line}`, borderRadius: 999, padding: "3px 8px", whiteSpace: "nowrap" }}>Coming soon</span>}
          </button>
        );
      })}
    </div>
  );
}
