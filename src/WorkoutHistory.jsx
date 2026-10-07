import { useState, useEffect, useMemo, useRef } from "react";
import { isWorkedExercise, computeMuscleSetCounts } from "./lib/volume";
import { getPrefs } from "./lib/prefs";
import ExerciseThumb from "./ExerciseThumb";
import ExportWorkoutModal from "./ExportWorkoutModal";
import { IconX, IconCamera, IconImage, IconTrash, IconCheck, IconShare, IconMoreHorizontal } from "./Icons";
import { InlineLoading } from "./LoadingSpinner";
import { formatWeight, toDisplay, toCanonical } from "./lib/weight";
import { buildExportStats, autoTitle, compactNum, fmtW, PR_LABEL } from "./lib/exportStats";
import { formatClockTime, toLocalDateStr } from "./lib/time";
import {
  deleteWorkout, updateSet, deleteSet, logSet, addWorkoutExercise, removeWorkoutExercise,
  fetchExercises, uploadProgressPhoto, fetchProgressPhoto, deleteProgressPhoto, setSetWarmup, shareWorkout, saveWorkoutSummary,
  saveWorkoutAsTemplate,
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

const prTag = { fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "rgba(232,68,46,0.18)", color: "#E8442E", whiteSpace: "nowrap", flexShrink: 0 };
const actionBtn = { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "12px 0", borderRadius: 12, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" };
const menuItem = { display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: "#F2F1EC", fontSize: 14, padding: "10px 12px", borderRadius: 8, whiteSpace: "nowrap" };
const smallBtn = { background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 13, whiteSpace: "nowrap" };

function workoutVolume(w) {
  return Math.round((w.workout_exercises || []).reduce(
    (sum, we) => sum + (we.sets || []).filter((set) => !set.is_warmup).reduce((s, set) => s + (set.weight || 0) * (set.reps || 0), 0),
    0
  ));
}
function workoutSetCount(w) {
  const all = (w.workout_exercises || []).reduce((sum, we) => sum + (we.sets || []).length, 0);
  const working = (w.workout_exercises || []).reduce((sum, we) => sum + (we.sets || []).filter((set) => !set.is_warmup).length, 0);
  return { total: all, working, warmup: all - working };
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
  const [showFull, setShowFull] = useState(false);

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
        <InlineLoading label="Loading…" size={16} padding="2px 0" />
      ) : photo ? (
        <div style={{ position: "relative" }}>
          <img
            src={photo.url}
            alt="Progress"
            data-html2canvas-ignore="true"
            onClick={() => setShowFull(true)}
            style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 12, border: `1px solid ${T.line}`, cursor: "pointer" }}
          />
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
      {showFull && photo && (
        <div
          onClick={() => setShowFull(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.92)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <img src={photo.url} alt="Progress full resolution" data-html2canvas-ignore="true" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} />
          <button
            onClick={() => setShowFull(false)}
            aria-label="Close"
            style={{ position: "absolute", top: 16, right: 16, background: "rgba(16,18,22,0.8)", border: `1px solid ${T.line}`, color: T.text, borderRadius: 999, width: 34, height: 34, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <IconX size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function DetailView({ workout, history, units, timeFormat, userId, editMode, prev, next, onNavigate, onRepeat, repeatBlocked, onRequestDelete, onSetUpdated, onSetAdded, onSetRemoved, onExerciseAdded, onExerciseRemoved, onBodyWeightUpdated }) {
  const dateStr = new Date(workout.completed_at).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const startTimeStr = workout.started_at ? formatClockTime(workout.started_at, timeFormat) : null;
  const isoDate = toLocalDateStr(workout.completed_at);
  const duration = workoutDurationMin(workout);
  const volume = Math.round(toDisplay(workoutVolume(workout), units));
  const setCounts = workoutSetCount(workout);
  const exercises = [...(workout.workout_exercises || [])].sort((a, b) => (a.position || 0) - (b.position || 0));
  // Display-unit snapshot of this workout, shared by the title, the
  // What changed block and the per-set PR outlines. Same shape the export
  // image uses, so lib/exportStats.js judges PRs and deltas identically
  // in both places (all-time bests as of this workout's date).
  const statsData = useMemo(() => ({
    workoutId: workout.id,
    completedAt: workout.completed_at,
    unit: units,
    totalSets: setCounts.working,
    totalVolume: volume,
    durationMin: duration,
    exercises: exercises.map((we) => ({
      exerciseId: we.exercise_id,
      name: (we.exercises && (we.exercises.name || we.exercises.short)) || "Exercise",
      muscleGroup: we.exercises?.muscle_group,
      sets: [...(we.sets || [])].sort((a, b) => (a.set_number || 0) - (b.set_number || 0)).map((st) => ({ weight: formatWeight(Number(st.weight), units), reps: st.reps, rir: st.rir, isWarmup: !!st.is_warmup })),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [workout, units]);
  const stats = useMemo(() => (history ? buildExportStats({ data: statsData, history }) : null), [statsData, history]);
  const title = autoTitle(statsData.exercises);
  const [showMore, setShowMore] = useState(false);
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
  const [exportData, setExportData] = useState(null); // snapshot taken when the sheet opens, so it stays stable while open
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaveError, setTemplateSaveError] = useState(null);
  const [templateSaved, setTemplateSaved] = useState(false);

  // Retroactive "save as template" -- same saveWorkoutAsTemplate call the
  // live in-workout flow uses (SetLogger's handleSaveTemplate), just fed
  // from a past workout's logged exercises/sets instead of the current
  // in-progress ones. includeDetails is always false here: a completed
  // workout's per-set weight/reps aren't a sensible "planned setup" for
  // a reusable template, so this only carries over the exercise list,
  // working-set count, and warmup-set count, same blank-slate shape as
  // unchecking "include details" in the live flow.
  async function handleSaveAsTemplate() {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    setTemplateSaveError(null);
    try {
      const workoutItems = exercises.map((we) => ({
        id: we.exercise_id,
        planned: (we.sets || []).filter((s) => !s.is_warmup).length || 1,
        plannedWarmup: (we.sets || []).filter((s) => s.is_warmup).length,
      }));
      await saveWorkoutAsTemplate(userId, templateName.trim(), workoutItems, false);
      setTemplateSaved(true);
      setTimeout(() => { setShowSaveTemplate(false); setTemplateName(""); setTemplateSaved(false); }, 1200);
    } catch (err) {
      setTemplateSaveError(err.message);
    }
    setSavingTemplate(false);
  }
  const [progressPhoto, setProgressPhoto] = useState(undefined); // mirrors ProgressPhotoBlock's photo, lifted so "Save as image" can use it as a Story background
  const [editingBodyWeight, setEditingBodyWeight] = useState(false);
  const [bodyWeightDraft, setBodyWeightDraft] = useState("");
  const [savingBodyWeight, setSavingBodyWeight] = useState(false);
  const [bodyWeightError, setBodyWeightError] = useState(null);

  function startEditBodyWeight() {
    setBodyWeightDraft(workout.body_weight != null ? String(workout.body_weight) : "");
    setBodyWeightError(null);
    setEditingBodyWeight(true);
  }

  // No unit conversion here, matching how body weight is captured in the
  // post-workout screen — it's stored exactly as typed, in whatever unit
  // was active at the time, not canonicalized like exercise weights.
  async function saveBodyWeightEdit() {
    const w = bodyWeightDraft.trim() === "" ? null : parseFloat(bodyWeightDraft);
    if (bodyWeightDraft.trim() !== "" && (isNaN(w) || w < 0)) { setBodyWeightError("Enter a valid weight, or leave it blank to clear."); return; }
    setSavingBodyWeight(true);
    setBodyWeightError(null);
    try {
      await saveWorkoutSummary(workout.id, w, workout.session_notes || null);
      onBodyWeightUpdated && onBodyWeightUpdated(workout.id, w);
      setEditingBodyWeight(false);
    } catch (err) {
      setBodyWeightError(err.message);
    }
    setSavingBodyWeight(false);
  }

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
      totalSets: setCounts.working,
      totalVolume: volume,
      durationMin: duration,
      bodyWeight: workout.body_weight != null ? formatWeight(workout.body_weight, units) : null,
      exercises: snapshotExercises,
      photoUrl: progressPhoto?.url || null,
    };
  }

  // Export-image snapshot: the share snapshot plus what the image needs
  // to judge PRs and progress (ids, muscle groups, completion time) and
  // the muscle-map counts, same raw-tag path the post-workout map uses.
  function buildExportData() {
    const base = buildSnapshot();
    const nameMode = getPrefs().muscleNameMode;
    const { primary, secondary } = computeMuscleSetCounts(
      exercises.map((we) => ({ muscle: we.exercises?.muscle_group, primaryMuscles: we.exercises?.primary_muscles || [], secondaryMuscles: we.exercises?.secondary_muscles || [], sets: we.sets || [] })),
      nameMode
    );
    return {
      ...base,
      workoutId: workout.id,
      completedAt: workout.completed_at,
      muscleMap: { primary, secondary, nameMode },
      exercises: base.exercises.map((ex, i) => ({ ...ex, exerciseId: exercises[i].exercise_id, muscleGroup: exercises[i].exercises?.muscle_group })),
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
    if (isNaN(w) || w < 0 || isNaN(r) || r < 0) { setSaveError("Weight and reps are required."); return; }
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
    if (isNaN(w) || w < 0 || isNaN(r) || r < 0) { setSaveError("Weight and reps are required."); return; }
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

  const shortDate = (w) => new Date(w.completed_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const deltaText = (d) => {
    if (!d || d.value === 0) return null;
    const sign = d.value > 0 ? "+" : "\u2212";
    if (d.kind === "weight") return `${sign}${fmtW(Math.abs(d.value))} ${units}`;
    const n = Math.abs(d.value);
    return `${sign}${n} rep${n === 1 ? "" : "s"}`;
  };
  const changes = stats && stats.hasHistory
    ? stats.exercises.map((e, i) => ({ e, i })).filter(({ e }) => e.workingCount > 0 && (e.prs.length > 0 || (e.delta && e.delta.value !== 0)))
    : [];
  const showChanges = !editMode && stats && stats.hasHistory && (changes.length > 0 || (stats.compare && stats.compare.volumePct != null));
  const statCol = { flex: 1, minWidth: 0, textAlign: "center" };
  const statVal = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.text, whiteSpace: "nowrap" };
  const statLab = { fontSize: 11, color: T.dim, whiteSpace: "nowrap" };
  const navBtn = { background: "none", border: "none", color: T.dim, fontSize: 13, padding: "6px 2px", whiteSpace: "nowrap" };

  return (
    <div style={{ padding: "12px 16px 0", flex: 1, display: "flex", flexDirection: "column" }}>
      {/* Prev / next between workouts, chronological across all history */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 30 }}>
        {prev ? <button onClick={() => onNavigate(prev.id)} style={navBtn}>‹ {shortDate(prev)}</button> : <span />}
        {next ? <button onClick={() => onNavigate(next.id)} style={navBtn}>{shortDate(next)} ›</button> : <span />}
      </div>

      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: T.text, lineHeight: 1.05, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
      <div style={{ color: T.dim, fontSize: 12.5, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{dateStr}{startTimeStr ? ` · ${startTimeStr}` : ""}</div>
      {editMode && (
        <div style={{ color: T.dim, fontSize: 11.5, marginTop: 6 }}>Tap any set to correct it, or add and remove sets and exercises.</div>
      )}

      <div style={{ display: "flex", gap: 6, marginTop: 14, marginBottom: 14, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "10px 4px" }}>
        {duration != null && (
          <div style={statCol}><div style={statVal}>{duration}</div><div style={statLab}>min</div></div>
        )}
        <div style={statCol}>
          <div style={statVal}>{setCounts.working}</div>
          <div style={statLab}>sets{setCounts.warmup > 0 ? ` +${setCounts.warmup}W` : ""}</div>
        </div>
        <div style={statCol}><div style={statVal}>{compactNum(volume)}</div><div style={statLab}>{units} volume</div></div>
        {editMode ? (
          <button onClick={startEditBodyWeight} style={{ ...statCol, background: "none", border: "none", padding: 0 }}>
            <div style={{ ...statVal, color: workout.body_weight != null ? T.text : T.dim }}>{workout.body_weight != null ? workout.body_weight : "+ Add"}</div>
            <div style={statLab}>bodyweight</div>
          </button>
        ) : workout.body_weight != null && (
          <div style={statCol}><div style={statVal}>{workout.body_weight}</div><div style={statLab}>bodyweight</div></div>
        )}
      </div>

      {showChanges && (
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "10px 12px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 600, color: T.dim, marginBottom: 4 }}>
            <span>What changed</span>
            <span>vs last time</span>
          </div>
          {stats.compare && stats.compare.volumePct != null && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "3px 0" }}>
              <span style={{ color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Volume <span style={{ color: T.dim }}>vs {shortDate({ completed_at: stats.compare.date })}</span></span>
              <span style={{ color: stats.compare.volumePct > 0 ? T.green : stats.compare.volumePct < 0 ? "#E8A82E" : T.dim, fontWeight: 600, whiteSpace: "nowrap" }}>{stats.compare.volumePct > 0 ? "+" : stats.compare.volumePct < 0 ? "\u2212" : "\u00b1"}{Math.abs(stats.compare.volumePct)}%</span>
            </div>
          )}
          {changes.slice(0, 5).map(({ e, i }) => {
            const dt = deltaText(e.delta);
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 13, padding: "3px 0" }}>
                <span style={{ color: T.text, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{statsData.exercises[i].name}</span>
                {dt && <span style={{ color: e.delta.value > 0 ? T.green : "#E8A82E", fontWeight: 600, whiteSpace: "nowrap" }}>{dt}</span>}
                {e.prs.length > 0 && <span style={prTag}>PR</span>}
              </div>
            );
          })}
          {changes.length > 5 && <div style={{ fontSize: 11.5, color: T.dim, marginTop: 2 }}>+{changes.length - 5} more below</div>}
        </div>
      )}

      {editingBodyWeight && (
        <div style={{ background: T.surface2, border: `1px solid ${T.accent}`, borderRadius: 10, padding: 10, marginBottom: 16, marginTop: -8 }}>
          <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Bodyweight ({units})</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              inputMode="decimal"
              autoFocus
              value={bodyWeightDraft}
              onChange={(e) => setBodyWeightDraft(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="e.g. 178"
              style={{ flex: 1, minWidth: 0, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 14, padding: "8px 10px", outline: "none", boxSizing: "border-box" }}
            />
            <button onClick={() => setEditingBodyWeight(false)} disabled={savingBodyWeight} style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 6, padding: "8px 10px", fontSize: 12 }}>Cancel</button>
            <button onClick={saveBodyWeightEdit} disabled={savingBodyWeight} style={{ background: T.accent, border: "none", color: "#fff", borderRadius: 6, padding: "8px 10px", fontSize: 12, fontWeight: 700 }}>{savingBodyWeight ? "…" : "Save"}</button>
          </div>
          {bodyWeightError && <div style={{ color: T.accent, fontSize: 11, marginTop: 6 }}>{bodyWeightError}</div>}
        </div>
      )}

      {!editMode && exercises.map((we, i) => {
        const ex = we.exercises || {};
        const sets = [...(we.sets || [])].sort((a, b) => (a.set_number || 0) - (b.set_number || 0));
        const labels = setLabels(sets);
        const est = stats ? stats.exercises[i] : null;
        const dt = est ? deltaText(est.delta) : null;
        let right = null;
        if (est && est.prs.length > 0) right = <span style={prTag}>{PR_LABEL[est.prs[0].type]}</span>;
        else if (dt) right = <span style={{ fontSize: 12, fontWeight: 600, color: est.delta.value > 0 ? T.green : "#E8A82E", whiteSpace: "nowrap" }}>{dt}</span>;
        else if (est && est.last && est.workingCount > 0) right = <span style={{ fontSize: 12, color: T.dim, whiteSpace: "nowrap" }}>same as last</span>;
        else if (est && stats.hasHistory && !est.last && est.workingCount > 0) right = <span style={{ fontSize: 12, color: T.dim, whiteSpace: "nowrap" }}>first time</span>;
        return (
          <div key={we.id || i} style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${T.line}` }}>
              <ExerciseThumb muscle={ex.muscle_group} mediaUrl={ex.media_url} size={20} />
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, color: T.text, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ex.name || ex.short || "Exercise"}</div>
              {right}
            </div>
            {sets.length === 0 ? (
              <div style={{ fontSize: 12, color: T.dim, padding: "8px 0" }}>No sets logged.</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 0 6px" }}>
                {sets.map((st, j) => {
                  const isPR = !!(est && est.prSetIndexes.has(j));
                  const warm = !!st.is_warmup;
                  return (
                    <span key={j} style={{ display: "inline-flex", alignItems: "baseline", gap: 4, padding: "4px 9px", borderRadius: 999, whiteSpace: "nowrap", fontSize: 13, border: `1px solid ${isPR ? T.accent : warm ? "rgba(232,168,46,0.45)" : T.line}`, background: isPR ? "rgba(232,68,46,0.10)" : "none", color: isPR ? T.accent : warm ? "#E8A82E" : T.text, fontWeight: isPR ? 700 : 500 }}>
                      {warm && <span style={{ fontSize: 11, fontWeight: 700 }}>{labels[j]}</span>}
                      {formatWeight(st.weight, units)}×{st.reps}
                      {st.rir != null && <span style={{ fontSize: 11, color: isPR ? T.accent : T.dim, fontWeight: 400 }}>RIR {st.rir}</span>}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {editMode && exercises.map((we, i) => {
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
              <InlineLoading size={18} padding="8px 0" />
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

      {workout.session_notes && (
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, marginTop: 10, fontSize: 13, color: T.text, fontStyle: "italic" }}>
          "{workout.session_notes}"
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <ProgressPhotoBlock userId={userId} dateStr={isoDate} onPhotoChange={setProgressPhoto} />
      </div>

      <div style={{ flex: 1 }} />
      {!editMode && (
        <div style={{ position: "sticky", bottom: 0, margin: "12px -16px 0", padding: "12px 16px calc(12px + env(safe-area-inset-bottom, 0px))", background: T.bg, borderTop: `1px solid ${T.line}`, display: "flex", gap: 8, zIndex: 2 }}>
          <button
            onClick={() => onRepeat && !repeatBlocked && onRepeat(workout)}
            disabled={repeatBlocked}
            title={repeatBlocked ? "Finish your current workout first" : undefined}
            style={{ flex: 1.4, padding: "12px 0", borderRadius: 12, border: "none", background: repeatBlocked ? T.surface2 : T.accent, color: repeatBlocked ? T.dim : "#fff", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}
          >
            {repeatBlocked ? "Workout in progress" : "Do again"}
          </button>
          <button onClick={() => { setExportData(buildExportData()); setShowExport(true); }} style={actionBtn}><IconImage size={14} /> Image</button>
          <button onClick={handleShare} disabled={sharing} style={actionBtn}><IconShare size={14} /> {sharing ? "…" : "Share"}</button>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button onClick={() => setShowMore((v) => !v)} aria-label="More actions" style={{ ...actionBtn, width: 44, flex: "none", padding: "12px 0" }}><IconMoreHorizontal size={16} /></button>
            {showMore && (
              <>
                <div onClick={() => setShowMore(false)} style={{ position: "fixed", inset: 0, zIndex: 3 }} />
                <div style={{ position: "absolute", right: 0, bottom: "calc(100% + 8px)", zIndex: 4, minWidth: 190, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                  <button onClick={() => { setShowMore(false); setShowSaveTemplate(true); }} style={menuItem}>Save as template</button>
                  <button onClick={() => { setShowMore(false); onRequestDelete(); }} style={{ ...menuItem, color: T.accent }}>Delete workout</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {editMode && <div style={{ height: 16 }} />}

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

      {showExport && <ExportWorkoutModal data={exportData} userId={userId} history={history} onClose={() => setShowExport(false)} />}
      {showSaveTemplate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.75)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 360, background: T.bg, border: `1px solid ${T.line}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 4 }}>Save as template</div>
            <div style={{ fontSize: 12, color: T.dim, marginBottom: 14 }}>Carries over this workout's exercise list and set counts, not the specific weights/reps logged.</div>
            <input
              autoFocus
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface, color: T.text, fontSize: 14, marginBottom: 12 }}
            />
            {templateSaveError && <div style={{ color: T.accent, fontSize: 12, marginBottom: 10 }}>{templateSaveError}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setShowSaveTemplate(false); setTemplateName(""); setTemplateSaveError(null); }} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 14 }}>Cancel</button>
              <button onClick={handleSaveAsTemplate} disabled={!templateName.trim() || savingTemplate} style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", background: !templateName.trim() || savingTemplate ? T.surface2 : T.accent, color: !templateName.trim() || savingTemplate ? T.dim : "#fff", fontSize: 14, fontWeight: 700 }}>
                {savingTemplate ? "Saving…" : templateSaved ? <><IconCheck size={13} /> Saved</> : "Save Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Lists completed workouts (most recent first) and drills into a
// per-exercise, per-set breakdown for whichever one is selected. Can be
// opened straight into a specific workout (e.g. from tapping a calendar
// day) via `initialWorkoutId`, in which case the back arrow closes
// directly instead of returning to the list.
export default function WorkoutHistory({ history, initialWorkoutId, dateFilter, units = "lb", timeFormat, user, activeWorkout, onRepeatWorkout, onClose, onDeleted, onSetUpdated, onSetAdded, onSetRemoved, onExerciseAdded, onExerciseRemoved, onBodyWeightUpdated }) {
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
  // Looked up in the full history (not just the date-filtered list) so
  // prev/next can walk past the day a calendar tap opened.
  const selected = selectedId ? (history || []).find((w) => w.id === selectedId) || null : null;
  const chronological = [...(history || [])].filter((w) => w.completed_at).sort((a, b) => a.completed_at.localeCompare(b.completed_at));
  const selIdx = selected ? chronological.findIndex((w) => w.id === selected.id) : -1;
  const prevWorkout = selIdx > 0 ? chronological[selIdx - 1] : null;
  const nextWorkout = selIdx >= 0 && selIdx < chronological.length - 1 ? chronological[selIdx + 1] : null;
  const scrollRef = useRef(null);
  // A delete started from the detail view's bottom bar shows its
  // confirmation at the top of the screen; bring it into view.
  useEffect(() => {
    if (confirmDeleteIds && scrollRef.current) scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
  }, [confirmDeleteIds]);
  function navigateTo(id) {
    setSelectedId(id);
    setEditMode(false);
    if (scrollRef.current) scrollRef.current.scrollTo({ top: 0 });
  }
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
    <div ref={scrollRef} style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 30, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <style>{`button { cursor: pointer; }`}</style>
      <div style={{ width: "100%", maxWidth: 400, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8, position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
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
            key={selected.id}
            workout={selected}
            history={history}
            prev={prevWorkout}
            next={nextWorkout}
            onNavigate={navigateTo}
            onRepeat={onRepeatWorkout}
            repeatBlocked={!!(activeWorkout && !activeWorkout.isPaused)}
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
            onBodyWeightUpdated={onBodyWeightUpdated}
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
              const exCount = (w.workout_exercises || []).filter(isWorkedExercise).length;
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
                      <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>{exCount} exercise{exCount === 1 ? "" : "s"} · {workoutSetCount(w).working} sets · {Math.round(toDisplay(workoutVolume(w), units)).toLocaleString()} {units}</div>
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
