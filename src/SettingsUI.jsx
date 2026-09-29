import { IconChevronLeft, IconChevronRight, IconSearch } from "./Icons";

// Shared building blocks for every Settings screen, matching the exercise
// picker's tile language: 16px-radius tiles, a tinted icon square, a
// condensed uppercase title, one short non-wrapping subtitle, and the
// tile's current value in the top-right corner (the same slot the picker
// uses for counts). Kept in one file so Home's Settings hub and every
// Preferences sub-screen can't drift apart visually.

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  soft: "#B8BDC7",
  accent: "#E8442E",
};

const condensed = "'Barlow Condensed', sans-serif";
const oneLine = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

// A navigation tile. Two per row by default (the caller's grid does the
// layout). `wide` spans both columns and switches to a horizontal layout
// with a trailing chevron, for sections with a single destination.
// `value` is the setting's current state ("Region", "2:00", "lb"),
// shown top-right. `disabled` renders it inert (e.g. Strava, locked).
export function SettingsTile({ title, subtitle, icon, value, badge, onClick, wide, danger, disabled }) {
  const edge = danger ? `${T.accent}80` : T.line;
  const titleColor = danger ? T.accent : T.text;
  const iconBox = (
    <div style={{ width: 36, height: 36, borderRadius: 10, background: danger ? `${T.accent}1F` : T.surface2, display: "flex", alignItems: "center", justifyContent: "center", color: danger ? T.accent : T.text, flexShrink: 0 }}>
      {icon}
    </div>
  );
  const common = {
    gridColumn: wide ? "1 / -1" : "auto",
    background: T.surface,
    border: `1px solid ${edge}`,
    borderRadius: 16,
    textAlign: "left",
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? "default" : "pointer",
    minWidth: 0,
    boxSizing: "border-box",
  };

  if (wide) {
    return (
      <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{ ...common, display: "flex", alignItems: "center", gap: 12, minHeight: 76, padding: "12px 14px" }}>
        {iconBox}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ fontFamily: condensed, fontSize: 20, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: titleColor, ...oneLine }}>{title}</span>
            {badge}
          </div>
          {subtitle && <span style={{ fontSize: 13, color: danger ? T.accent : T.dim, ...oneLine }}>{subtitle}</span>}
        </div>
        {value && <span style={{ fontFamily: condensed, fontSize: 17, fontWeight: 600, color: T.soft, flexShrink: 0, ...oneLine }}>{value}</span>}
        {!disabled && <IconChevronRight size={16} style={{ color: T.dim, flexShrink: 0 }} />}
      </button>
    );
  }

  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{ ...common, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14, minHeight: 118, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 8 }}>
        {iconBox}
        {badge || (value && <span style={{ fontFamily: condensed, fontSize: 17, fontWeight: 600, color: T.soft, minWidth: 0, ...oneLine }}>{value}</span>)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%", minWidth: 0 }}>
        <span style={{ fontFamily: condensed, fontSize: 20, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: titleColor, ...oneLine }}>{title}</span>
        {subtitle && <span style={{ fontSize: 13, color: danger ? T.accent : T.dim, ...oneLine }}>{subtitle}</span>}
      </div>
    </button>
  );
}

// Two-column tile grid.
export function TileGrid({ children, style }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, ...style }}>{children}</div>;
}

// Small uppercase group label above a TileGrid.
export function SettingsSectionLabel({ children }) {
  return <div style={{ fontFamily: condensed, fontSize: 14, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: T.soft, margin: "4px 4px 8px" }}>{children}</div>;
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
        <div style={{ fontFamily: condensed, fontSize: 24, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: T.text, ...oneLine }}>{title}</div>
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
        style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: T.text, fontSize: 16, fontFamily: "Barlow, 'Barlow Condensed', sans-serif" }}
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
        const on = value === opt.key;
        return (
          <button
            key={opt.key}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(opt.key)}
            style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 60, padding: "10px 14px", borderRadius: 12, background: on ? `${T.accent}14` : T.surface2, border: `1px solid ${on ? T.accent : T.line}`, textAlign: "left", boxSizing: "border-box", width: "100%" }}
          >
            <div style={{ width: 20, height: 20, borderRadius: 10, border: `2px solid ${on ? T.accent : "#4A505B"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxSizing: "border-box" }}>
              {on && <div style={{ width: 10, height: 10, borderRadius: 5, background: T.accent }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontFamily: condensed, fontSize: 18, fontWeight: 600, color: T.text, ...oneLine }}>{opt.label}</span>
              {opt.example && <span style={{ fontSize: 13, color: T.dim, ...oneLine }}>{opt.example}</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
