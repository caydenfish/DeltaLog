import { useState, useEffect, useRef } from "react";
import { fetchExercises, fetchTemplates, saveWorkoutAsTemplate, deleteTemplate, fetchPerformedExerciseIds, fetchFavoriteExerciseIds, setFavoriteExercise, fetchTemplateForEdit, updateTemplate, reorderTemplates, setTemplateArchived, fetchArchivedTemplates, exportTemplate, fetchSharedTemplate, importSharedTemplate, createCustomExercise, uploadExerciseMedia, normalizeExercise } from "./lib/queries";
import { computeMuscleSetCounts } from "./lib/volume";
import { muscleLabel } from "./lib/muscleNomenclature";
import { getPrefs } from "./lib/prefs";
import BodyHeatmap from "./BodyHeatmap";
import { InlineLoading } from "./LoadingSpinner";
import { IconX, IconDownload } from "./Icons";
import ExercisePicker, { filterLibrary, splitGroupFor } from "./ExercisePicker";
import CustomExerciseModal from "./CustomExerciseModal";

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

// Renders a thin accent-colored line at the exact insertion point for a
// dragged row, instead of highlighting the row being hovered over.
function InsertionLine({ drag, i }) {
  if (drag.dragIndex === null || drag.dragOverIndex !== i) return null;
  if (drag.dragIndex > i) return <div style={{ position: "absolute", left: 8, right: 8, top: -6, height: 3, borderRadius: 2, background: T.accent }} />;
  if (drag.dragIndex < i) return <div style={{ position: "absolute", left: 8, right: 8, bottom: -6, height: 3, borderRadius: 2, background: T.accent }} />;
  return null;
}

// Pointer-based drag reorder, works for touch and mouse alike. Used for
// both the template list and the exercise list within a template — call
// once per list, at the top of the component (rules of hooks).
function useDragReorder(setItems) {
  const rowRefs = useRef([]);
  const dragOverRef = useRef(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  function startRowDrag(i, e) {
    e.preventDefault();
    setDragIndex(i);
    setDragOverIndex(i);
    dragOverRef.current = i;
    const onMove = (ev) => {
      const y = ev.touches ? ev.touches[0].clientY : ev.clientY;
      let closest = i;
      let closestDist = Infinity;
      rowRefs.current.forEach((el, idx) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const dist = Math.abs(y - mid);
        if (dist < closestDist) { closestDist = dist; closest = idx; }
      });
      dragOverRef.current = closest;
      setDragOverIndex(closest);
    };
    const onEnd = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      const to = dragOverRef.current;
      setItems((prev) => {
        if (i === to) return prev;
        const next = [...prev];
        const [item] = next.splice(i, 1);
        next.splice(to, 0, item);
        return next;
      });
      setDragIndex(null);
      setDragOverIndex(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
  }

  return { rowRefs, dragIndex, dragOverIndex, startRowDrag };
}

export default function Templates({ user, onClose, initialPicks }) {
  const [library, setLibrary] = useState(null);
  const [templates, setTemplates] = useState(null);
  const [mode, setMode] = useState("list"); // "list" | "build"
  const [error, setError] = useState(null);

  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [picks, setPicks] = useState([]); // [{ id, name, short, muscle, planned }]
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null); // template id being edited, or null when creating new
  const [loadingEditId, setLoadingEditId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivingId, setArchivingId] = useState(null);
  const [replacingId, setReplacingId] = useState(null); // pick id currently being replaced, or null
  const [replaceSearch, setReplaceSearch] = useState("");
  const [archivedTemplates, setArchivedTemplates] = useState(null);
  const [archivedBusyId, setArchivedBusyId] = useState(null);
  const [sharingId, setSharingId] = useState(null); // template id currently generating/showing a share code
  const [shareCode, setShareCode] = useState(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importCode, setImportCode] = useState("");
  const [importPreview, setImportPreview] = useState(null); // { name, picks, skippedCount } | null
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState(null);

  // ---- Exercise picker state, shared between "Add exercises" and the
  // "Replace with" sheet, same pattern as SetLogger's manual add/replace flow.
  const [muscleFilter, setMuscleFilter] = useState([]);
  const [equipFilter, setEquipFilter] = useState([]);
  const [performedFilter, setPerformedFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [showPickerFilters, setShowPickerFilters] = useState(false);
  const [showCreateCustom, setShowCreateCustom] = useState(false);
  const pendingCustomPick = useRef(null);

  function applyPickerSplit(splitName) {
    const mode = getPrefs().muscleNameMode;
    const group = splitGroupFor(splitName, mode);
    const isActive = group.length > 0 && group.length === muscleFilter.length && group.every((m) => muscleFilter.includes(m));
    setMuscleFilter(isActive ? [] : group);
  }

  // Returns JSX for the "create custom exercise" footer inside an
  // ExercisePicker, matching SetLogger's manual add/replace flow.
  function createCustomFooter(onPick) {
    return (
      <button onClick={() => { pendingCustomPick.current = onPick; setShowCreateCustom(true); }} style={{ width: "100%", padding: "10px 0", marginTop: 6, borderRadius: 10, border: `1px dashed ${T.line}`, background: "none", color: T.dim, fontSize: 13 }}>
        + Create custom exercise
      </button>
    );
  }

  async function handleCreateCustomExercise({ name, muscle, primaryMuscles, secondaryMuscles, equipment, photoFile }) {
    let mediaUrl = null;
    if (photoFile) {
      mediaUrl = await uploadExerciseMedia(user.id, photoFile);
    }
    const row = await createCustomExercise(user.id, { name, muscle, primaryMuscles, secondaryMuscles, equipment, mediaUrl });
    const normalized = normalizeExercise(row);
    setLibrary((prev) => [...(prev || []), { ...normalized, sessions: 0, isFavorite: false }]);
    if (pendingCustomPick.current) pendingCustomPick.current(normalized);
    setShowCreateCustom(false);
  }

  const templateDrag = useDragReorder((updater) => {
    setTemplates((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      reorderTemplates(next.map((t) => t.id)).catch((err) => setError(err.message));
      return next;
    });
  });
  const picksDrag = useDragReorder(setPicks);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [lib, t, performedIds, favIds, archived] = await Promise.all([fetchExercises(), fetchTemplates(user.id), fetchPerformedExerciseIds(user.id), fetchFavoriteExerciseIds(user.id), fetchArchivedTemplates(user.id)]);
        if (cancelled) return;
        setLibrary(lib.map((l) => ({ ...l, sessions: performedIds.has(l.id) ? 1 : 0, isFavorite: favIds.has(l.id) })));
        setTemplates(t);
        setArchivedTemplates(archived);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [user.id]);

  // If opened with a pre-selected set of exercises (e.g. from "Create a
  // template from these exercises" on My Custom Exercises), seed picks and
  // jump straight into the builder instead of the template list. Runs once
  // on mount only — initialPicks is a one-time seed, not a controlled prop.
  useEffect(() => {
    if (initialPicks && initialPicks.length > 0) {
      setPicks(initialPicks.map((ex) => ({ id: ex.id, name: ex.name, short: ex.short, muscle: ex.muscle, primaryMuscles: ex.primaryMuscles, secondaryMuscles: ex.secondaryMuscles, planned: 3, plannedWarmup: 0 })));
      setMode("build");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleFavorite(id) {
    setLibrary((prev) => prev.map((l) => (l.id === id ? { ...l, isFavorite: !l.isFavorite } : l)));
    const target = library.find((l) => l.id === id);
    setFavoriteExercise(user.id, id, !(target && target.isFavorite)).catch((err) => setError(err.message));
  }

  function startBuild() {
    setEditingId(null);
    setName("");
    setSearch("");
    setPicks([]);
    setReplacingId(null);
    setMuscleFilter([]);
    setEquipFilter([]);
    setPerformedFilter("all");
    setSourceFilter("all");
    setShowPickerFilters(false);
    setMode("build");
  }

  async function startEdit(t) {
    setLoadingEditId(t.id);
    try {
      const full = await fetchTemplateForEdit(t.id);
      setEditingId(full.id);
      setName(full.name);
      setPicks(full.picks);
      setSearch("");
      setReplacingId(null);
      setMuscleFilter([]);
      setEquipFilter([]);
      setPerformedFilter("all");
      setSourceFilter("all");
      setShowPickerFilters(false);
      setMode("build");
    } catch (err) {
      setError(err.message);
    }
    setLoadingEditId(null);
  }

  function addPick(ex) {
    if (picks.some((p) => p.id === ex.id)) return;
    setPicks([...picks, { id: ex.id, name: ex.name, short: ex.short, muscle: ex.muscle, primaryMuscles: ex.primaryMuscles, secondaryMuscles: ex.secondaryMuscles, planned: 3, plannedWarmup: 0 }]);
    setSearch("");
  }
  function removePick(id) { setPicks(picks.filter((p) => p.id !== id)); }
  function replacePick(id, ex) {
    if (picks.some((p) => p.id === ex.id)) return; // already in the template
    setPicks(picks.map((p) => (p.id === id ? { id: ex.id, name: ex.name, short: ex.short, muscle: ex.muscle, primaryMuscles: ex.primaryMuscles, secondaryMuscles: ex.secondaryMuscles, planned: p.planned, plannedWarmup: p.plannedWarmup || 0 } : p)));
    setReplacingId(null);
    setReplaceSearch("");
  }
  function adjustPlanned(id, n) { setPicks(picks.map((p) => (p.id === id ? { ...p, planned: n } : p))); }
  function adjustWarmup(id, n) { setPicks(picks.map((p) => (p.id === id ? { ...p, plannedWarmup: n } : p))); }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed || picks.length === 0) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateTemplate(editingId, trimmed, picks);
      } else {
        await saveWorkoutAsTemplate(user.id, trimmed, picks, false);
      }
      const refreshed = await fetchTemplates(user.id);
      setTemplates(refreshed);
      setMode("list");
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    try {
      await deleteTemplate(id);
      setTemplates(templates.filter((t) => t.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleShare(id) {
    setSharingId(id);
    setShareCode(null);
    setShareBusy(true);
    try {
      const code = await exportTemplate(user.id, id);
      setShareCode(code);
    } catch (err) {
      setError(err.message);
      setSharingId(null);
    }
    setShareBusy(false);
  }

  async function handlePreviewImport() {
    setImportError(null);
    setImportPreview(null);
    if (!importCode.trim()) return;
    setImportBusy(true);
    try {
      const result = await fetchSharedTemplate(importCode);
      if (!result) setImportError("No template found for that code.");
      else if (result.picks.length === 0) setImportError("None of this template's exercises are available to you.");
      else setImportPreview(result);
    } catch (err) {
      setImportError(err.message);
    }
    setImportBusy(false);
  }

  async function handleConfirmImport() {
    if (!importPreview) return;
    setImportBusy(true);
    try {
      await importSharedTemplate(user.id, importPreview.name, importPreview.picks);
      const fresh = await fetchTemplates(user.id);
      setTemplates(fresh);
      setShowImport(false);
      setImportCode("");
      setImportPreview(null);
    } catch (err) {
      setImportError(err.message);
    }
    setImportBusy(false);
  }

  async function handleArchive(id) {
    setArchivingId(id);
    try {
      await setTemplateArchived(id, true);
      const moved = templates.find((t) => t.id === id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      if (moved) setArchivedTemplates((prev) => [...(prev || []), moved]);
    } catch (err) {
      setError(err.message);
    }
    setArchivingId(null);
  }

  async function handleUnarchiveTemplate(id) {
    setArchivedBusyId(id);
    try {
      await setTemplateArchived(id, false);
      const moved = archivedTemplates.find((t) => t.id === id);
      setArchivedTemplates((prev) => prev.filter((t) => t.id !== id));
      if (moved) setTemplates((prev) => [...prev, moved]);
    } catch (err) {
      setError(err.message);
    }
    setArchivedBusyId(null);
  }

  async function handleDeleteArchivedTemplate(id) {
    setArchivedBusyId(id);
    try {
      await deleteTemplate(id);
      setArchivedTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err.message);
    }
    setArchivedBusyId(null);
  }

  const muscleNameMode = getPrefs().muscleNameMode;
  const heatmapEntries = picks.map((p) => ({ muscle: p.muscle, primaryMuscles: p.primaryMuscles, secondaryMuscles: p.secondaryMuscles, sets: Array(p.planned).fill({ weight: 1, reps: 1 }) }));
  const { primary: heatPrimary, secondary: heatSecondary, fullBodySets: heatFullBodySets } = computeMuscleSetCounts(heatmapEntries, muscleNameMode);
  const pickedNames = new Set(picks.map((p) => p.name));
  const candidates = library
    ? filterLibrary(library, { search, muscleFilter, equipFilter, performedFilter, sourceFilter, exclude: pickedNames })
    : [];
  const replaceCandidates = library
    ? filterLibrary(library, { search: replaceSearch, muscleFilter, equipFilter, performedFilter, sourceFilter, exclude: pickedNames })
    : [];

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 30, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <style>{`button { cursor: pointer; } input:focus { border-color: ${T.accent} !important; }`}</style>
      <div style={{ width: "100%", maxWidth: 400, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}>
          <button onClick={mode === "list" ? onClose : () => { setMode("list"); setEditingId(null); }} aria-label={mode === "list" ? "Close" : "Cancel"} style={smallBtn}>
            ‹
          </button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: T.text, textAlign: "center" }}>
            {mode === "list" ? "TEMPLATES" : editingId ? "EDIT TEMPLATE" : "NEW TEMPLATE"}
          </div>
          <div style={{ width: 26 }} />
        </div>

        {error && <div style={{ margin: 16, padding: 10, borderRadius: 8, background: T.surface2, border: `1px solid ${T.accent}`, color: T.accent, fontSize: 13 }}>{error}</div>}

        {mode === "list" ? (
          <div style={{ padding: 16, flex: 1 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button
                onClick={() => { setShowImport(true); setImportCode(""); setImportPreview(null); setImportError(null); }}
                aria-label="Import template"
                title="Import template"
                style={{ flexShrink: 0, width: 46, padding: "0 10px", borderRadius: 12, border: `1px solid ${T.line}`, background: T.surface, color: T.text, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <IconDownload size={18} />
              </button>
              <button onClick={startBuild} style={{ flex: 1, padding: "14px 0", borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 15, fontWeight: 700 }}>
                + New Template
              </button>
            </div>
            {templates === null && <InlineLoading />}
            {templates !== null && templates.length === 0 && (
              <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 20px", border: `1px dashed ${T.line}`, borderRadius: 12 }}>
                No templates yet. Build one above, it'll be ready to use next time you start a workout.
              </div>
            )}
            {templates?.map((t, i) => (
              <div
                key={t.id}
                ref={(el) => (templateDrag.rowRefs.current[i] = el)}
                style={{ position: "relative", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", opacity: templateDrag.dragIndex === i ? 0.5 : 1 }}
              >
                <InsertionLine drag={templateDrag} i={i} />
                <div
                  onPointerDown={(e) => templateDrag.startRowDrag(i, e)}
                  aria-label="Drag to reorder"
                  title="Drag to reorder"
                  style={{ cursor: "grab", color: T.dim, fontSize: 18, padding: "4px 2px", touchAction: "none", flexShrink: 0 }}
                >⠿</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: T.text }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>{t.exerciseCount} exercise{t.exerciseCount === 1 ? "" : "s"}</div>
                </div>
                <button onClick={() => handleShare(t.id)} aria-label="Share" title="Share" style={{ ...smallBtn, padding: "4px 8px" }}>↗</button>
                <button onClick={() => startEdit(t)} disabled={loadingEditId === t.id} style={{ ...smallBtn, color: T.text }}>
                  {loadingEditId === t.id ? "Loading…" : "Edit"}
                </button>
                <button onClick={() => handleArchive(t.id)} disabled={archivingId === t.id} style={smallBtn}>
                  {archivingId === t.id ? "…" : "Archive"}
                </button>
                <button onClick={() => handleDelete(t.id)} style={{ ...smallBtn, color: T.accent, borderColor: T.accent }}>Delete</button>
              </div>
            ))}

            <button onClick={() => setShowArchived(!showArchived)} style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginTop: 6, marginBottom: showArchived ? 10 : 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>Archived Templates{archivedTemplates && archivedTemplates.length > 0 ? ` (${archivedTemplates.length})` : ""}</div>
              <div style={{ color: T.dim, fontSize: 16 }}>{showArchived ? "▲" : "▼"}</div>
            </button>
            {showArchived && (
              <div>
                {archivedTemplates === null && <InlineLoading padding="16px 0" />}
                {archivedTemplates && archivedTemplates.length === 0 && (
                  <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "16px 0" }}>Nothing archived.</div>
                )}
                {archivedTemplates?.map((t) => (
                  <div key={t.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 8, display: "flex", alignItems: "center", gap: 10, opacity: 0.75 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: T.text }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>{t.exerciseCount} exercise{t.exerciseCount === 1 ? "" : "s"}</div>
                    </div>
                    <button onClick={() => handleUnarchiveTemplate(t.id)} disabled={archivedBusyId === t.id} style={{ ...smallBtn, color: T.green, borderColor: T.green }}>
                      {archivedBusyId === t.id ? "…" : "Unarchive"}
                    </button>
                    <button onClick={() => handleDeleteArchivedTemplate(t.id)} disabled={archivedBusyId === t.id} style={{ ...smallBtn, color: T.accent, borderColor: T.accent }}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Template name</div>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Push Day A"
              style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 14, padding: "10px 12px", outline: "none", boxSizing: "border-box", marginBottom: 16 }}
            />

            {picks.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Exercises ({picks.length})</div>
                <div style={{ marginBottom: 16 }}>
                  {picks.map((p, i) => (
                    <div
                      key={p.id}
                      ref={(el) => (picksDrag.rowRefs.current[i] = el)}
                      style={{ position: "relative", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 10, marginBottom: 6, opacity: picksDrag.dragIndex === i ? 0.5 : 1 }}
                    >
                      <InsertionLine drag={picksDrag} i={i} />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                          <div
                            onPointerDown={(e) => picksDrag.startRowDrag(i, e)}
                            aria-label="Drag to reorder"
                            title="Drag to reorder"
                            style={{ cursor: "grab", color: T.dim, fontSize: 16, padding: "2px", touchAction: "none", flexShrink: 0 }}
                          >⠿</div>
                          <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                        </div>
                        <button onClick={() => setReplacingId(p.id)} aria-label="Replace exercise" title="Replace" style={{ ...smallBtn, marginRight: 6 }}>⇄</button>
                        <button onClick={() => removePick(p.id)} aria-label="Remove" title="Remove" style={{ ...smallBtn, color: T.accent, borderColor: T.accent, fontSize: 15, padding: "3px 10px" }}>−</button>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                        <button onClick={() => adjustPlanned(p.id, Math.max(1, p.planned - 1))} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 14, fontWeight: 700 }}>−</button>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: T.text, minWidth: 16, textAlign: "center" }}>{p.planned}</div>
                        <button onClick={() => adjustPlanned(p.id, Math.min(12, p.planned + 1))} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 14, fontWeight: 700 }}>+</button>
                        <div style={{ fontSize: 11, color: T.dim, marginLeft: 2 }}>sets</div>
                        <div style={{ width: 1, height: 18, background: T.line, margin: "0 4px" }} />
                        <button onClick={() => adjustWarmup(p.id, Math.max(0, (p.plannedWarmup || 0) - 1))} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 14, fontWeight: 700 }}>−</button>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: T.text, minWidth: 16, textAlign: "center" }}>{p.plannedWarmup || 0}</div>
                        <button onClick={() => adjustWarmup(p.id, Math.min(6, (p.plannedWarmup || 0) + 1))} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 14, fontWeight: 700 }}>+</button>
                        <div style={{ fontSize: 11, color: T.dim, marginLeft: 2 }}>warmup</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Coverage</div>
                <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
                  <BodyHeatmap primary={heatPrimary} secondary={heatSecondary} fullBodySets={heatFullBodySets} />
                  <div style={{ fontSize: 11, color: T.dim, textAlign: "center", marginTop: 8 }}>
                    Based on planned sets for these exercises, not actual training volume.
                  </div>
                </div>
              </>
            )}

            <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Add exercises</div>
            {library === null ? (
              <InlineLoading label="Loading exercises…" padding="8px 6px" />
            ) : (
              <div style={{ flex: 1, minHeight: 0, overflow: "hidden", marginBottom: 16, display: "flex", flexDirection: "column" }}>
                <ExercisePicker
                  list={candidates}
                  search={search} onSearchChange={setSearch}
                  muscleFilter={muscleFilter} onToggleMuscle={(m) => setMuscleFilter(muscleFilter.includes(m) ? muscleFilter.filter((x) => x !== m) : [...muscleFilter, m])} onApplySplit={applyPickerSplit}
                  equipFilter={equipFilter} onToggleEquip={(eq) => setEquipFilter(equipFilter.includes(eq) ? equipFilter.filter((x) => x !== eq) : [...equipFilter, eq])}
                  performedFilter={performedFilter} onSetPerformed={setPerformedFilter}
                  sourceFilter={sourceFilter} onSetSource={setSourceFilter}
                  showFilters={showPickerFilters} onToggleFilters={() => setShowPickerFilters(!showPickerFilters)}
                  onPick={addPick}
                  onToggleFavorite={toggleFavorite}
                  footer={createCustomFooter(addPick)}
                  fillHeight
                />
              </div>
            )}

            <button onClick={handleSave} disabled={!name.trim() || picks.length === 0 || saving} style={{
              width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
              background: !name.trim() || picks.length === 0 || saving ? T.surface2 : T.accent,
              color: !name.trim() || picks.length === 0 || saving ? T.dim : "#fff",
              fontSize: 15, fontWeight: 700,
            }}>
              {saving ? "Saving…" : editingId ? "Save Changes" : "Save Template"}
            </button>
          </div>
        )}
      </div>

      {replacingId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.75)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 400, maxHeight: "85vh", display: "flex", flexDirection: "column", background: T.bg, borderTop: `1px solid ${T.line}`, borderRadius: "20px 20px 0 0" }}>
            <div style={{ padding: "16px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.text }}>Replace with</div>
              <button onClick={() => { setReplacingId(null); setReplaceSearch(""); }} aria-label="Close" style={smallBtn}><IconX size={12} /></button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden", padding: "0 16px 16px", display: "flex", flexDirection: "column" }}>
              {library === null ? (
                <InlineLoading label="Loading exercises…" padding="8px 6px" />
              ) : (
                <ExercisePicker
                  list={replaceCandidates}
                  search={replaceSearch} onSearchChange={setReplaceSearch}
                  muscleFilter={muscleFilter} onToggleMuscle={(m) => setMuscleFilter(muscleFilter.includes(m) ? muscleFilter.filter((x) => x !== m) : [...muscleFilter, m])} onApplySplit={applyPickerSplit}
                  equipFilter={equipFilter} onToggleEquip={(eq) => setEquipFilter(equipFilter.includes(eq) ? equipFilter.filter((x) => x !== eq) : [...equipFilter, eq])}
                  performedFilter={performedFilter} onSetPerformed={setPerformedFilter}
                  sourceFilter={sourceFilter} onSetSource={setSourceFilter}
                  showFilters={showPickerFilters} onToggleFilters={() => setShowPickerFilters(!showPickerFilters)}
                  onPick={(l) => replacePick(replacingId, l)}
                  onToggleFavorite={toggleFavorite}
                  footer={createCustomFooter((l) => replacePick(replacingId, l))}
                  fillHeight
                />
              )}
            </div>
          </div>
        </div>
      )}

      {sharingId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.75)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 360, background: T.bg, border: `1px solid ${T.line}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8 }}>Share template</div>
            {shareBusy && <div style={{ color: T.dim, fontSize: 13 }}>Generating code…</div>}
            {!shareBusy && shareCode && (
              <>
                <div style={{ color: T.dim, fontSize: 13, marginBottom: 12 }}>Send this code to anyone — they can paste it into "Import template" to add this to their own account.</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: T.text, letterSpacing: 2, flex: 1 }}>{shareCode}</div>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(shareCode); }}
                    style={{ ...smallBtn, color: T.text }}
                  >
                    Copy
                  </button>
                </div>
              </>
            )}
            <button onClick={() => { setSharingId(null); setShareCode(null); }} style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 14, fontWeight: 600 }}>Done</button>
          </div>
        </div>
      )}

      {showImport && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.75)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 360, background: T.bg, border: `1px solid ${T.line}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8 }}>Import template</div>
            {!importPreview ? (
              <>
                <div style={{ color: T.dim, fontSize: 13, marginBottom: 12 }}>Paste the code someone shared with you.</div>
                <input
                  autoFocus
                  autoComplete="off"
                  value={importCode}
                  onChange={(e) => setImportCode(e.target.value.toUpperCase())}
                  placeholder="e.g. 7F3KQ9M"
                  style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 16, letterSpacing: 2, textAlign: "center", padding: "10px 12px", outline: "none", boxSizing: "border-box", marginBottom: 10 }}
                />
                {importError && <div style={{ color: T.accent, fontSize: 12.5, marginBottom: 10 }}>{importError}</div>}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { setShowImport(false); setImportCode(""); setImportError(null); }} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 14 }}>Cancel</button>
                  <button onClick={handlePreviewImport} disabled={importBusy || !importCode.trim()} style={{ flex: 2, padding: "12px 0", borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 14, fontWeight: 700, opacity: importBusy || !importCode.trim() ? 0.6 : 1 }}>
                    {importBusy ? "Looking up…" : "Look up"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ color: T.text, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{importPreview.name}</div>
                <div style={{ color: T.dim, fontSize: 13, marginBottom: 12 }}>
                  {importPreview.picks.length} exercise{importPreview.picks.length === 1 ? "" : "s"}
                  {importPreview.skippedCount > 0 ? ` · ${importPreview.skippedCount} skipped (not in your library)` : ""}
                </div>
                <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 14 }}>
                  {importPreview.picks.map((p) => (
                    <div key={p.id} style={{ fontSize: 13, color: T.text, padding: "4px 0", borderBottom: `1px solid ${T.line}` }}>{p.name}</div>
                  ))}
                </div>
                {importError && <div style={{ color: T.accent, fontSize: 12.5, marginBottom: 10 }}>{importError}</div>}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setImportPreview(null)} disabled={importBusy} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 14 }}>Back</button>
                  <button onClick={handleConfirmImport} disabled={importBusy} style={{ flex: 2, padding: "12px 0", borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 14, fontWeight: 700, opacity: importBusy ? 0.6 : 1 }}>
                    {importBusy ? "Adding…" : "Add to my templates"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {showCreateCustom && (
        <CustomExerciseModal
          onClose={() => setShowCreateCustom(false)}
          onCreate={handleCreateCustomExercise}
          initialName={search || replaceSearch}
        />
      )}
    </div>
  );
}
