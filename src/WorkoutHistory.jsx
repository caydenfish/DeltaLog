import { useState, useEffect } from "react";
import ExerciseThumb from "./ExerciseThumb";
import ExportWorkoutModal from "./ExportWorkoutModal";
import { IconX, IconCamera, IconImage, IconTrash, IconCheck } from "./Icons";
import { formatWeight, toDisplay, toCanonical } from "./lib/weight";
import { formatClockTime, toLocalDateStr } from "./lib/time";
import {
  deleteWorkout, updateSet, deleteSet, logSet, addWorkoutExercise, removeWorkoutExercise,
  fetchExercises, uploadProgressPhoto, fetchProgressPhoto, deleteProgressPhoto, setSetWarmup, shareWorkout,
} from "./lib/queries";

// Labels a sorted sets array for display: warmup sets count independently
// as W1, W2… and the first working set restarts the count at 1, mirroring
// the same convention used in the live workout view.
function setLabels(sets) {
  let working = 0;
  let warmup = 0;
  return (sets || []).map((s) => (s.is_warmup ? `W${++warmup}` : `${++working}`));
}

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

const smallBtn = { background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 13, whiteSpace: "nowrap" };

function workoutVolume(w) {
  return Math.round((w.workout_exercises || []).reduce(
    (sum, we) => sum + (we.sets || []).filter((set) => !set.is_warmup).reduce((s, set) => s + (set.weight || 0) * (set.reps || 0), 0),
    0
  ));
}
function workoutSetCount(w) {
  return (w.workout_exercises || []).reduce((sum, we) => sum + (we.sets || []).length, 0);
}
function workoutDurationMin(w) {
  if (!w.started_at || !w.completed_at) return null;
  return Math.max(1, Math.round((new Date(w.completed_at) - new Date(w.started_at)) / 60000));
}

// Optional per-date progress photo — same feature as the post-workout
// summary page, but reachable from a workout's detail view (i.e. from
// tapping that date on the home screen calendar). Uploads immediately
// on selection since there's no separate "save" step here.
function ProgressPhotoBlock({ userId, dateStr, onPhotoChange }) {
  const [photo, setPhotoState] = useState(undefined); // undefined = loading, null = none, { path, url }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function setPhoto(p) {
    setPhotoState(p);
    onPhotoChange && onPhotoChange(p);
  }

  useEffect(() => {
    let cancelled = false;
    fetchProgressPhoto(userId, dateStr).then((p) => { if (!cancelled) setPhoto(p); }).catch(() => { if (!cancelled) setPhoto(null); });
    return () => { cancelled = true; };
  }, [userId, dateStr]);

  async function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      await uploadProgressPhoto(userId, dateStr, f);
      const refreshed = await fetchProgressPhoto(userId, dateStr);
      setPhoto(refreshed);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function handleRemove() {
    if (!photo) return;
    setBusy(true);
    try {
      await deleteProgressPhoto(userId, dateStr, photo.path);
      setPhoto(null);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Progress photo — private to you</div>
      {photo === undefined ? (
        <div style={{ color: T.dim, fontSize: 12 }}>Loading…</div>
      ) : photo ? (
        <div style={{ position: "relative" }}>
          <img src={photo.url} alt="Progress" style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 12, border: `1px solid ${T.line}` }} />
          <button onClick={handleRemove} disabled={busy} aria-label="Remove photo" style={{ position: "absolute", top: 8, right: 8, background: "rgba(16,18,22,0.8)", border: `1px solid ${T.line}`, color: T.text, borderRadius: 999, width: 28, height: 28, fontSize: 14 }}><IconX size={12} /></button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ flex: 1, display: "block", padding: "14px 0", borderRadius: 12, border: `1px dashed ${T.line}`, textAlign: "center", color: T.dim, fontSize: 13, cursor: "pointer" }}>
            {busy ? "Uploading…" : <><IconCamera size={14} /> Take Photo</>}
            <input type="file" accept="image/*" capture="environment" onChange={handleFile} disabled={busy} style={{ display: "none" }} />
          </label>
          <label style={{ flex: 1, display: "block", padding: "14px 0", borderRadius: 12, border: `1px dashed ${T.line}`, textAlign: "center", color: T.dim, fontSize: 13, cursor: "pointer" }}>
            {busy ? "Uploading…" : <><IconImage size={14} /> Choose from Library</>}
            <input type="file" accept="image/*" onChange={handleFile} disabled={busy} style={{ display: "none" }} />
          </label>
        </div>
      )}
      {error && <div style={{ color: T.accent, fontSize: 12, marginTop: 6 }}>{error}</div>}
    </div>
  );
}

function DetailView({ workout, units, timeFormat, userId, editMode, onRequestDelete, onSetUpdated, onSetAdded, onSetRemoved, onExerciseAdded, onExerciseRemoved }) {
  const dateStr = new Date(workout.completed_at).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const startTimeStr = workout.started_at ? formatClockTime(workout.started_at, timeFormat) : null;
  const isoDate = toLocalDateStr(workout.completed_at);
  const duration = workoutDurationMin(workout);
  const volume = Math.round(toDisplay(workoutVolume(workout), units));
  const totalSets = workoutSetCount(workout);
  const exercises = [...(workout.workout_exercises || [])].sort((a, b) => (a.position || 0) - (b.position || 0));
  const [editing, setEditing] = useState(null); // { weId, setNumber } | null
  const [editWeight, setEditWeight] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editRir, setEditRir] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [addingSetFor, setAddingSetFor] = useState(null); // weId | null
  const [removingSet, setRemovingSet] = useState(null); // { weId, setNumber } | null — awaiting delete confirmation
  const [removingWeId, setRemovingWeId] = useState(null); // weId awaiting remove-exercise confirmation
  const [removingBusy, setRemovingBusy] = useState(false);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [exerciseLibrary, setExerciseLibrary] = useState(null); // null = not loaded yet
  const [addExerciseSearch, setAddExerciseSearch] = useState("");
  const [addingExerciseId, setAddingExerciseId] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [progressPhoto, setProgressPhoto] = useState(undefined); // mirrors ProgressPhotoBlock's photo, lifted so "Save as image" can use it as a Story background

  function startEdit(we, s) {
    setEditing({ weId: we.id, setNumber: s.set_number });
    setEditWeight(String(formatWeight(s.weight, units)));
    setEditReps(String(s.reps ?? ""));
    setEditRir(s.rir != null ? String(s.rir) : "");
    setSaveError(null);
  }

  // Assigns/unassigns a set's warmup flag from the history edit menu.
  // Reuses onSetUpdated's generic patch-merge instead of a new callback —
  // is_warmup is just another field on the set row.
  async function toggleWarmup(we, s) {
    const next = !s.is_warmup;
    try {
      await setSetWarmup(we.id, s.set_number, next);
      onSetUpdated && onSetUpdated(workout.id, we.id, s.set_number, { is_warmup: next });
    } catch (err) {
      window.alert(`Couldn't save: ${err.message}`);
    }
  }

  // Builds the same denormalized shape for both "Share link" and "Save as
  // image" — set-by-set detail with warmup-aware labels, plus totals.
  function buildSnapshot() {
    const snapshotExercises = exercises.map((we) => {
      const exSets = [...(we.sets || [])].sort((a, b) => (a.set_number || 0) - (b.set_number || 0));
      const exLabels = setLabels(exSets);
      return {
        name: (we.exercises && (we.exercises.name || we.exercises.short)) || "Exercise",
        sets: exSets.map((s, j) => ({ label: exLabels[j], weight: formatWeight(s.weight, units), reps: s.reps, rir: s.rir, isWarmup: !!s.is_warmup })),
      };
    });
    return {
      dateLabel: dateStr,
      unit: units,
      totalSets,
      totalVolume: volume,
      durationMin: duration,
      bodyWeight: workout.body_weight != null ? formatWeight(workout.body_weight, units) : null,
      exercises: snapshotExercises,
      photoUrl: progressPhoto?.url || null,
    };
  }

  // Posts a denormalized snapshot of this workout under a short code,
  // then shows the resulting link. Nothing here touches the live
  // workout again — a share is a point-in-time copy.
  async function handleShare() {
    setSharing(true);
    try {
      const code = await shareWorkout(userId, buildSnapshot());
      setShareUrl(`${window.location.origin}${window.location.pathname}?shared=${code}`);
    } catch (err) {
      window.alert(`Couldn't create share link: ${err.message}`);
    }
    setSharing(false);
  }

  async function saveEdit() {
    if (!editing) return;
    const w = parseFloat(editWeight);
    const r = parseInt(editReps, 10);
    if (!w || !r) { setSaveError("Weight and reps are required."); return; }
    const rir = editRir === "" ? null : parseInt(editRir, 10);
    setSaving(true);
    setSaveError(null);
    try {
      await updateSet(editing.weId, editing.setNumber, toCanonical(w, units), r, rir);
      onSetUpdated && onSetUpdated(workout.id, editing.weId, editing.setNumber, { weight: toCanonical(w, units), reps: r, rir });
      setEditing(null);
    } catch (err) {
      setSaveError(err.message);
    }
    setSaving(false);
  }

  function startAddSet(we) {
    setAddingSetFor(we.id);
    setEditWeight("");
    setEditReps("");
    setEditRir("");
    setSaveError(null);
  }

  async function saveNewSet(we) {
    const w = parseFloat(editWeight);
    const r = parseInt(editReps, 10);
    if (!w || !r) { setSaveError("Weight and reps are required."); return; }
    const rir = editRir === "" ? null : parseInt(editRir, 10);
    const nextSetNumber = (we.sets || []).reduce((max, s) => Math.max(max, s.set_number || 0), 0) + 1;
    setSaving(true);
    setSaveError(null);
    try {
      const canonicalWeight = toCanonical(w, units);
      await logSet(we.id, nextSetNumber, canonicalWeight, r, rir);
      onSetAdded && onSetAdded(workout.id, we.id, { set_number: nextSetNumber, weight: canonicalWeight, reps: r, rir });
      setAddingSetFor(null);
    } catch (err) {
      setSaveError(err.message);
    }
    setSaving(false);
  }

  async function confirmRemoveSet() {
    if (!removingSet) return;
    setRemovingBusy(true);
    try {
      await deleteSet(removingSet.weId, removingSet.setNumber);
      onSetRemoved && onSetRemoved(workout.id, removingSet.weId, removingSet.setNumber);
      setRemovingSet(null);
    } catch (err) {
      window.alert(`Couldn't remove set: ${err.message}`);
    }
    setRemovingBusy(false);
  }

  async function confirmRemoveExercise() {
    if (!removingWeId) return;
    setRemovingBusy(true);
    try {
      await removeWorkoutExercise(removingWeId);
      onExerciseRemoved && onExerciseRemoved(workout.id, removingWeId);
      setRemovingWeId(null);
    } catch (err) {
      window.alert(`Couldn't remove exercise: ${err.message}`);
    }
    setRemovingBusy(false);
  }

  async function openAddExercise() {
    setShowAddExercise(true);
    if (exerciseLibrary === null) {
      try {
        const lib = await fetchExercises();
        setExerciseLibrary(lib);
      } catch {
        setExerciseLibrary([]);
      }
    }
  }

  async function addExercise(libItem) {
    setAddingExerciseId(libItem.id);
    try {
      const position = exercises.length;
      const weId = await addWorkoutExercise(workout.id, libItem.id, position, 3);
      onExerciseAdded && onExerciseAdded(workout.id, {
        id: weId,
        exercise_id: libItem.id,
        position,
        exercises: { name: libItem.name, short: libItem.short, muscle_group: libItem.muscle, secondary_muscles: libItem.secondaryMuscles, media_url: libItem.mediaUrl },
        sets: [],
      });
      setShowAddExercise(false);
      setAddExerciseSearch("");
    } catch (err) {
      window.alert(`Couldn't add exercise: ${err.message}`);
    }
    setAddingExerciseId(null);
  }

  const filteredLibrary = (exerciseLibrary || []).filter((l) => {
    const q = addExerciseSearch.trim().toLowerCase();
    return !q || l.name.toLowerCase().includes(q) || (l.aliases || []).some((a) => a.toLowerCase().includes(q));
  });

  return (
    <div style={{ padding: 16, flex: 1, overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.text }}>{dateStr}</div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={() => setShowExport(true)} style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 12 }}>
            Save image
          </button>
          <button onClick={handleShare} disabled={sharing} style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 12 }}>
            {sharing ? "…" : "Share ↗"}
          </button>
        </div>
      </div>
      {startTimeStr && <div style={{ color: T.dim, fontSize: 12, marginTop: 2 }}>Started {startTimeStr}</div>}
      <div style={{ color: T.dim, fontSize: 11.5, marginTop: 2, marginBottom: 8 }}>
        {editMode ? "Tap any set below to correct it — useful if a set got logged wrong or wasn't logged in the moment." : "Viewing only. Tap Edit above to correct a set, or add/remove sets and exercises."}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 8, marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.text }}>{volume.toLocaleString()}</div>
          <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>Volume ({units})</div>
        </div>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.text }}>{totalSets}</div>
          <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>Sets</div>
        </div>
        {duration != null && (
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.text }}>{duration}</div>
            <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>Minutes</div>
          </div>
        )}
        {workout.body_weight != null && (
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.text }}>{workout.body_weight}</div>
            <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>Bodyweight</div>
          </div>
        )}
      </div>

      {workout.session_notes && (
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, marginBottom: 16, fontSize: 13, color: T.text, fontStyle: "italic" }}>
          "{workout.session_notes}"
        </div>
      )}

      <ProgressPhotoBlock userId={userId} dateStr={isoDate} onPhotoChange={setProgressPhoto} />

      {exercises.map((we, i) => {
        const ex = we.exercises || {};
        const sets = [...(we.sets || [])].sort((a, b) => (a.set_number || 0) - (b.set_number || 0));
        const labels = setLabels(sets);
        return (
          <div key={i} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <ExerciseThumb muscle={ex.muscle_group} mediaUrl={ex.media_url} size={20} />
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, color: T.text, flex: 1 }}>{ex.name || ex.short || "Exercise"}</div>
              {editMode && (
                <button onClick={() => setRemovingWeId(we.id)} aria-label="Remove exercise" title="Remove exercise" style={{ background: "none", border: "none", color: T.dim, fontSize: 13, padding: "2px 4px" }}><IconTrash size={13} /></button>
              )}
            </div>

            {removingWeId === we.id && (
              <div style={{ background: "rgba(232,68,46,0.1)", border: `1px solid ${T.accent}`, borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <div style={{ color: T.text, fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Remove {ex.name || ex.short} and all its logged sets from this workout?</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setRemovingWeId(null)} disabled={removingBusy} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 12 }}>Cancel</button>
                  <button onClick={confirmRemoveExercise} disabled={removingBusy} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "none", background: T.accent, color: "#fff", fontSize: 12, fontWeight: 700 }}>{removingBusy ? "…" : "Remove"}</button>
                </div>
              </div>
            )}

            {sets.length === 0 ? (
              <div style={{ fontSize: 12, color: T.dim, marginBottom: 8 }}>No sets logged.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                {sets.map((s, j) => {
                  const isEditing = editMode && editing && editing.weId === we.id && editing.setNumber === s.set_number;
                  const isRemoving = editMode && removingSet && removingSet.weId === we.id && removingSet.setNumber === s.set_number;
                  if (isEditing) {
                    return (
                      <div key={j} style={{ background: T.surface2, border: `1px solid ${T.accent}`, borderRadius: 10, padding: 8, marginTop: j === 0 ? 0 : 2, marginBottom: 2 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: saveError ? 6 : 0 }}>
                          <span style={{ width: 22, color: T.dim, fontSize: 13 }}>{labels[j]}</span>
                          <input inputMode="decimal" value={editWeight} onChange={(e) => setEditWeight(e.target.value.replace(/[^0-9.]/g, ""))} placeholder={units} style={{ width: 56, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 6, color: T.text, fontSize: 13, padding: "4px 6px", outline: "none", textAlign: "center" }} />
                          <span style={{ color: T.dim, fontSize: 12 }}>×</span>
                          <input inputMode="numeric" value={editReps} onChange={(e) => setEditReps(e.target.value.replace(/[^0-9]/g, ""))} placeholder="reps" style={{ width: 44, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 6, color: T.text, fontSize: 13, padding: "4px 6px", outline: "none", textAlign: "center" }} />
                          <input inputMode="numeric" value={editRir} onChange={(e) => setEditRir(e.target.value.replace(/[^0-9]/g, ""))} placeholder="RIR" style={{ width: 40, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 6, color: T.text, fontSize: 13, padding: "4px 6px", outline: "none", textAlign: "center" }} />
                          <div style={{ flex: 1 }} />
                          <button onClick={() => setEditing(null)} disabled={saving} style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 6, padding: "4px 8px", fontSize: 12 }}>Cancel</button>
                          <button onClick={saveEdit} disabled={saving} style={{ background: T.accent, border: "none", color: "#fff", borderRadius: 6, padding: "4px 8px", fontSize: 12, fontWeight: 700 }}>{saving ? "…" : "Save"}</button>
                        </div>
                        {saveError && <div style={{ color: T.accent, fontSize: 11 }}>{saveError}</div>}
                      </div>
                    );
                  }
                  if (isRemoving) {
                    return (
                      <div key={j} style={{ background: "rgba(232,68,46,0.1)", border: `1px solid ${T.accent}`, borderRadius: 8, padding: 8, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: T.text, fontSize: 12.5, flex: 1 }}>Remove set {labels[j]}?</span>
                        <button onClick={() => setRemovingSet(null)} disabled={removingBusy} style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 6, padding: "4px 8px", fontSize: 12 }}>Cancel</button>
                        <button onClick={confirmRemoveSet} disabled={removingBusy} style={{ background: T.accent, border: "none", color: "#fff", borderRadius: 6, padding: "4px 8px", fontSize: 12, fontWeight: 700 }}>{removingBusy ? "…" : "Remove"}</button>
                      </div>
                    );
                  }
                  if (!editMode) {
                    return (
                      <div key={j} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
                        <span style={{ width: 26, textAlign: "center", fontSize: 12, fontWeight: s.is_warmup ? 700 : 400, color: s.is_warmup ? "#E8A82E" : T.dim, flexShrink: 0 }}>{labels[j]}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: T.dim, flex: 1, minWidth: 0 }}>
                          <span style={{ color: T.text, fontWeight: 600 }}>{formatWeight(s.weight, units)} {units} × {s.reps}</span>
                          {s.rir != null && <span>RIR {s.rir}</span>}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={j} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        onClick={() => toggleWarmup(we, s)}
                        aria-label={s.is_warmup ? "Unmark as warmup" : "Mark as warmup"}
                        title={s.is_warmup ? "Unmark as warmup" : "Mark as warmup"}
                        style={{ width: 26, textAlign: "center", fontSize: 12, fontWeight: s.is_warmup ? 700 : 400, color: s.is_warmup ? "#E8A82E" : T.dim, background: s.is_warmup ? "rgba(232,168,46,0.14)" : "none", border: "none", borderRadius: 6, padding: "3px 0", flexShrink: 0 }}
                      >
                        {labels[j]}
                      </button>
                      <button onClick={() => startEdit(we, s)} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: T.dim, background: "none", border: "none", padding: "2px 0", textAlign: "left", flex: 1, minWidth: 0 }}>
                        <span style={{ color: T.text, fontWeight: 600 }}>{formatWeight(s.weight, units)} {units} × {s.reps}</span>
                        {s.rir != null && <span>RIR {s.rir}</span>}
                        <span style={{ marginLeft: "auto", color: T.dim, fontSize: 11 }}>edit</span>
                      </button>
                      <button onClick={() => setRemovingSet({ weId: we.id, setNumber: s.set_number })} aria-label="Remove set" style={{ background: "none", border: "none", color: T.dim, fontSize: 12, padding: "2px 4px", flexShrink: 0 }}><IconX size={12} /></button>
                    </div>
                  );
                })}
              </div>
            )}

            {editMode && (addingSetFor === we.id ? (
              <div style={{ background: T.surface2, border: `1px solid ${T.accent}`, borderRadius: 10, padding: 8 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: saveError ? 6 : 0 }}>
                  <input inputMode="decimal" value={editWeight} onChange={(e) => setEditWeight(e.target.value.replace(/[^0-9.]/g, ""))} placeholder={units} style={{ width: 56, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 6, color: T.text, fontSize: 13, padding: "4px 6px", outline: "none", textAlign: "center" }} />
                  <span style={{ color: T.dim, fontSize: 12 }}>×</span>
                  <input inputMode="numeric" value={editReps} onChange={(e) => setEditReps(e.target.value.replace(/[^0-9]/g, ""))} placeholder="reps" style={{ width: 44, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 6, color: T.text, fontSize: 13, padding: "4px 6px", outline: "none", textAlign: "center" }} />
                  <input inputMode="numeric" value={editRir} onChange={(e) => setEditRir(e.target.value.replace(/[^0-9]/g, ""))} placeholder="RIR" style={{ width: 40, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 6, color: T.text, fontSize: 13, padding: "4px 6px", outline: "none", textAlign: "center" }} />
                  <div style={{ flex: 1 }} />
                  <button onClick={() => setAddingSetFor(null)} disabled={saving} style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 6, padding: "4px 8px", fontSize: 12 }}>Cancel</button>
                  <button onClick={() => saveNewSet(we)} disabled={saving} style={{ background: T.accent, border: "none", color: "#fff", borderRadius: 6, padding: "4px 8px", fontSize: 12, fontWeight: 700 }}>{saving ? "…" : "Add"}</button>
                </div>
                {saveError && <div style={{ color: T.accent, fontSize: 11 }}>{saveError}</div>}
              </div>
            ) : (
              <button onClick={() => startAddSet(we)} style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: `1px dashed ${T.line}`, background: "none", color: T.dim, fontSize: 12.5 }}>+ Add set</button>
            ))}
          </div>
        );
      })}
      {exercises.length === 0 && (
        <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>No exercises logged for this workout.</div>
      )}

      {editMode && (showAddExercise ? (
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Add exercise</div>
            <button onClick={() => { setShowAddExercise(false); setAddExerciseSearch(""); }} aria-label="Close" style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 6, padding: "2px 8px", fontSize: 12 }}><IconX size={12} /></button>
          </div>
          <input
            value={addExerciseSearch}
            onChange={(e) => setAddExerciseSearch(e.target.value)}
            placeholder="Search exercises"
            style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "8px 10px", outline: "none", boxSizing: "border-box", marginBottom: 8 }}
          />
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {exerciseLibrary === null ? (
              <div style={{ color: T.dim, fontSize: 12.5, padding: "8px 0" }}>Loading…</div>
            ) : filteredLibrary.length === 0 ? (
              <div style={{ color: T.dim, fontSize: 12.5, padding: "8px 0" }}>No matches.</div>
            ) : (
              filteredLibrary.slice(0, 40).map((l) => (
                <button
                  key={l.id}
                  onClick={() => addExercise(l)}
                  disabled={addingExerciseId === l.id}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: "8px 4px", textAlign: "left", borderBottom: `1px solid ${T.line}` }}
                >
                  <ExerciseThumb muscle={l.muscle} mediaUrl={l.mediaUrl} size={18} />
                  <span style={{ color: T.text, fontSize: 13, flex: 1 }}>{l.name}</span>
                  {addingExerciseId === l.id && <span style={{ color: T.dim, fontSize: 11 }}>Adding…</span>}
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <button onClick={openAddExercise} style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: `1px dashed ${T.line}`, background: "none", color: T.dim, fontSize: 13, fontWeight: 600 }}>+ Add exercise</button>
      ))}

      {editMode && (
        <button onClick={onRequestDelete} style={{ width: "100%", marginTop: 10, padding: "12px 0", borderRadius: 10, border: `1px solid ${T.accent}`, background: "none", color: T.accent, fontSize: 13, fontWeight: 600 }}>Delete entire workout</button>
      )}

      {shareUrl && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.75)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 360, background: T.bg, border: `1px solid ${T.line}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8 }}>Share link</div>
            <div style={{ color: T.dim, fontSize: 13, marginBottom: 12 }}>Anyone with this link can view this workout — no account needed.</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", marginBottom: 16, wordBreak: "break-all" }}>
              <div style={{ fontSize: 12, color: T.text, flex: 1 }}>{shareUrl}</div>
              <button onClick={() => navigator.clipboard?.writeText(shareUrl)} style={{ background: "none", border: `1px solid ${T.line}`, color: T.text, borderRadius: 6, padding: "4px 8px", fontSize: 12, flexShrink: 0 }}>Copy</button>
            </div>
            <button onClick={() => setShareUrl(null)} style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 14, fontWeight: 600 }}>Done</button>
          </div>
        </div>
      )}

      {showExport && <ExportWorkoutModal data={buildSnapshot()} onClose={() => setShowExport(false)} />}
    </div>
  );
}

// Lists completed workouts (most recent first) and drills into a
// per-exercise, per-set breakdown for whichever one is selected. Can be
// opened straight into a specific workout (e.g. from tapping a calendar
// day) via `initialWorkoutId`, in which case the back arrow closes
// directly instead of returning to the list.
export default function WorkoutHistory({ history, initialWorkoutId, dateFilter, units = "lb", timeFormat, user, onClose, onDeleted, onSetUpdated, onSetAdded, onSetRemoved, onExerciseAdded, onExerciseRemoved }) {
  const [selectedId, setSelectedId] = useState(initialWorkoutId || null);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState(null); // null | array of workout ids pending delete confirmation
  const [deleting, setDeleting] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [checkedIds, setCheckedIds] = useState(() => new Set());
  const [editMode, setEditMode] = useState(false);
  const openedDirectly = Boolean(initialWorkoutId);

  const sorted = [...(history || [])]
    .filter((w) => !dateFilter || toLocalDateStr(w.completed_at) === dateFilter)
    .sort((a, b) => b.completed_at.localeCompare(a.completed_at));
  const selected = selectedId ? sorted.find((w) => w.id === selectedId) : null;
  const dateFilterLabel = dateFilter ? new Date(`${dateFilter}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase() : null;

  function handleBack() {
    if (selected && !openedDirectly) { setSelectedId(null); setEditMode(false); }
    else onClose();
  }

  function toggleChecked(id) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setCheckedIds(new Set());
  }

  async function handleDeleteMany(ids) {
    setDeleting(true);
    const failed = [];
    for (const id of ids) {
      try {
        await deleteWorkout(id);
        onDeleted && onDeleted(id);
      } catch (err) {
        failed.push(id);
      }
    }
    setConfirmDeleteIds(null);
    setDeleting(false);
    exitSelectMode();
    if (selectedId && ids.includes(selectedId) && !failed.includes(selectedId)) {
      if (openedDirectly) onClose();
      else setSelectedId(null);
    }
    if (failed.length > 0) {
      window.alert(`Couldn't delete ${failed.length} of ${ids.length} session${ids.length === 1 ? "" : "s"}.`);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 30, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <style>{`button { cursor: pointer; }`}</style>
      <div style={{ width: "100%", maxWidth: 400, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}>
          {selectMode ? (
            <button onClick={exitSelectMode} aria-label="Cancel" style={smallBtn}>Cancel</button>
          ) : (
            <button onClick={handleBack} aria-label="Back" style={smallBtn}>‹</button>
          )}
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: T.text, textAlign: "center" }}>
            {selectMode ? `${checkedIds.size} SELECTED` : selected ? "WORKOUT" : dateFilterLabel || "HISTORY"}
          </div>
          {selected ? (
            <button onClick={() => setEditMode(!editMode)} aria-label={editMode ? "Done editing" : "Edit workout"} style={{ ...smallBtn, color: editMode ? "#fff" : T.text, background: editMode ? T.accent : "none", borderColor: editMode ? T.accent : T.line }}>
              {editMode ? "Done" : "Edit"}
            </button>
          ) : !selectMode && sorted.length > 0 ? (
            <button onClick={() => setSelectMode(true)} aria-label="Edit" style={smallBtn}>Edit</button>
          ) : (
            <div style={{ width: 26 }} />
          )}
        </div>

        {confirmDeleteIds && (
          <div style={{ margin: "12px 16px 0", background: "rgba(232,68,46,0.1)", border: `1px solid ${T.accent}`, borderRadius: 10, padding: 12 }}>
            <div style={{ color: T.text, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              {confirmDeleteIds.length === 1 ? "Delete this session?" : `Delete ${confirmDeleteIds.length} sessions?`}
            </div>
            <div style={{ color: T.dim, fontSize: 11.5, marginBottom: 10, lineHeight: 1.4 }}>
              This permanently removes {confirmDeleteIds.length === 1 ? "the workout and every set logged in it" : "these workouts and every set logged in them"}. Can't be undone.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmDeleteIds(null)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 12.5 }}>Cancel</button>
              <button onClick={() => handleDeleteMany(confirmDeleteIds)} disabled={deleting} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: T.accent, color: "#fff", fontSize: 12.5, fontWeight: 700 }}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        )}

        {selected ? (
          <DetailView
            workout={selected}
            units={units}
            timeFormat={timeFormat}
            userId={user.id}
            editMode={editMode}
            onRequestDelete={() => setConfirmDeleteIds([selected.id])}
            onSetUpdated={onSetUpdated}
            onSetAdded={onSetAdded}
            onSetRemoved={onSetRemoved}
            onExerciseAdded={onExerciseAdded}
            onExerciseRemoved={onExerciseRemoved}
          />
        ) : (
          <div style={{ padding: 16, paddingBottom: selectMode ? 90 : 16, flex: 1 }}>
            {sorted.length === 0 && (
              <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 20px", border: `1px dashed ${T.line}`, borderRadius: 12 }}>
                No completed workouts yet.
              </div>
            )}
            {sorted.map((w) => {
              const dateStr = new Date(w.completed_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
              const startTimeStr = w.started_at ? formatClockTime(w.started_at, timeFormat) : null;
              const exCount = (w.workout_exercises || []).length;
              const checked = checkedIds.has(w.id);
              return (
                <div
                  key={w.id}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: T.surface, border: `1px solid ${checked ? T.accent : T.line}`, borderRadius: 12, marginBottom: 10 }}
                >
                  <button
                    onClick={() => (selectMode ? toggleChecked(w.id) : setSelectedId(w.id))}
                    style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}
                  >
                    {selectMode && (
                      <div style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${checked ? T.accent : T.line}`, background: checked ? T.accent : "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff", fontSize: 12, fontWeight: 700 }}>
                        {checked ? <IconCheck size={12} /> : ""}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, color: T.text }}>{dateStr}{startTimeStr && <span style={{ color: T.dim, fontWeight: 400, fontSize: 13 }}> · {startTimeStr}</span>}</div>
                      <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>{exCount} exercise{exCount === 1 ? "" : "s"} · {workoutSetCount(w)} sets · {Math.round(toDisplay(workoutVolume(w), units)).toLocaleString()} {units}</div>
                    </div>
                    {!selectMode && <div style={{ color: T.dim, fontSize: 16 }}>›</div>}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {selectMode && (
          <div style={{ position: "sticky", bottom: 0, borderTop: `1px solid ${T.line}`, background: T.surface, padding: 16, display: "flex", gap: 10 }}>
            <button
              onClick={() => setCheckedIds(checkedIds.size === sorted.length ? new Set() : new Set(sorted.map((w) => w.id)))}
              style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${T.line}`, background: "none", color: T.text, fontSize: 14, fontWeight: 600 }}
            >
              {checkedIds.size === sorted.length ? "Deselect All" : "Select All"}
            </button>
            <button
              onClick={() => setConfirmDeleteIds([...checkedIds])}
              disabled={checkedIds.size === 0}
              style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "none", background: checkedIds.size === 0 ? T.surface2 : T.accent, color: checkedIds.size === 0 ? T.dim : "#fff", fontSize: 14, fontWeight: 700 }}
            >
              Delete {checkedIds.size > 0 ? `(${checkedIds.size})` : ""}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
