import { useEffect, useState } from "react";
import { fetchFeedbackForAdmin, setFeedbackFlagged, setFeedbackStatus, setFeedbackNote, deleteFeedback } from "./lib/queries";
import { IconStar, IconCheck } from "./Icons";

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

const smallBtn = { background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 13 };

const TYPE_COLOR = { bug: T.accent, privacy: "#8B9EFF", feature: T.green };
const TYPE_LABEL = { bug: "Bug", feature: "Feature", privacy: "Privacy" };

function TypeBadge({ type }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: TYPE_COLOR[type] || T.dim, border: `1px solid ${TYPE_COLOR[type] || T.line}`, borderRadius: 999, padding: "2px 8px" }}>
      {TYPE_LABEL[type] || type}
    </span>
  );
}

function StatusBadge({ status }) {
  if (status === "open") return null; // default state, no need to call it out in the list
  const color = status === "archived" ? T.dim : T.green;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color, border: `1px solid ${color}`, borderRadius: 999, padding: "2px 8px" }}>
      {status === "closed" ? "Closed" : "Archived"}
    </span>
  );
}

// Full detail view for one submission — flag, note, status, delete.
function DetailView({ row, onBack, onChanged }) {
  const [note, setNote] = useState(row.admin_note || "");
  const [savingNote, setSavingNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState(null);

  async function toggleFlag() {
    setBusy(true);
    try {
      await setFeedbackFlagged(row.id, !row.flagged);
      onChanged({ ...row, flagged: !row.flagged });
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function changeStatus(status) {
    setBusy(true);
    try {
      await setFeedbackStatus(row.id, status);
      onChanged({ ...row, status });
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function saveNote() {
    setSavingNote(true);
    try {
      await setFeedbackNote(row.id, note.trim() || null);
      onChanged({ ...row, admin_note: note.trim() || null });
    } catch (err) {
      setError(err.message);
    }
    setSavingNote(false);
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteFeedback(row.id);
      onBack(true); // true = was deleted, so the list can drop it
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16, flex: 1, overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <TypeBadge type={row.type} />
        <span style={{ fontSize: 11, color: T.dim }}>{new Date(row.created_at).toLocaleString()}</span>
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <div style={{ color: T.text, fontSize: 14, lineHeight: 1.6, marginBottom: row.context ? 8 : 0 }}>{row.message}</div>
        {row.context && <div style={{ color: T.dim, fontSize: 11, fontStyle: "italic" }}>Context: {row.context}</div>}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button onClick={toggleFlag} disabled={busy} style={{ ...smallBtn, flex: 1, color: row.flagged ? "#F2C94C" : T.dim, borderColor: row.flagged ? "#F2C94C" : T.line, fontWeight: 600 }}>
          {row.flagged ? <><IconStar size={12} filled /> Flagged</> : <><IconStar size={12} /> Flag</>}
        </button>
        <button onClick={() => changeStatus(row.status === "closed" ? "open" : "closed")} disabled={busy} style={{ ...smallBtn, flex: 1, color: row.status === "closed" ? T.green : T.dim, borderColor: row.status === "closed" ? T.green : T.line, fontWeight: 600 }}>
          {row.status === "closed" ? <><IconCheck size={12} /> Closed</> : "Mark closed"}
        </button>
        <button onClick={() => changeStatus(row.status === "archived" ? "open" : "archived")} disabled={busy} style={{ ...smallBtn, flex: 1, fontWeight: 600 }}>
          {row.status === "archived" ? "Unarchive" : "Archive"}
        </button>
      </div>

      <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Private note</div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Notes for yourself — not visible to the person who submitted this."
        rows={4}
        style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, color: T.text, fontSize: 13, padding: 10, outline: "none", boxSizing: "border-box", resize: "none", marginBottom: 8, fontFamily: "inherit" }}
      />
      <button onClick={saveNote} disabled={savingNote || note === (row.admin_note || "")} style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface, color: T.text, fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
        {savingNote ? "Saving…" : "Save note"}
      </button>

      {error && <div style={{ color: T.accent, fontSize: 12.5, marginBottom: 12 }}>{error}</div>}

      {!confirmDelete ? (
        <button onClick={() => setConfirmDelete(true)} style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: `1px solid ${T.accent}`, background: "none", color: T.accent, fontSize: 14, fontWeight: 700 }}>
          Delete submission
        </button>
      ) : (
        <div style={{ background: "rgba(232,68,46,0.1)", border: `1px solid ${T.accent}`, borderRadius: 10, padding: 12 }}>
          <div style={{ color: T.text, fontSize: 13, marginBottom: 10 }}>Delete this for good? Can't be undone.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 13 }}>Cancel</button>
            <button onClick={handleDelete} disabled={busy} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: T.accent, color: "#fff", fontSize: 13, fontWeight: 700 }}>
              {busy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminFeedback({ onClose }) {
  const [rows, setRows] = useState(undefined);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all"); // all | bug | feature | privacy
  const [statusFilter, setStatusFilter] = useState("open"); // open | all | closed | archived
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    fetchFeedbackForAdmin().then(setRows).catch((err) => setError(err.message));
  }, []);

  function handleChanged(updated) {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  function handleBack(wasDeleted) {
    if (wasDeleted) setRows((prev) => prev.filter((r) => r.id !== selectedId));
    setSelectedId(null);
  }

  const selected = selectedId ? rows?.find((r) => r.id === selectedId) : null;

  const filtered = rows
    ? rows.filter((r) => {
        if (typeFilter !== "all" && r.type !== typeFilter) return false;
        if (statusFilter !== "all" && (r.status || "open") !== statusFilter) return false;
        return true;
      })
    : [];
  // Flagged items float to the top within whatever filter's active.
  const sorted = [...filtered].sort((a, b) => (b.flagged ? 1 : 0) - (a.flagged ? 1 : 0));

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 30, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 400, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8, position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
          <button onClick={() => (selected ? setSelectedId(null) : onClose())} aria-label="Back" style={smallBtn}>‹</button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: T.text, textAlign: "center" }}>
            {selected ? "SUBMISSION" : "FEEDBACK & BUGS"}
          </div>
          <div style={{ width: 26 }} />
        </div>

        {selected ? (
          <DetailView row={selected} onBack={handleBack} onChanged={handleChanged} />
        ) : (
          <div style={{ padding: 16, flex: 1 }}>
            {error && <div style={{ color: T.accent, fontSize: 13, marginBottom: 12 }}>{error}</div>}

            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {[["all", "All"], ["bug", "Bugs"], ["feature", "Features"], ["privacy", "Privacy"]].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTypeFilter(k)}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 11.5, fontWeight: 600, border: `1px solid ${typeFilter === k ? T.accent : T.line}`, background: typeFilter === k ? "rgba(232,68,46,0.12)" : T.surface, color: typeFilter === k ? T.text : T.dim }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              {[["open", "Open"], ["all", "All"], ["closed", "Closed"], ["archived", "Archived"]].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setStatusFilter(k)}
                  style={{ flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 11, fontWeight: 600, border: `1px solid ${statusFilter === k ? T.text : T.line}`, background: statusFilter === k ? T.surface2 : "none", color: statusFilter === k ? T.text : T.dim }}
                >
                  {label}
                </button>
              ))}
            </div>

            {rows === undefined && <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>Loading…</div>}

            {rows && sorted.length === 0 && (
              <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>Nothing here.</div>
            )}

            {rows && sorted.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sorted.map((r) => (
                  <button key={r.id} onClick={() => setSelectedId(r.id)} style={{ display: "block", width: "100%", textAlign: "left", background: T.surface, border: `1px solid ${r.flagged ? "#F2C94C" : T.line}`, borderRadius: 12, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 6 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <TypeBadge type={r.type} />
                        <StatusBadge status={r.status || "open"} />
                        {r.flagged && <span style={{ color: "#F2C94C" }}><IconStar size={13} filled /></span>}
                      </div>
                      <span style={{ fontSize: 10, color: T.dim, flexShrink: 0 }}>{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <div style={{ color: T.text, fontSize: 13, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.message}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
