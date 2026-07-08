import { useEffect, useState } from "react";
import { fetchCustomExercisesForReview, promoteExerciseToLibrary, dismissCustomExercise, updateCustomExercise, uploadExerciseMedia, fetchExercises, mergeCustomExerciseAsAlias, setExerciseArchived } from "./lib/queries";
import ExerciseThumb from "./ExerciseThumb";
import CustomExerciseModal from "./CustomExerciseModal";
import { IconX } from "./Icons";

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

function creatorName(r) {
  const full = [r.creator_first_name, r.creator_last_name].filter(Boolean).join(" ");
  return full || null;
}

export default function AdminExercises({ user, onClose }) {
  const [rows, setRows] = useState(undefined); // undefined = loading
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [reviewedIds, setReviewedIds] = useState(() => new Set()); // ids an admin has opened the review/edit panel for at least once this session
  const [editingRow, setEditingRow] = useState(null); // row currently open in the review/edit modal
  const [mergingRow, setMergingRow] = useState(null); // row currently picking a merge target
  const [mergeLibrary, setMergeLibrary] = useState(null); // null = not loaded yet
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergingTargetId, setMergingTargetId] = useState(null);

  const load = () => {
    fetchCustomExercisesForReview()
      .then(setRows)
      .catch((err) => setError(err.message));
  };

  useEffect(load, []);

  const promote = async (id) => {
    setBusyId(id);
    try {
      await promoteExerciseToLibrary(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.message);
    }
    setBusyId(null);
  };

  const dismiss = async (id) => {
    setBusyId(id);
    try {
      await dismissCustomExercise(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.message);
    }
    setBusyId(null);
  };

  const archive = async (id) => {
    setBusyId(id);
    try {
      await setExerciseArchived(id, true);
      await dismissCustomExercise(id); // also drop it out of the review queue
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.message);
    }
    setBusyId(null);
  };

  function openReview(row) {
    setReviewedIds((prev) => new Set(prev).add(row.id));
    setEditingRow(row);
  }

  async function handleSaveEdit({ name, muscle, primaryMuscles, secondaryMuscles, equipment, photoFile, existingMediaUrl }) {
    let mediaUrl = existingMediaUrl;
    if (photoFile) mediaUrl = await uploadExerciseMedia(user.id, photoFile);
    const updated = await updateCustomExercise(editingRow.id, { name, muscle, primaryMuscles, secondaryMuscles, equipment, mediaUrl });
    setRows((prev) => prev.map((r) => (r.id === editingRow.id ? { ...r, ...updated } : r)));
  }

  async function openMerge(row) {
    setMergingRow(row);
    setMergeSearch("");
    if (mergeLibrary === null) {
      try {
        const lib = await fetchExercises();
        // Only existing shared library exercises make sense as a merge
        // target — merging into another user's still-pending submission
        // would just chain one unreviewed item into another.
        setMergeLibrary(lib.filter((l) => !l.isCustom));
      } catch (err) {
        setError(err.message);
        setMergeLibrary([]);
      }
    }
  }

  async function confirmMerge(target) {
    if (!mergingRow) return;
    setMergingTargetId(target.id);
    try {
      await mergeCustomExerciseAsAlias(mergingRow.id, mergingRow.name, target.id);
      setRows((prev) => prev.filter((r) => r.id !== mergingRow.id));
      setMergingRow(null);
    } catch (err) {
      setError(err.message);
    }
    setMergingTargetId(null);
  }

  const filteredMergeLibrary = (mergeLibrary || []).filter((l) => {
    const q = mergeSearch.trim().toLowerCase();
    return !q || l.name.toLowerCase().includes(q);
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 30, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 400, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8, position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 13 }}>‹</button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: T.text, textAlign: "center" }}>CUSTOM EXERCISES</div>
          <div style={{ width: 26 }} />
        </div>

        <div style={{ padding: 16, flex: 1 }}>
          <div style={{ color: T.dim, fontSize: 11, marginBottom: 16, lineHeight: 1.5 }}>
            Exercises that 3 or more different users create independently are promoted to the library automatically — you'll only see the ones below that so far. Review a submission's details before promoting it.
          </div>
          {error && <div style={{ color: T.accent, fontSize: 13, marginBottom: 12 }}>{error}</div>}

          {rows === undefined && <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>Loading…</div>}

          {rows && rows.length === 0 && (
            <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>No custom exercises waiting for review.</div>
          )}

          {rows && rows.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rows.map((r) => {
                const reviewed = reviewedIds.has(r.id);
                const name = creatorName(r);
                return (
                  <div key={r.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <ExerciseThumb muscle={r.muscle_group} mediaUrl={r.media_url} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>{r.name}</div>
                        <div style={{ color: T.dim, fontSize: 11 }}>{r.muscle_group} · {(r.equipment || []).join(", ")}</div>
                      </div>
                    </div>
                    <div style={{ color: T.dim, fontSize: 10, marginBottom: 10 }}>
                      Added by {name || "a user"} on {new Date(r.created_at).toLocaleDateString()}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      <button
                        onClick={() => dismiss(r.id)}
                        disabled={busyId === r.id}
                        style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 13, fontWeight: 600 }}
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => openReview(r)}
                        disabled={busyId === r.id}
                        style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${T.line}`, background: reviewed ? "none" : "rgba(232,68,46,0.1)", color: reviewed ? T.dim : T.accent, fontSize: 13, fontWeight: 600 }}
                      >
                        {reviewed ? "Edit" : "Review & Edit"}
                      </button>
                      <button
                        onClick={() => promote(r.id)}
                        disabled={busyId === r.id || !reviewed}
                        title={reviewed ? undefined : "Review the submission first"}
                        style={{ flex: 2, padding: "8px 0", borderRadius: 8, border: "none", background: !reviewed ? T.surface2 : T.green, color: !reviewed ? T.dim : "#fff", fontSize: 13, fontWeight: 700 }}
                      >
                        {busyId === r.id ? "Working…" : "Promote to library"}
                      </button>
                    </div>
                    <button
                      onClick={() => openMerge(r)}
                      disabled={busyId === r.id}
                      style={{ width: "100%", background: "none", border: "none", color: T.dim, fontSize: 11.5, textDecoration: "underline", padding: "2px 0" }}
                    >
                      Same as an exercise already in the library? Merge it in →
                    </button>
                    <button
                      onClick={() => archive(r.id)}
                      disabled={busyId === r.id}
                      style={{ width: "100%", background: "none", border: "none", color: T.accent, fontSize: 11.5, textDecoration: "underline", padding: "2px 0" }}
                    >
                      Archive this submission (hides it from the creator too)
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {editingRow && (
        <CustomExerciseModal
          initialExercise={editingRow}
          onClose={() => setEditingRow(null)}
          onSave={handleSaveEdit}
          scientificMode
        />
      )}

      {mergingRow && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.85)", zIndex: 40, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 400, maxHeight: "80vh", background: T.bg, borderTop: `1px solid ${T.line}`, borderRadius: "16px 16px 0 0", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: 16, borderBottom: `1px solid ${T.line}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Merge "{mergingRow.name}" into…</div>
                <button onClick={() => setMergingRow(null)} aria-label="Close" style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 13 }}><IconX size={12} /></button>
              </div>
              <div style={{ color: T.dim, fontSize: 11.5, marginBottom: 10, lineHeight: 1.4 }}>
                "{mergingRow.name}" stays exactly as-is in that user's own list. It's recorded as a search alias of whatever you pick below, and drops out of this queue.
              </div>
              <input
                value={mergeSearch}
                onChange={(e) => setMergeSearch(e.target.value)}
                placeholder="Search the library"
                autoFocus
                style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 14, padding: "10px 12px", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ overflowY: "auto", padding: 8, flex: 1 }}>
              {mergeLibrary === null ? (
                <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: 16 }}>Loading…</div>
              ) : filteredMergeLibrary.length === 0 ? (
                <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: 16 }}>No matches.</div>
              ) : (
                filteredMergeLibrary.slice(0, 40).map((l) => (
                  <button
                    key={l.id}
                    onClick={() => confirmMerge(l)}
                    disabled={mergingTargetId === l.id}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: "10px 8px", textAlign: "left", borderBottom: `1px solid ${T.line}` }}
                  >
                    <ExerciseThumb muscle={l.muscle} mediaUrl={l.mediaUrl} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>{l.name}</div>
                      <div style={{ color: T.dim, fontSize: 11 }}>{l.muscle} · {l.equipment}{l.aliases?.length > 0 ? ` · aka ${l.aliases.join(", ")}` : ""}</div>
                    </div>
                    {mergingTargetId === l.id && <span style={{ color: T.dim, fontSize: 11 }}>Merging…</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
