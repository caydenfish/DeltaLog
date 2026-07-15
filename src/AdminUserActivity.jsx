import { useEffect, useState } from "react";
import { adminGetUserActivity } from "./lib/queries";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
  green: "#3BA55D",
  yellow: "#D4A32C",
};

const smallBtn = { background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 11 };

const STATUS_STYLE = {
  active: { color: T.green, label: "Active" },
  "at risk": { color: T.yellow, label: "At risk" },
  churned: { color: T.accent, label: "Churned" },
  "never used": { color: T.dim, label: "Never used" },
};

const FILTERS = ["all", "active", "at risk", "churned", "never used"];

function timeAgo(iso) {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

// Admin-only usage dashboard. Two signals per user, deliberately shown
// side by side rather than collapsed into one number:
//   - "Opened"  → last time the app loaded for them at all (App.jsx
//     stamps this on every session via log_app_open).
//   - "Logged"  → last time they actually recorded a set — the real
//     signal that they used the app for what it's for. `status` below
//     is bucketed off this, not off "opened".
// A wide gap between the two (opened recently, logged a while back)
// means they're still coming back but not working out — worth a
// different follow-up than someone who's stopped opening it entirely.
export default function AdminUserActivity({ onClose }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    adminGetUserActivity()
      .then(setRows)
      .catch((err) => setError(err.message));
  }, []);

  const filtered = rows ? rows.filter((r) => filter === "all" || r.status === filter) : null;
  const counts = rows
    ? rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {})
    : {};

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 30, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 480, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8, position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
          <button onClick={onClose} aria-label="Close" style={smallBtn}>‹</button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: T.text, textAlign: "center" }}>USER ACTIVITY</div>
          <div style={{ width: 26 }} />
        </div>

        <div style={{ padding: 16, flex: 1 }}>
          {error && <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: T.surface2, border: `1px solid ${T.accent}`, color: T.accent, fontSize: 13 }}>{error}</div>}

          {rows === null && !error && <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>Loading…</div>}

          {rows && (
            <>
              <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      ...smallBtn,
                      padding: "6px 10px",
                      color: filter === f ? "#fff" : T.dim,
                      background: filter === f ? T.accent : "none",
                      borderColor: filter === f ? T.accent : T.line,
                    }}
                  >
                    {f === "all" ? `All (${rows.length})` : `${STATUS_STYLE[f].label} (${counts[f] || 0})`}
                  </button>
                ))}
              </div>

              {filtered.length === 0 && <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>No users in this bucket.</div>}

              {filtered.map((r) => {
                const s = STATUS_STYLE[r.status] || STATUS_STYLE["never used"];
                return (
                  <div key={r.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>{r.display_name}</div>
                        <div style={{ color: T.dim, fontSize: 12 }}>{r.email}</div>
                      </div>
                      <span style={{ color: s.color, fontSize: 11, fontWeight: 700, border: `1px solid ${s.color}`, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>
                        {s.label}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ color: T.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Opened</div>
                        <div style={{ color: T.text, fontSize: 12.5 }}>{timeAgo(r.last_opened_at)}</div>
                      </div>
                      <div>
                        <div style={{ color: T.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Logged a set</div>
                        <div style={{ color: T.text, fontSize: 12.5 }}>{timeAgo(r.last_set_at)}</div>
                      </div>
                      <div>
                        <div style={{ color: T.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Workouts</div>
                        <div style={{ color: T.text, fontSize: 12.5 }}>{r.total_workouts}</div>
                      </div>
                      <div>
                        <div style={{ color: T.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Sets</div>
                        <div style={{ color: T.text, fontSize: 12.5 }}>{r.total_sets}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
