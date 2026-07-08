import { useState } from "react";
import { adminSearchUsers, adminSetIsAdmin } from "./lib/queries";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
  green: "#3BA55D",
};

const smallBtn = { background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 11 };

// Admin-only: search for a user by email or name and grant/revoke admin
// access. Backed by two security-definer functions (migration_030)
// since profiles' RLS otherwise restricts everyone — admins included —
// to their own row.
export default function AdminPermissions({ currentUserId, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null); // null = no search yet
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [confirmRemoveSelf, setConfirmRemoveSelf] = useState(null); // user row pending self-removal confirmation

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

  async function toggleAdmin(row) {
    if (row.id === currentUserId && row.is_admin) {
      setConfirmRemoveSelf(row);
      return;
    }
    await applyToggle(row);
  }

  async function applyToggle(row) {
    setBusyId(row.id);
    setError(null);
    try {
      await adminSetIsAdmin(row.id, !row.is_admin);
      setResults((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_admin: !r.is_admin } : r)));
      setConfirmRemoveSelf(null);
    } catch (err) {
      setError(err.message);
    }
    setBusyId(null);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 30, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 420, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}>
          <button onClick={onClose} aria-label="Close" style={smallBtn}>‹</button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: T.text, textAlign: "center" }}>PERMISSIONS</div>
          <div style={{ width: 26 }} />
        </div>

        <div style={{ padding: 16, flex: 1 }}>
          {error && <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: T.surface2, border: `1px solid ${T.accent}`, color: T.accent, fontSize: 13 }}>{error}</div>}
          <div style={{ color: T.dim, fontSize: 12.5, marginBottom: 12 }}>Search by email or name to grant or remove admin access.</div>
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
            <div key={r.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>
                  {[r.first_name, r.last_name].filter(Boolean).join(" ") || "(no name set)"}
                  {r.id === currentUserId && <span style={{ color: T.dim, fontWeight: 400 }}> (you)</span>}
                </div>
                <div style={{ color: T.dim, fontSize: 12 }}>{r.email}</div>
              </div>
              <button
                onClick={() => toggleAdmin(r)}
                disabled={busyId === r.id}
                style={r.is_admin
                  ? { ...smallBtn, color: T.accent, borderColor: T.accent }
                  : { ...smallBtn, color: T.green, borderColor: T.green }}
              >
                {busyId === r.id ? "…" : r.is_admin ? "Remove admin" : "Make admin"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {confirmRemoveSelf && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.8)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 340, background: T.bg, border: `1px solid ${T.accent}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>Remove your own admin access?</div>
            <div style={{ color: T.dim, fontSize: 13, marginBottom: 16 }}>You'll lose access to admin screens, including this one. Someone else with admin access can restore it.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmRemoveSelf(null)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 13 }}>Cancel</button>
              <button onClick={() => applyToggle(confirmRemoveSelf)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: T.accent, color: "#fff", fontSize: 13, fontWeight: 700 }}>Remove it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
