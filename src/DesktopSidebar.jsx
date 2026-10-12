import { IconPlus, IconCalendar, IconList, IconBarbell, IconUsers, IconGear, IconHome } from "./Icons";
import Logo from "./Logo";

const T = {
  side: "#14161B",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  soft: "#A3A9B4",
  accent: "#E8442E",
};
const oneLine = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

export const DESKTOP_SECTIONS = [
  { id: "dashboard", label: "Dashboard", Icon: IconHome },
  { id: "history", label: "History", Icon: IconCalendar },
  { id: "templates", label: "Templates", Icon: IconList },
  { id: "library", label: "Exercise Library", Icon: IconBarbell },
  { id: "friends", label: "Friends", Icon: IconUsers },
  { id: "settings", label: "Settings", Icon: IconGear },
];

// Persistent left navigation for the desktop layout (v1.18.0). Every
// section maps onto a screen the phone app already has, so desktop and
// phone never drift apart feature-wise.
export default function DesktopSidebar({ active, onNavigate, onStart, startLabel, startSub, name, handle }) {
  return (
    <nav aria-label="Main" style={{ width: 240, flexShrink: 0, boxSizing: "border-box", height: "100dvh", background: T.side, borderRight: `1px solid ${T.line}`, padding: "20px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ padding: "0 8px 18px", display: "flex", alignItems: "center" }}>
        <Logo size={56} />
      </div>
      {DESKTOP_SECTIONS.map(({ id, label, Icon }) => {
        const on = id === active;
        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            aria-current={on ? "page" : undefined}
            style={{ display: "flex", alignItems: "center", gap: 12, height: 44, padding: "0 12px", borderRadius: 10, border: "none", background: on ? T.surface2 : "transparent", color: on ? T.text : T.soft, fontSize: 15, fontWeight: on ? 700 : 500, textAlign: "left", ...oneLine }}
          >
            <Icon size={18} /> {label}
          </button>
        );
      })}
      <div style={{ flex: 1 }} />
      <button onClick={onStart} style={{ minHeight: 50, borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 15, fontWeight: 700, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, whiteSpace: "nowrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>{!startSub && <IconPlus size={15} />}{startLabel}</span>
        {startSub && <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.85, fontVariantNumeric: "tabular-nums" }}>{startSub}</span>}
      </button>
      {(name || handle) && (
        <button onClick={() => onNavigate("friends")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 8px 2px", background: "none", border: "none", textAlign: "left", color: T.text }}>
          <span style={{ width: 32, height: 32, borderRadius: 16, background: T.surface2, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{(name || handle || "?").charAt(0).toUpperCase()}</span>
          <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            {name && <span style={{ fontSize: 14, fontWeight: 600, ...oneLine }}>{name}</span>}
            <span style={{ fontSize: 12, color: T.dim, ...oneLine }}>{handle ? `@${handle}` : "Pick your ID"}</span>
          </span>
        </button>
      )}
    </nav>
  );
}
