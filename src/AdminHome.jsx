const T = {
  bg: "#101216",
  surface: "#1A1D23",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

const rowStyle = { width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" };

function Row({ onClick, title, subtitle, badge }) {
  return (
    <button onClick={onClick} style={rowStyle}>
      <div>
        <div style={{ color: T.text, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          {title}
          {badge > 0 && (
            <span style={{ background: T.accent, color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "1px 7px", lineHeight: 1.5 }}>{badge}</span>
          )}
        </div>
        <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>{subtitle}</div>
      </div>
      <div style={{ color: T.dim, fontSize: 16 }}>›</div>
    </button>
  );
}

// Two-state pill switch for "Admin" vs "Normal" view. Kept as an explicit
// two-way toggle (not a boolean checkbox) so the current mode is always
// legible at a glance, not just inferred from an on/off position.
function ViewModeToggle({ mode, onChange }) {
  const optionStyle = (active) => ({
    flex: 1,
    padding: "8px 0",
    borderRadius: 8,
    border: "none",
    background: active ? T.accent : "transparent",
    color: active ? "#fff" : T.dim,
    fontSize: 13,
    fontWeight: 700,
  });
  return (
    <div style={{ display: "flex", gap: 4, background: T.bg, border: `1px solid ${T.line}`, borderRadius: 10, padding: 4 }}>
      <button style={optionStyle(mode === "admin")} onClick={() => onChange("admin")}>Admin</button>
      <button style={optionStyle(mode === "normal")} onClick={() => onChange("normal")}>Normal</button>
    </div>
  );
}

// One entry point for every admin-only tool, reached via a single "Admin"
// row in Settings instead of a growing list of admin buttons living
// alongside everyday preferences.
export default function AdminHome({ onClose, onOpenExercises, onOpenFeedback, onSimulateNewUser, onOpenVersionHistory, onOpenRoles, onOpenSplits, onOpenUserActivity, unseenFeedbackCount, adminViewMode, onSetAdminViewMode, isCreator }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 25, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 400, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 13 }}>‹</button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: T.text, textAlign: "center" }}>ADMIN</div>
          <div style={{ width: 26 }} />
        </div>

        <div style={{ padding: 16, flex: 1 }}>
          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ color: T.text, fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Admin View</div>
            <div style={{ color: T.dim, fontSize: 11, marginBottom: 10 }}>
              {adminViewMode === "admin"
                ? "You see every admin control across the app."
                : "Admin controls are hidden — you see exactly what a regular user sees. Come back here anytime to switch back."}
            </div>
            <ViewModeToggle mode={adminViewMode} onChange={onSetAdminViewMode} />
          </div>
          <Row onClick={onOpenExercises} title="Custom Exercises" subtitle="Review and promote user submissions" />
          <Row onClick={onOpenFeedback} title="Feedback & Bugs" subtitle="Bug reports, feature requests, and privacy submissions from users" badge={unseenFeedbackCount} />
          <Row onClick={onOpenSplits} title="Splits" subtitle="Edit which muscle groups belong to Push, Pull, Legs, and more" />
          {isCreator && <Row onClick={onOpenRoles} title="Roles" subtitle="Grant or remove Admin and Creator access" />}
          {isCreator && <Row onClick={onOpenUserActivity} title="User Activity" subtitle="Who's opening the app vs. actually logging sets" />}
          <Row onClick={onSimulateNewUser} title="Simulate new-user experience" subtitle="Runs the setup wizard, then the tutorial — same flow a brand-new signup sees" />
          <Row onClick={onOpenVersionHistory} title="Version History" subtitle="In-depth, searchable changelog of every release" />
        </div>
      </div>
    </div>
  );
}
