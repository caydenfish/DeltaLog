import { useState } from "react";
import { adminSearchUsers, adminSetIsAdmin, adminSetIsCreator } from "./lib/queries";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
  green: "#3BA55D",
  purple: "#9B7FE8",
};

const smallBtn = { background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 11 };

function roleLabel(row) {
  if (row.is_creator) return "Creator";
  if (row.is_admin) return "Admin";
  return "User";
}

// Single place to see and change everyone's role tier: User → Admin →
// Creator. Only reachable by a Creator (gated in Home.jsx/AdminHome.jsx
// on isRealCreator, not just isRealAdmin) — regular admins never see
// this screen. Server-side, migration_049 enforces the same thing:
// admin_set_is_admin and admin_set_is_creator both require the caller
// already be a Creator, independent of whatever the client shows.
export default function AdminRoles({ currentUserId, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null); // null = no search yet
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(null); // { row, action: "removeAdmin" | "removeCreator" }

  async function runSearch() {
    setSearching(true);
    setError(null);
    try {
      const rows = await adminSearchUsers(query);
      setResults(rows);
    } catch (err) {
      setError(err.message);
    }
    setSearching(false);
  }

  function requestToggleAdmin(row) {
    if (row.id === currentUserId && row.is_admin && !row.is_creator) {
      setConfirm({ row, action: "removeAdmin" });
      return;
    }
    applyToggleAdmin(row);
  }

  async function applyToggleAdmin(row) {
    setBusyId(row.id);
    setError(null);
    try {
      await adminSetIsAdmin(row.id, !row.is_admin);
      setResults((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_admin: !r.is_admin } : r)));
      setConfirm(null);
    } catch (err) {
      setError(err.message);
    }
    setBusyId(null);
  }

  function requestToggleCreator(row) {
    if (row.is_creator) {
      setConfirm({ row, action: "removeCreator" });
      return;
    }
    applyToggleCreator(row);
  }

  async function applyToggleCreator(row) {
    setBusyId(row.id);
    setError(null);
    try {
      await adminSetIsCreator(row.id, !row.is_creator);
      // Granting Creator implies Admin — reflect that locally so the
      // badge is right without a re-search.
      setResults((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_creator: !r.is_creator, is_admin: !r.is_creator ? true : r.is_admin } : r)));
      setConfirm(null);
    } catch (err) {
      setError(err.message);
    }
    setBusyId(null);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 30, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 460, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}>
          <button onClick={onClose} aria-label="Close" style={smallBtn}>‹</button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: T.text, textAlign: "center" }}>ROLES</div>
          <div style={{ width: 26 }} />
        </div>

        <div style={{ padding: 16, flex: 1 }}>
          {error && <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: T.surface2, border: `1px solid ${T.accent}`, color: T.accent, fontSize: 13 }}>{error}</div>}
          <div style={{ color: T.dim, fontSize: 12.5, marginBottom: 12 }}>
            Search by email or name to grant or remove Admin and Creator access. Admin unlocks the everyday admin tools; Creator additionally can manage roles and view the user activity dashboard.
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Email or name…"
              style={{ flex: 1, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "8px 10px", outline: "none", boxSizing: "border-box" }}
            />
            <button onClick={runSearch} disabled={searching} style={{ ...smallBtn, padding: "8px 14px" }}>{searching ? "…" : "Search"}</button>
          </div>

          {results === null && <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>Search for someone to get started.</div>}
          {results && results.length === 0 && <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>No matches.</div>}

          {results?.map((r) => (
            <div key={r.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>
                    {[r.first_name, r.last_name].filter(Boolean).join(" ") || "(no name set)"}
                    {r.id === currentUserId && <span style={{ color: T.dim, fontWeight: 400 }}> (you)</span>}
                  </div>
                  <div style={{ color: T.dim, fontSize: 12 }}>{r.email}</div>
                </div>
                <span style={{
                  color: r.is_creator ? T.purple : r.is_admin ? T.green : T.dim,
                  fontSize: 11, fontWeight: 700,
                  border: `1px solid ${r.is_creator ? T.purple : r.is_admin ? T.green : T.line}`,
                  borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap",
                }}>
                  {roleLabel(r)}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => requestToggleAdmin(r)}
                  disabled={busyId === r.id || r.is_creator}
                  title={r.is_creator ? "Creators are always Admin — remove Creator first" : undefined}
                  style={r.is_admin
                    ? { ...smallBtn, flex: 1, color: T.accent, borderColor: T.accent, opacity: r.is_creator ? 0.4 : 1 }
                    : { ...smallBtn, flex: 1, color: T.green, borderColor: T.green }}
                >
                  {busyId === r.id ? "…" : r.is_admin ? "Remove admin" : "Make admin"}
                </button>
                <button
                  onClick={() => requestToggleCreator(r)}
                  disabled={busyId === r.id}
                  style={r.is_creator
                    ? { ...smallBtn, flex: 1, color: T.accent, borderColor: T.accent }
                    : { ...smallBtn, flex: 1, color: T.purple, borderColor: T.purple }}
                >
                  {busyId === r.id ? "…" : r.is_creator ? "Remove creator" : "Make creator"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {confirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.8)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 340, background: T.bg, border: `1px solid ${T.accent}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>
              {confirm.action === "removeAdmin" ? "Remove your own admin access?" : "Remove Creator access?"}
            </div>
            <div style={{ color: T.dim, fontSize: 13, marginBottom: 16 }}>
              {confirm.action === "removeAdmin"
                ? "You'll lose access to admin screens, including this one. Another Creator can restore it."
                : `${confirm.row.first_name || confirm.row.email} will lose the ability to manage roles and view user activity. They'll keep regular admin access.`}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirm(null)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 13 }}>Cancel</button>
              <button
                onClick={() => (confirm.action === "removeAdmin" ? applyToggleAdmin(confirm.row) : applyToggleCreator(confirm.row))}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: T.accent, color: "#fff", fontSize: 13, fontWeight: 700 }}
              >
                Remove it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
