import { useState, useEffect, useRef, useMemo } from "react";
import { T } from "./lib/theme";
import { fetchExercises, fetchTemplates, saveWorkoutAsTemplate, deleteTemplate, duplicateTemplate, fetchPerformedExerciseIds, fetchExerciseUsage, withPickerUsage, fetchFavoriteExerciseIds, setFavoriteExercise, fetchTemplateForEdit, updateTemplate, reorderTemplates, setTemplateArchived, fetchArchivedTemplates, exportTemplate, fetchSharedTemplate, importSharedTemplate, createCustomExercise, uploadExerciseMedia, normalizeExercise } from "./lib/queries";
import { computeMuscleSetCounts } from "./lib/volume";
import { subscribeTaxonomy, getTaxonomyVersion, genericBucket, MUSCLE_COLORS, isFullBody, CATEGORY_KEYS } from "./lib/muscleTaxonomy";
import { subscribeBodyMapRegions, getBodyMapRegionVersion } from "./lib/bodyMapRegions";
import { getPrefs } from "./lib/prefs";
import { IDEOLOGIES } from "./lib/ideologies";
import { summarizeScheme, resizeScheme } from "./lib/repScheme";
import BodyHeatmap from "./BodyHeatmap";
import RepSchemeEditor from "./RepSchemeEditor";
import { InlineLoading } from "./LoadingSpinner";
import { IconX, IconDownload, IconDragHandle, IconChevronUp, IconChevronDown, IconMoreHorizontal, IconSuperset, IconTrash, IconRefresh, IconPlus, IconUndo } from "./Icons";
import ExercisePicker, { splitGroupFor, filterLibrary } from "./ExercisePicker";
import CustomExerciseModal from "./CustomExerciseModal";
import { useDragReorder, InsertionLine } from "./DragReorder";

// ============================================================================
// Templates: list + builder.
//
// The builder is one scrolling column (name in the header, exercise cards,
// a pinned "Add exercises" bar) instead of the old split screen, where the
// exercise list was capped at 42% of the height above an always-open
// picker. Adding is multi-select in a full-screen sheet. Each card expands
// in place for sets, warmups, per-set rep targets, supersets, replace and
// remove, so nothing needs its own screen.
// ============================================================================

const display = "'Barlow Condensed', sans-serif";
const iconBtn = { width: 36, height: 36, borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface, color: T.dim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0 };
const ellipsis = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 };

const newPick = (ex) => ({ id: ex.id, name: ex.name, short: ex.short, muscle: ex.muscle, primaryMuscles: ex.primaryMuscles, secondaryMuscles: ex.secondaryMuscles, rawPrimaryMuscles: ex.rawPrimaryMuscles, rawSecondaryMuscles: ex.rawSecondaryMuscles, planned: 3, plannedWarmup: 0, supersetGroup: null, repScheme: null });

function Stepper({ label, value, min, max, onChange }) {
  const btn = (disabled) => ({ width: 34, height: 34, borderRadius: 9, border: `1px solid ${T.line}`, background: T.surface2, color: disabled ? "#3A404B" : T.text, fontSize: 17, fontWeight: 700, padding: 0 });
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, color: T.dim, marginBottom: 5, ...ellipsis }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)} style={btn(value <= min)}>−</button>
        <div style={{ fontFamily: display, fontSize: 22, fontWeight: 700, color: T.text, minWidth: 20, textAlign: "center" }}>{value}</div>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)} style={btn(value >= max)}>+</button>
      </div>
    </div>
  );
}

// Planned-set coverage by Category, for the summary chips.
function categorySets(picks) {
  const out = {};
  for (const p of picks) {
    const cat = isFullBody(p.muscle) ? "Full Body" : genericBucket(p.muscle) || p.muscle;
    out[cat] = (out[cat] || 0) + p.planned;
  }
  return Object.entries(out).sort((a, b) => b[1] - a[1] || CATEGORY_KEYS.indexOf(a[0]) - CATEGORY_KEYS.indexOf(b[0]));
}

function suggestName(picks) {
  const cats = categorySets(picks).filter(([c]) => c !== "Full Body").map(([c]) => c);
  if (cats.length === 0) return picks.length ? "Full Body" : "New workout";
  if (cats.length >= 4) return "Full Body";
  return cats.slice(0, 2).join(" + ");
}

// Rough session length: each working set is its rest plus ~45s of work,
// each warmup its warmup rest plus ~30s.
function estimateMinutes(picks) {
  const prefs = getPrefs();
  const rest = prefs.restSeconds || 90;
  const wRest = prefs.warmupRestEnabled === false ? 0 : prefs.warmupRestSeconds || 60;
  const sec = picks.reduce((t, p) => t + p.planned * (rest + 45) + (p.plannedWarmup || 0) * (wRest + 30), 0);
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
}

// Bottom sheet frame used by the add/replace picker, action menus, and
// dialogs. Pads for the home indicator.
function Sheet({ children, onClose, full }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.78)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 420, background: T.bg, borderTop: `1px solid ${T.line}`, borderRadius: "18px 18px 0 0",
          display: "flex", flexDirection: "column", boxSizing: "border-box",
          height: full ? "calc(100dvh - 24px - env(safe-area-inset-top, 0px))" : "auto", maxHeight: "calc(100dvh - 24px - env(safe-area-inset-top, 0px))",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function Templates({ user, onClose, initialPicks }) {
  // Re-render when the taxonomy / body-map region caches land (they're
  // module state, see muscleTaxonomy.js and bodyMapRegions.js).
  const [, setTaxonomyVersion] = useState(getTaxonomyVersion);
  useEffect(() => subscribeTaxonomy(() => setTaxonomyVersion(getTaxonomyVersion())), []);
  const [, setBodyMapRegionVersion] = useState(getBodyMapRegionVersion);
  useEffect(() => subscribeBodyMapRegions(() => setBodyMapRegionVersion(getBodyMapRegionVersion())), []);

  const [library, setLibrary] = useState(null);
  const [templates, setTemplates] = useState(null);
  const [archivedTemplates, setArchivedTemplates] = useState(null);
  const [mode, setMode] = useState("list"); // "list" | "build"
  const [error, setError] = useState(null);

  // ---- builder state
  const [name, setName] = useState("");
  const [picks, setPicks] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showCoverage, setShowCoverage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [undo, setUndo] = useState(null); // { pick, index } after a remove
  const undoTimer = useRef(null);
  const snapshot = useRef("");

  // ---- picker state (shared by add + replace)
  const [picker, setPicker] = useState(null); // null | { kind: "add" } | { kind: "replace", pickId }
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]); // library items, in tap order
  const [muscleFilter, setMuscleFilter] = useState([]);
  const [equipFilter, setEquipFilter] = useState([]);
  const [performedFilter, setPerformedFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [showPickerFilters, setShowPickerFilters] = useState(false);
  const [showCreateCustom, setShowCreateCustom] = useState(false);
  const pendingCustomPick = useRef(null);

  // ---- list state
  const [menuFor, setMenuFor] = useState(null); // template row whose action sheet is open
  const [confirmDeleteFor, setConfirmDeleteFor] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [loadingEditId, setLoadingEditId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [shareState, setShareState] = useState(null); // null | { busy } | { code }
  const [showImport, setShowImport] = useState(false);
  const [importCode, setImportCode] = useState("");
  const [importPreview, setImportPreview] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState(null);

  const focus = IDEOLOGIES[getPrefs().trainingIdeology] ? getPrefs().trainingIdeology : "Hypertrophy";
  const focusRange = { low: IDEOLOGIES[focus].low, high: IDEOLOGIES[focus].high };

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
        const [lib, t, usage, favIds, archived] = await Promise.all([fetchExercises(), fetchTemplates(user.id), fetchExerciseUsage(user.id), fetchFavoriteExerciseIds(user.id), fetchArchivedTemplates(user.id)]);
        if (cancelled) return;
        setLibrary(withPickerUsage(lib, usage, favIds));
        setTemplates(t);
        setArchivedTemplates(archived);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [user.id]);

  // Seeded from "Create a template from these exercises" elsewhere.
  useEffect(() => {
    if (initialPicks && initialPicks.length > 0) openBuilder({ name: "", picks: initialPicks.map(newPick) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  // ---------------------------------------------------------------- builder

  function openBuilder({ id = null, name: n = "", picks: p = [] }) {
    setEditingId(id);
    setName(n);
    setPicks(p);
    setExpandedId(null);
    setShowCoverage(false);
    setUndo(null);
    snapshot.current = JSON.stringify({ n, p });
    setMode("build");
    if (p.length === 0) openPicker({ kind: "add" });
  }

  const dirty = mode === "build" && JSON.stringify({ n: name, p: picks }) !== snapshot.current;

  function leaveBuilder(force = false) {
    if (dirty && !force) { setConfirmDiscard(true); return; }
    setConfirmDiscard(false);
    setMode("list");
    setEditingId(null);
    if (initialPicks && initialPicks.length > 0) onClose();
  }

  async function startEdit(t) {
    setMenuFor(null);
    setLoadingEditId(t.id);
    try {
      const full = await fetchTemplateForEdit(t.id);
      openBuilder({ id: full.id, name: full.name, picks: full.picks.map((p) => ({ supersetGroup: null, repScheme: null, ...p })) });
    } catch (err) {
      setError(err.message);
    }
    setLoadingEditId(null);
  }

  function updatePick(id, patch) {
    setPicks((prev) => prev.map((p) => {
      if (p.id !== id) return p;
      const next = { ...p, ...patch };
      if (patch.planned != null && next.repScheme) next.repScheme = resizeScheme(next.repScheme, patch.planned, focusRange);
      return next;
    }));
  }

  function removePick(id) {
    const index = picks.findIndex((p) => p.id === id);
    if (index < 0) return;
    const pick = picks[index];
    setPicks(dissolveLoneSupersets(picks.filter((p) => p.id !== id)));
    setExpandedId(null);
    clearTimeout(undoTimer.current);
    setUndo({ pick, index });
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  }

  function undoRemove() {
    if (!undo) return;
    setPicks((prev) => {
      const next = [...prev];
      next.splice(Math.min(undo.index, next.length), 0, undo.pick);
      return next;
    });
    clearTimeout(undoTimer.current);
    setUndo(null);
  }

  // A superset of one isn't a superset.
  function dissolveLoneSupersets(list) {
    const counts = {};
    for (const p of list) if (p.supersetGroup != null) counts[p.supersetGroup] = (counts[p.supersetGroup] || 0) + 1;
    return list.map((p) => (p.supersetGroup != null && counts[p.supersetGroup] < 2 ? { ...p, supersetGroup: null } : p));
  }

  // Links a card with the one below it (joining its group if it has one).
  function toggleSupersetWithNext(i) {
    const a = picks[i], b = picks[i + 1];
    if (!b) return;
    if (a.supersetGroup != null && a.supersetGroup === b.supersetGroup) {
      // unlink: split the group at this boundary
      const g = a.supersetGroup;
      const nextGroup = Math.max(0, ...picks.map((p) => p.supersetGroup || 0)) + 1;
      const next = picks.map((p, k) => (k > i && p.supersetGroup === g ? { ...p, supersetGroup: nextGroup } : p));
      setPicks(dissolveLoneSupersets(next));
      return;
    }
    const group = a.supersetGroup ?? b.supersetGroup ?? Math.max(0, ...picks.map((p) => p.supersetGroup || 0)) + 1;
    const old = b.supersetGroup;
    setPicks(dissolveLoneSupersets(picks.map((p, k) => (k === i || k === i + 1 || (old != null && p.supersetGroup === old) ? { ...p, supersetGroup: group } : p))));
  }

  async function handleSave() {
    if (picks.length === 0 || saving) return;
    const finalName = name.trim() || suggestName(picks);
    setSaving(true);
    try {
      if (editingId) await updateTemplate(editingId, finalName, picks);
      else await saveWorkoutAsTemplate(user.id, finalName, picks, false);
      setTemplates(await fetchTemplates(user.id));
      snapshot.current = JSON.stringify({ n: name, p: picks });
      setMode("list");
      setEditingId(null);
      if (initialPicks && initialPicks.length > 0) onClose();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  // ---------------------------------------------------------------- picker

  function openPicker(next) {
    setPicker(next);
    setSearch("");
    setSelected([]);
    setShowPickerFilters(false);
  }

  function toggleFavorite(id) {
    setLibrary((prev) => prev.map((l) => (l.id === id ? { ...l, isFavorite: !l.isFavorite } : l)));
    const target = library.find((l) => l.id === id);
    setFavoriteExercise(user.id, id, !(target && target.isFavorite)).catch((err) => setError(err.message));
  }

  function applyPickerSplit(splitName) {
    const group = splitGroupFor(splitName, getPrefs().muscleNameMode);
    const isActive = group.length > 0 && group.length === muscleFilter.length && group.every((m) => muscleFilter.includes(m));
    setMuscleFilter(isActive ? [] : group);
  }

  function toggleSelected(l) {
    setSelected((prev) => (prev.some((x) => x.id === l.id) ? prev.filter((x) => x.id !== l.id) : [...prev, l]));
  }

  function confirmAdd(extra = []) {
    const toAdd = [...selected, ...extra].filter((l) => !picks.some((p) => p.id === l.id));
    if (toAdd.length) {
      setPicks((prev) => [...prev, ...toAdd.map(newPick)]);
      if (toAdd.length === 1) setExpandedId(toAdd[0].id);
    }
    setPicker(null);
  }

  function replaceWith(pickId, ex) {
    if (picks.some((p) => p.id === ex.id)) return;
    setPicks((prev) => prev.map((p) => (p.id === pickId ? { ...newPick(ex), planned: p.planned, plannedWarmup: p.plannedWarmup, supersetGroup: p.supersetGroup, repScheme: p.repScheme } : p)));
    setExpandedId(ex.id);
    setPicker(null);
  }

  async function handleCreateCustomExercise({ name: exName, muscle, primaryMuscles, secondaryMuscles, equipment, photoFile }) {
    const mediaUrl = photoFile ? await uploadExerciseMedia(user.id, photoFile) : null;
    const row = await createCustomExercise(user.id, { name: exName, muscle, primaryMuscles, secondaryMuscles, equipment, mediaUrl });
    const normalized = normalizeExercise(row);
    setLibrary((prev) => [...(prev || []), { ...normalized, sessions: 0, isFavorite: false }]);
    if (pendingCustomPick.current) pendingCustomPick.current(normalized);
    setShowCreateCustom(false);
  }

  // ---------------------------------------------------------------- list actions

  async function run(id, fn) {
    setBusyId(id);
    try { await fn(); } catch (err) { setError(err.message); }
    setBusyId(null);
  }

  const handleDuplicate = (t) => run(t.id, async () => {
    setMenuFor(null);
    await duplicateTemplate(user.id, t.id);
    setTemplates(await fetchTemplates(user.id));
  });
  const handleArchive = (t) => run(t.id, async () => {
    setMenuFor(null);
    await setTemplateArchived(t.id, true);
    setTemplates((prev) => prev.filter((x) => x.id !== t.id));
    setArchivedTemplates((prev) => [...(prev || []), t]);
  });
  const handleUnarchive = (t) => run(t.id, async () => {
    await setTemplateArchived(t.id, false);
    setArchivedTemplates((prev) => prev.filter((x) => x.id !== t.id));
    setTemplates((prev) => [...prev, t]);
  });
  const handleDelete = (t) => run(t.id, async () => {
    setConfirmDeleteFor(null);
    setMenuFor(null);
    await deleteTemplate(t.id);
    setTemplates((prev) => prev.filter((x) => x.id !== t.id));
    setArchivedTemplates((prev) => (prev || []).filter((x) => x.id !== t.id));
  });
  async function handleShare(t) {
    setMenuFor(null);
    setShareState({ busy: true, name: t.name });
    try {
      setShareState({ code: await exportTemplate(user.id, t.id), name: t.name });
    } catch (err) {
      setError(err.message);
      setShareState(null);
    }
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
      setTemplates(await fetchTemplates(user.id));
      setShowImport(false);
      setImportCode("");
      setImportPreview(null);
    } catch (err) {
      setImportError(err.message);
    }
    setImportBusy(false);
  }

  // ---------------------------------------------------------------- derived

  const muscleNameMode = getPrefs().muscleNameMode;
  // Coverage counts from the exercise's actual tagged muscles, not the
  // Category-collapsed primaryMuscles: collapsed "Arms" resolves to the
  // Biceps region, so every triceps exercise used to show as biceps in
  // Region/Anatomy mode.
  const heatmapEntries = useMemo(() => picks.map((p) => ({ muscle: p.muscle, primaryMuscles: p.rawPrimaryMuscles || p.primaryMuscles, secondaryMuscles: p.rawSecondaryMuscles || p.secondaryMuscles, sets: Array(p.planned).fill({ weight: 1, reps: 1 }) })), [picks]);
  const heat = computeMuscleSetCounts(heatmapEntries, muscleNameMode);
  const totalSets = picks.reduce((t, p) => t + p.planned, 0);
  const cats = categorySets(picks);
  const pickedNames = new Set(picks.map((p) => p.name));
  const replacing = picker?.kind === "replace" ? picks.find((p) => p.id === picker.pickId) : null;
  const candidates = library && picker
    ? filterLibrary(library, { search, muscleFilter, equipFilter, performedFilter, sourceFilter, exclude: pickedNames })
    : [];
  const selectedIds = new Set(selected.map((l) => l.id));

  // ---------------------------------------------------------------- render

  const header = (
    <div style={{ padding: "calc(12px + env(safe-area-inset-top, 0px)) 14px 12px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
      <button onClick={mode === "list" ? onClose : () => leaveBuilder()} aria-label={mode === "list" ? "Close" : "Back"} style={iconBtn}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>‹</span>
      </button>
      {mode === "list" ? (
        <>
          <div style={{ flex: 1, fontFamily: display, fontSize: 24, fontWeight: 700, color: T.text, ...ellipsis }}>Templates</div>
          <button
            onClick={() => { setShowImport(true); setImportCode(""); setImportPreview(null); setImportError(null); }}
            aria-label="Import template" title="Import template" style={iconBtn}
          >
            <IconDownload size={17} />
          </button>
        </>
      ) : (
        <>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={suggestName(picks)}
            aria-label="Template name"
            enterKeyHint="done"
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", borderBottom: `1px dashed ${T.line}`, color: T.text, fontFamily: display, fontSize: 22, fontWeight: 700, padding: "4px 0", outline: "none", borderRadius: 0 }}
          />
          <button
            onClick={handleSave}
            disabled={picks.length === 0 || saving}
            style={{ flexShrink: 0, height: 36, padding: "0 16px", borderRadius: 10, border: "none", background: picks.length === 0 ? T.surface2 : T.accent, color: picks.length === 0 ? T.dim : "#fff", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      )}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 30, display: "flex", justifyContent: "center", overflow: "hidden" }}>
      <style>{`button { cursor: pointer; }`}</style>
      <div style={{ width: "100%", maxWidth: 420, height: "100dvh", display: "flex", flexDirection: "column" }}>
        {header}

        {error && (
          <div onClick={() => setError(null)} style={{ margin: "12px 16px 0", padding: 10, borderRadius: 8, background: T.surface2, border: `1px solid ${T.accent}`, color: T.accent, fontSize: 13 }}>
            {error} <span style={{ color: T.dim }}>(tap to dismiss)</span>
          </div>
        )}

        {mode === "list" ? (
          <div style={{ padding: 16, flex: 1, minHeight: 0, overflowY: "auto", paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
            <button onClick={() => openBuilder({})} style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 15, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <IconPlus size={16} /> New template
            </button>
            {templates === null && <InlineLoading />}
            {templates !== null && templates.length === 0 && (
              <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 20px", border: `1px dashed ${T.line}`, borderRadius: 12, lineHeight: 1.5 }}>
                No templates yet. Build one and it'll be one tap away next time you start a workout.
              </div>
            )}
            {templates?.map((t, i) => (
              <div
                key={t.id}
                ref={(el) => (templateDrag.rowRefs.current[i] = el)}
                style={{ position: "relative", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, marginBottom: 8, display: "flex", alignItems: "center", opacity: templateDrag.dragIndex === i || busyId === t.id ? 0.5 : 1 }}
              >
                <InsertionLine drag={templateDrag} i={i} />
                <div
                  onPointerDown={(e) => templateDrag.startRowDrag(i, e)}
                  aria-label="Drag to reorder"
                  style={{ cursor: "grab", color: T.dim, padding: "16px 6px 16px 12px", touchAction: "none", display: "flex" }}
                ><IconDragHandle size={16} /></div>
                <button onClick={() => startEdit(t)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: "12px 4px" }}>
                  <div style={{ fontFamily: display, fontSize: 19, fontWeight: 700, color: T.text, ...ellipsis }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: T.dim, marginTop: 1 }}>
                    {loadingEditId === t.id ? "Opening…" : `${t.exerciseCount} exercise${t.exerciseCount === 1 ? "" : "s"}`}
                  </div>
                </button>
                <button onClick={() => setMenuFor(t)} aria-label={`More actions for ${t.name}`} style={{ ...iconBtn, border: "none", background: "none", marginRight: 6 }}>
                  <IconMoreHorizontal size={18} />
                </button>
              </div>
            ))}

            <button onClick={() => setShowArchived(!showArchived)} style={{ width: "100%", background: "none", border: "none", padding: "14px 4px", marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center", color: T.dim }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Archived{archivedTemplates && archivedTemplates.length > 0 ? ` (${archivedTemplates.length})` : ""}</span>
              {showArchived ? <IconChevronUp size={13} /> : <IconChevronDown size={13} />}
            </button>
            {showArchived && (
              <div>
                {archivedTemplates === null && <InlineLoading padding="16px 0" />}
                {archivedTemplates && archivedTemplates.length === 0 && <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "12px 0" }}>Nothing archived.</div>}
                {archivedTemplates?.map((t) => (
                  <div key={t.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 8, opacity: busyId === t.id ? 0.5 : 0.8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: display, fontSize: 17, fontWeight: 700, color: T.text, ...ellipsis }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: T.dim }}>{t.exerciseCount} exercise{t.exerciseCount === 1 ? "" : "s"}</div>
                    </div>
                    <button onClick={() => handleUnarchive(t)} disabled={busyId === t.id} style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${T.green}`, background: "none", color: T.green, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>Restore</button>
                    <button onClick={() => setConfirmDeleteFor(t)} aria-label={`Delete ${t.name}`} style={{ ...iconBtn, color: T.accent }}><IconTrash size={15} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <div style={{ padding: "10px 16px", borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: T.dim, ...ellipsis }}>
                  {picks.length === 0 ? "No exercises yet" : `${picks.length} exercise${picks.length === 1 ? "" : "s"} · ${totalSets} sets · ~${estimateMinutes(picks)} min`}
                </div>
                {picks.length > 0 && (
                  <button onClick={() => setShowCoverage(!showCoverage)} style={{ flexShrink: 0, background: "none", border: "none", color: showCoverage ? T.text : T.dim, fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 4, padding: 0, whiteSpace: "nowrap" }}>
                    Coverage {showCoverage ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
                  </button>
                )}
              </div>
              {cats.length > 0 && (
                <div className="no-scrollbar" style={{ display: "flex", gap: 6, marginTop: 8, overflowX: "auto" }}>
                  {cats.map(([c, n]) => (
                    <span key={c} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.text, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap" }}>
                      <span style={{ width: 7, height: 7, borderRadius: 4, background: MUSCLE_COLORS[c] || T.dim }} />
                      {c} <span style={{ color: T.dim }}>{n}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 16px 16px" }}>
              {showCoverage && picks.length > 0 && (
                <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                  <BodyHeatmap primary={heat.primary} secondary={heat.secondary} fullBodySets={heat.fullBodySets} entries={heatmapEntries} />
                  <div style={{ fontSize: 11, color: T.dim, textAlign: "center", marginTop: 8 }}>Planned sets, not logged volume.</div>
                </div>
              )}

              {picks.length === 0 && (
                <button onClick={() => openPicker({ kind: "add" })} style={{ width: "100%", padding: "36px 20px", borderRadius: 14, border: `1.5px dashed ${T.line}`, background: "none", color: T.dim, fontSize: 14, lineHeight: 1.5 }}>
                  <div style={{ color: T.text, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Add your first exercises</div>
                  Pick as many as you want at once, then fine-tune sets and reps here.
                </button>
              )}

              {picks.map((p, i) => {
                const open = expandedId === p.id;
                const inSS = p.supersetGroup != null;
                const linkedToNext = inSS && picks[i + 1]?.supersetGroup === p.supersetGroup;
                const linkedToPrev = inSS && picks[i - 1]?.supersetGroup === p.supersetGroup;
                return (
                  <div key={p.id} style={{ position: "relative", marginBottom: linkedToNext ? 2 : 8 }}>
                    <div
                      ref={(el) => (picksDrag.rowRefs.current[i] = el)}
                      style={{
                        position: "relative", background: T.surface, border: `1px solid ${open ? "#3A404B" : T.line}`,
                        borderLeft: inSS ? `3px solid ${T.accent}` : `1px solid ${open ? "#3A404B" : T.line}`,
                        borderRadius: linkedToPrev && linkedToNext ? 4 : linkedToPrev ? "4px 4px 12px 12px" : linkedToNext ? "12px 12px 4px 4px" : 12,
                        opacity: picksDrag.dragIndex === i ? 0.5 : 1,
                      }}
                    >
                      <InsertionLine drag={picksDrag} i={i} />
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <div
                          onPointerDown={(e) => picksDrag.startRowDrag(i, e)}
                          aria-label="Drag to reorder"
                          style={{ cursor: "grab", color: T.dim, padding: "16px 6px 16px 10px", touchAction: "none", display: "flex", flexShrink: 0 }}
                        ><IconDragHandle size={15} /></div>
                        <button onClick={() => setExpandedId(open ? null : p.id)} aria-expanded={open} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, textAlign: "left", background: "none", border: "none", padding: "11px 12px 11px 4px" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: T.text, fontSize: 15, fontWeight: 600, ...ellipsis }}>{p.name}</div>
                            <div style={{ fontSize: 12, color: p.repScheme ? T.text : T.dim, marginTop: 2, ...ellipsis }}>
                              {summarizeScheme(p.repScheme, p.planned, focusRange)}
                              <span style={{ color: T.dim }}>{p.plannedWarmup ? ` · ${p.plannedWarmup} warmup` : ""}{inSS ? " · Superset" : ""}</span>
                            </div>
                          </div>
                          <span style={{ color: T.dim, flexShrink: 0, display: "flex" }}>{open ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}</span>
                        </button>
                      </div>

                      {open && (
                        <div style={{ padding: "4px 14px 14px", borderTop: `1px solid ${T.line}` }}>
                          <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                            <Stepper label="Working sets" value={p.planned} min={1} max={12} onChange={(n) => updatePick(p.id, { planned: n })} />
                            <Stepper label="Warmup sets" value={p.plannedWarmup || 0} min={0} max={6} onChange={(n) => updatePick(p.id, { plannedWarmup: n })} />
                          </div>
                          <div style={{ fontSize: 11, color: T.dim, margin: "14px 0 6px" }}>Rep targets</div>
                          <RepSchemeEditor
                            planned={p.planned}
                            scheme={p.repScheme}
                            fallback={focusRange}
                            focusLabel={focus}
                            onChange={(scheme) => updatePick(p.id, { repScheme: scheme })}
                          />
                          <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                            <button onClick={() => openPicker({ kind: "replace", pickId: p.id })} style={cardAction()}>
                              <IconRefresh size={13} /> Replace
                            </button>
                            {i < picks.length - 1 && (
                              <button onClick={() => toggleSupersetWithNext(i)} style={cardAction(linkedToNext)}>
                                <IconSuperset size={13} /> {linkedToNext ? "Unlink next" : "Superset next"}
                              </button>
                            )}
                            <button onClick={() => removePick(p.id)} aria-label={`Remove ${p.name}`} style={{ ...cardAction(), flex: "0 0 auto", color: T.accent, borderColor: "rgba(232,68,46,0.45)" }}>
                              <IconTrash size={13} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pinned add bar */}
            {picks.length > 0 && (
              <div style={{ flexShrink: 0, padding: "10px 16px calc(10px + env(safe-area-inset-bottom, 0px))", borderTop: `1px solid ${T.line}`, background: T.bg, position: "relative" }}>
                {undo && (
                  <div style={{ position: "absolute", left: 16, right: 16, bottom: "calc(100% + 8px)", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: "9px 12px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 6px 20px rgba(0,0,0,0.45)" }}>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: T.text, ...ellipsis }}>Removed {undo.pick.name}</div>
                    <button onClick={undoRemove} style={{ background: "none", border: "none", color: T.accent, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 5, padding: 0 }}>
                      <IconUndo size={13} /> Undo
                    </button>
                  </div>
                )}
                <button onClick={() => openPicker({ kind: "add" })} style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: `1px solid ${T.line}`, background: T.surface, color: T.text, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <IconPlus size={15} /> Add exercises
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add / replace picker */}
      {picker && (
        <Sheet full onClose={() => setPicker(null)}>
          <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0, fontFamily: display, fontSize: 21, fontWeight: 700, color: T.text, ...ellipsis }}>
              {replacing ? `Replace ${replacing.name}` : "Add exercises"}
            </div>
            <button onClick={() => setPicker(null)} aria-label="Close" style={iconBtn}><IconX size={13} /></button>
          </div>
          <div style={{ flex: 1, minHeight: 0, padding: "0 16px", display: "flex", flexDirection: "column" }}>
            {library === null ? (
              <InlineLoading label="Loading exercises…" padding="8px 6px" />
            ) : (
              <ExercisePicker
                list={candidates}
                search={search} onSearchChange={setSearch}
                muscleFilter={muscleFilter} onToggleMuscle={(m) => setMuscleFilter(muscleFilter.includes(m) ? muscleFilter.filter((x) => x !== m) : [...muscleFilter, m])} onApplySplit={applyPickerSplit}
                equipFilter={equipFilter} onToggleEquip={(eq) => setEquipFilter(equipFilter.includes(eq) ? equipFilter.filter((x) => x !== eq) : [...equipFilter, eq])}
                performedFilter={performedFilter} onSetPerformed={setPerformedFilter}
                sourceFilter={sourceFilter} onSetSource={setSourceFilter}
                showFilters={showPickerFilters} onToggleFilters={() => setShowPickerFilters(!showPickerFilters)}
                onPick={(l) => (replacing ? replaceWith(replacing.id, l) : toggleSelected(l))}
                multiSelect={!replacing}
                replaceFor={replacing ? (library || []).find((l) => l.id === replacing.id) || null : null}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelected}
                onToggleFavorite={toggleFavorite}
                onCreateCustom={() => { pendingCustomPick.current = (ex) => (replacing ? replaceWith(replacing.id, ex) : setSelected((prev) => [...prev, ex])); setShowCreateCustom(true); }}
                fillHeight
              />
            )}
          </div>
          {!replacing && (
            <div style={{ padding: "10px 16px 12px", borderTop: `1px solid ${T.line}`, flexShrink: 0 }}>
              <button
                onClick={() => confirmAdd()}
                disabled={selected.length === 0}
                style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: selected.length ? T.accent : T.surface2, color: selected.length ? "#fff" : T.dim, fontSize: 15, fontWeight: 700 }}
              >
                {selected.length === 0 ? "Select exercises" : `Add ${selected.length} exercise${selected.length === 1 ? "" : "s"}`}
              </button>
            </div>
          )}
        </Sheet>
      )}

      {/* Template row actions */}
      {menuFor && (
        <Sheet onClose={() => setMenuFor(null)}>
          <div style={{ padding: "16px 16px 6px", fontFamily: display, fontSize: 20, fontWeight: 700, color: T.text, ...ellipsis }}>{menuFor.name}</div>
          <div style={{ padding: "4px 8px 12px" }}>
            {[
              ["Edit", () => startEdit(menuFor)],
              ["Duplicate", () => handleDuplicate(menuFor)],
              ["Share code", () => handleShare(menuFor)],
              ["Archive", () => handleArchive(menuFor)],
            ].map(([label, fn]) => (
              <button key={label} onClick={fn} style={menuRow()}>{label}</button>
            ))}
            <button onClick={() => { setConfirmDeleteFor(menuFor); setMenuFor(null); }} style={{ ...menuRow(), color: T.accent }}>Delete</button>
          </div>
        </Sheet>
      )}

      {confirmDeleteFor && (
        <Dialog title={`Delete ${confirmDeleteFor.name}?`} body="This removes the template for good. Workouts you've already logged from it aren't affected. Archive it instead if you might want it back." onCancel={() => setConfirmDeleteFor(null)} confirmLabel="Delete" danger busy={busyId === confirmDeleteFor.id} onConfirm={() => handleDelete(confirmDeleteFor)} />
      )}

      {confirmDiscard && (
        <Dialog title="Discard changes?" body="Your edits to this template haven't been saved." onCancel={() => setConfirmDiscard(false)} confirmLabel="Discard" danger onConfirm={() => leaveBuilder(true)} />
      )}

      {shareState && (
        <Dialog
          title={`Share ${shareState.name}`}
          body={shareState.busy ? "Generating code…" : "Anyone can paste this code into Import to add a copy to their account. Later edits to yours won't change their copy."}
          onCancel={() => setShareState(null)}
          cancelLabel="Done"
        >
          {shareState.code && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ fontFamily: display, fontSize: 26, fontWeight: 700, color: T.text, letterSpacing: 3, flex: 1 }}>{shareState.code}</div>
              <button onClick={() => navigator.clipboard?.writeText(shareState.code)} style={{ background: "none", border: `1px solid ${T.line}`, color: T.text, borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>Copy</button>
            </div>
          )}
        </Dialog>
      )}

      {showImport && (
        <Dialog
          title={importPreview ? importPreview.name : "Import template"}
          body={importPreview
            ? `${importPreview.picks.length} exercise${importPreview.picks.length === 1 ? "" : "s"}${importPreview.skippedCount > 0 ? `, ${importPreview.skippedCount} skipped (not in your library)` : ""}`
            : "Paste the code someone shared with you."}
          onCancel={() => { if (importPreview) setImportPreview(null); else { setShowImport(false); setImportError(null); } }}
          cancelLabel={importPreview ? "Back" : "Cancel"}
          confirmLabel={importPreview ? (importBusy ? "Adding…" : "Add to my templates") : (importBusy ? "Looking up…" : "Look up")}
          confirmDisabled={importBusy || (!importPreview && !importCode.trim())}
          onConfirm={importPreview ? handleConfirmImport : handlePreviewImport}
        >
          {!importPreview ? (
            <input
              autoComplete="off"
              autoCapitalize="characters"
              value={importCode}
              onChange={(e) => setImportCode(e.target.value.toUpperCase())}
              placeholder="e.g. 7F3KQ9M"
              style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 18, letterSpacing: 2, textAlign: "center", padding: "10px 12px", outline: "none", boxSizing: "border-box", marginBottom: 12 }}
            />
          ) : (
            <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 12 }}>
              {importPreview.picks.map((p) => (
                <div key={p.id} style={{ fontSize: 13, color: T.text, padding: "5px 0", borderBottom: `1px solid ${T.line}`, ...ellipsis }}>{p.name}</div>
              ))}
            </div>
          )}
          {importError && <div style={{ color: T.accent, fontSize: 12.5, marginBottom: 10 }}>{importError}</div>}
        </Dialog>
      )}

      {showCreateCustom && (
        <CustomExerciseModal onClose={() => setShowCreateCustom(false)} onCreate={handleCreateCustomExercise} initialName={search} library={library || []} onUseExisting={(ex) => { if (pendingCustomPick.current) pendingCustomPick.current(ex); }} />
      )}
    </div>
  );
}

function cardAction(active) {
  return {
    flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "9px 10px", borderRadius: 9, border: `1px solid ${active ? T.accent : T.line}`,
    background: active ? "rgba(232,68,46,0.1)" : T.surface2, color: T.text, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
  };
}

function menuRow() {
  return { display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderRadius: 10, padding: "13px 10px", color: T.text, fontSize: 15, fontWeight: 600 };
}

function Dialog({ title, body, children, onCancel, onConfirm, cancelLabel = "Cancel", confirmLabel, confirmDisabled, danger, busy }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.78)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 360, background: T.bg, border: `1px solid ${T.line}`, borderRadius: 16, padding: 20, boxSizing: "border-box" }}>
        <div style={{ fontFamily: display, fontSize: 21, fontWeight: 700, color: T.text, marginBottom: 6, overflowWrap: "anywhere" }}>{title}</div>
        {body && <div style={{ color: T.dim, fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>{body}</div>}
        {children}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 14, fontWeight: 600 }}>{cancelLabel}</button>
          {onConfirm && (
            <button onClick={onConfirm} disabled={confirmDisabled || busy} style={{ flex: 1.4, padding: "12px 0", borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 14, fontWeight: 700, opacity: confirmDisabled || busy ? 0.55 : 1 }}>
              {busy ? "…" : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
