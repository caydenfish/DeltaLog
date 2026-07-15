import { useEffect, useState } from "react";
import { fetchMyCustomExercises, fetchArchivedCustomExercises, fetchMyPromotedExercises, updateCustomExercise, deleteCustomExercise, setExerciseArchived, uploadExerciseMedia, normalizeExercise } from "./lib/queries";
import ExerciseThumb from "./ExerciseThumb";
import CustomExerciseModal from "./CustomExerciseModal";
import Templates from "./Templates";
import { IconCheck } from "./Icons";
import { InlineLoading } from "./LoadingSpinner";

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

export default function MyCustomExercises({ user, onClose }) {
  const [rows, setRows] = useState(undefined); // undefined = loading
  const [archivedRows, setArchivedRows] = useState(undefined);
  const [promotedRows, setPromotedRows] = useState(undefined);
  const [showArchived, setShowArchived] = useState(false);
  const [showPromoted, setShowPromoted] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // exercise row being edited
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);

  useEffect(() => {
    fetchMyCustomExercises(user.id).then(setRows).catch((err) => setError(err.message));
    fetchArchivedCustomExercises(user.id).then(setArchivedRows).catch((err) => setError(err.message));
    fetchMyPromotedExercises(user.id).then(setPromotedRows).catch((err) => setError(err.message));
  }, []);

  async function handleSaveEdit({ name, muscle, primaryMuscles, secondaryMuscles, equipment, photoFile, existingMediaUrl }) {
    let mediaUrl = existingMediaUrl;
    if (photoFile) {
      mediaUrl = await uploadExerciseMedia(user.id, photoFile);
    }
    const updated = await updateCustomExercise(editing.id, { name, muscle, primaryMuscles, secondaryMuscles, equipment, mediaUrl });
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setArchivedRows((prev) => (prev ? prev.map((r) => (r.id === updated.id ? updated : r)) : prev));
  }

  async function handleArchive(r) {
    setBusyId(r.id);
    setDeleteError(null);
    try {
      await setExerciseArchived(r.id, true);
      setRows((prev) => prev.filter((row) => row.id !== r.id));
      setArchivedRows((prev) => [...(prev || []), r]);
    } catch (err) {
      setError(err.message);
    }
    setBusyId(null);
  }

  async function handleUnarchive(r) {
    setBusyId(r.id);
    setDeleteError(null);
    try {
      await setExerciseArchived(r.id, false);
      setArchivedRows((prev) => prev.filter((row) => row.id !== r.id));
      setRows((prev) => [...(prev || []), r]);
    } catch (err) {
      setError(err.message);
    }
    setBusyId(null);
  }

  async function handleDelete(id, fromArchived) {
    setBusyId(id);
    setDeleteError(null);
    try {
      await deleteCustomExercise(id);
      if (fromArchived) setArchivedRows((prev) => prev.filter((r) => r.id !== id));
      else setRows((prev) => prev.filter((r) => r.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      if (err.code === "23503") {
        setDeleteError(fromArchived
          ? "Can't delete — this exercise is used in logged workout history, so deleting it is blocked. It'll stay archived and out of your way."
          : "Can't delete — this exercise is used in logged workout history, and deleting it would break those past sessions. Archive it instead: that hides it from the exercise picker everywhere without touching your history.");
      } else {
        setDeleteError(err.message);
      }
    }
    setBusyId(null);
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function renderRow(r, archived) {
    const selectable = selectMode && !archived;
    const selected = selectedIds.has(r.id);
    return (
      <div key={r.id} style={{ background: T.surface, border: `1px solid ${selectable && selected ? T.accent : T.line}`, borderRadius: 12, padding: 12, marginBottom: 10, opacity: archived ? 0.75 : 1 }}>
        <div
          onClick={selectable ? () => toggleSelect(r.id) : undefined}
          style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: confirmDeleteId === r.id ? 10 : 0, cursor: selectable ? "pointer" : "default" }}
        >
          {selectable && (
            <div aria-hidden="true" style={{
              width: 18, height: 18, borderRadius: 5, flexShrink: 0,
              border: `1.5px solid ${selected ? T.accent : T.line}`,
              background: selected ? T.accent : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
            }}>
              {selected ? <IconCheck size={11} /> : ""}
            </div>
          )}
          <ExerciseThumb muscle={r.muscle_group} mediaUrl={r.media_url} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>{r.name}</div>
            <div style={{ color: T.dim, fontSize: 11 }}>{r.muscle_group} · {(r.equipment || []).join(", ")}</div>
          </div>
        </div>
        {!selectMode && (
        <>
        <div style={{ display: "flex", gap: 6, marginBottom: confirmDeleteId === r.id ? 10 : 0 }}>
          <button
            onClick={() => { setEditing(r); setConfirmDeleteId(null); setDeleteError(null); }}
            style={{ flex: 1, background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "6px 0", fontSize: 12, fontWeight: 600 }}
          >
            Edit
          </button>
          {archived ? (
            <button
              onClick={() => handleUnarchive(r)}
              disabled={busyId === r.id}
              style={{ flex: 1, background: "none", border: `1px solid ${T.green}`, color: T.green, borderRadius: 8, padding: "6px 0", fontSize: 12, fontWeight: 600 }}
            >
              {busyId === r.id ? "…" : "Unarchive"}
            </button>
          ) : (
            <button
              onClick={() => handleArchive(r)}
              disabled={busyId === r.id}
              style={{ flex: 1, background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "6px 0", fontSize: 12, fontWeight: 600 }}
            >
              {busyId === r.id ? "…" : "Archive"}
            </button>
          )}
          <button
            onClick={() => { setConfirmDeleteId(confirmDeleteId === r.id ? null : r.id); setDeleteError(null); }}
            aria-label="Delete exercise"
            style={{ flex: 1, background: "none", border: `1px solid ${T.line}`, color: T.accent, borderRadius: 8, padding: "6px 0", fontSize: 12, fontWeight: 600 }}
          >
            Delete
          </button>
        </div>

        {confirmDeleteId === r.id && (
          <div style={{ background: "rgba(232,68,46,0.1)", border: `1px solid ${T.accent}`, borderRadius: 10, padding: 10 }}>
            {deleteError ? (
              <>
                <div style={{ color: T.text, fontSize: 12.5, lineHeight: 1.5, marginBottom: 10 }}>{deleteError}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setConfirmDeleteId(null); setDeleteError(null); }} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 12.5 }}>Close</button>
                  {!archived && <button onClick={() => { handleArchive(r); setConfirmDeleteId(null); setDeleteError(null); }} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: T.accent, color: "#fff", fontSize: 12.5, fontWeight: 700 }}>Archive instead</button>}
                </div>
              </>
            ) : (
              <>
                <div style={{ color: T.text, fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Delete "{r.name}"{archived ? " for good" : ""}?</div>
                <div style={{ color: T.dim, fontSize: 11.5, marginBottom: 10, lineHeight: 1.4 }}>Can't be undone. Only possible if you've never logged a set with it.</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 12.5 }}>Cancel</button>
                  <button onClick={() => handleDelete(r.id, archived)} disabled={busyId === r.id} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: T.accent, color: "#fff", fontSize: 12.5, fontWeight: 700 }}>
                    {busyId === r.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        </>
        )}
      </div>
    );
  }

  return (
    <>
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 30, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 400, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8, position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
          <button
            onClick={selectMode ? () => { setSelectMode(false); setSelectedIds(new Set()); } : onClose}
            aria-label={selectMode ? "Cancel" : "Close"}
            style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 13 }}
          >
            {selectMode ? "Cancel" : "‹"}
          </button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: T.text, textAlign: "center" }}>
            {selectMode ? `${selectedIds.size} SELECTED` : "MY CUSTOM EXERCISES"}
          </div>
          <div style={{ width: 26 }} />
        </div>

        {!selectMode && rows && rows.length > 0 && (
          <div style={{ padding: "10px 16px 0" }}>
            <button
              onClick={() => setSelectMode(true)}
              style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: `1px dashed ${T.line}`, background: "none", color: T.dim, fontSize: 13, fontWeight: 600 }}
            >
              + Create a template from these exercises
            </button>
          </div>
        )}

        <div style={{ padding: 16, flex: 1 }}>
          {error && <div style={{ color: T.accent, fontSize: 13, marginBottom: 12 }}>{error}</div>}

          {rows === undefined && <InlineLoading />}

          {rows && rows.length === 0 && (
            <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>
              You haven't created any custom exercises yet. Add one from the exercise picker during a workout.
            </div>
          )}

          {rows && rows.length > 0 && (
            <div>{rows.map((r) => renderRow(r, false))}</div>
          )}

          {!selectMode && (
          <>
          <button
            onClick={() => setShowArchived(!showArchived)}
            style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginTop: 6, marginBottom: showArchived ? 10 : 0, display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}
          >
            <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>Archived Exercises{archivedRows && archivedRows.length > 0 ? ` (${archivedRows.length})` : ""}</div>
            <div style={{ color: T.dim, fontSize: 16 }}>{showArchived ? "▲" : "▼"}</div>
          </button>
          {showArchived && (
            <div>
              {archivedRows === undefined && <InlineLoading padding="16px 0" />}
              {archivedRows && archivedRows.length === 0 && (
                <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "16px 0" }}>Nothing archived.</div>
              )}
              {archivedRows && archivedRows.length > 0 && <div>{archivedRows.map((r) => renderRow(r, true))}</div>}
            </div>
          )}
          </>
          )}

          {!selectMode && (
          <>
          <button
            onClick={() => setShowPromoted(!showPromoted)}
            style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginTop: 10, marginBottom: showPromoted ? 10 : 0, display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}
          >
            <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>Promoted Exercises{promotedRows && promotedRows.length > 0 ? ` (${promotedRows.length})` : ""}</div>
            <div style={{ color: T.dim, fontSize: 16 }}>{showPromoted ? "▲" : "▼"}</div>
          </button>
          {showPromoted && (
            <div>
              {promotedRows === undefined && <InlineLoading padding="16px 0" />}
              {promotedRows && promotedRows.length === 0 && (
                <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "16px 0" }}>Nothing here yet — exercises you submit that get added to the shared library will show up here.</div>
              )}
              {promotedRows && promotedRows.length > 0 && (
                <div>
                  {promotedRows.map((p) => (
                    <div key={p.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
                      <ExerciseThumb muscle={p.exercise.muscle_group} mediaUrl={p.exercise.media_url} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>
                          {p.submitted_name !== p.exercise.name ? `${p.submitted_name} → ${p.exercise.name}` : p.exercise.name}
                        </div>
                        <div style={{ color: T.dim, fontSize: 11 }}>
                          Now in the shared library{p.resolved_at ? ` · ${new Date(p.resolved_at).toLocaleDateString()}` : ""}
                        </div>
                      </div>
                      <div style={{ color: T.green, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, flexShrink: 0 }}>Shared</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          </>
          )}
        </div>

        {selectMode && (
          <div style={{ position: "sticky", bottom: 0, padding: 16, background: T.bg, borderTop: `1px solid ${T.line}` }}>
            <button
              onClick={() => setShowTemplateBuilder(true)}
              disabled={selectedIds.size === 0}
              style={{
                width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
                background: selectedIds.size === 0 ? T.surface2 : T.accent,
                color: selectedIds.size === 0 ? T.dim : "#fff",
                fontSize: 15, fontWeight: 700,
              }}
            >
              Create Template{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </button>
          </div>
        )}
      </div>
    </div>

      {editing && (
        <CustomExerciseModal
          initialExercise={editing}
          onSave={handleSaveEdit}
          onClose={() => setEditing(null)}
        />
      )}

      {showTemplateBuilder && (
        <Templates
          user={user}
          onClose={() => { setShowTemplateBuilder(false); setSelectMode(false); setSelectedIds(new Set()); }}
          initialPicks={rows.filter((r) => selectedIds.has(r.id)).map((r) => normalizeExercise(r))}
        />
      )}
    </>
  );
}
