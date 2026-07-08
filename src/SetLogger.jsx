import { useState, useEffect, useRef } from "react";
import BodyHeatmap from "./BodyHeatmap";
import Preferences from "./Preferences";
import { computeMuscleSetCounts } from "./lib/volume";
import { computeDOTS, dotsBand } from "./lib/dots";
import { getPrefs, setPref } from "./lib/prefs";
import { saveSessionState, loadSessionState, clearSessionState } from "./lib/sessionState";
import { IDEOLOGIES } from "./lib/ideologies";
import { MUSCLE_COLORS } from "./lib/muscleColors";
import ExerciseThumb from "./ExerciseThumb";
import CustomExerciseModal from "./CustomExerciseModal";
import ExportWorkoutModal from "./ExportWorkoutModal";
import { IconX, IconCheck, IconStar, IconMenu, IconGear, IconBolt, IconLink, IconPencil, IconCamera, IconImage, IconTrash, IconBarbell } from "./Icons";
import { SPLITS as MOVEMENT_SPLITS } from "./lib/splits";
import { muscleLabel } from "./lib/muscleNomenclature";
import { toLocalDateStr } from "./lib/time";
import { toDisplay, toCanonical, roundDisplay, formatWeight, platesFor, plateByValue, BAR_PRESETS, BIG_PLATE, bigPlateAllowed } from "./lib/weight";
import {
  fetchExercises,
  normalizeExercise,
  createCustomExercise,
  uploadExerciseMedia,
  setWorkoutExerciseSuperset,
  fetchPerformedExerciseIds,
  fetchFavoriteExerciseIds,
  setFavoriteExercise,
  fetchExercisePRBaselines,
  fetchDotsPercentile,
  fetchProfile,
  saveProfile,
  fetchStreak,
  hydrateExercise,
  startWorkout,
  addWorkoutExercise,
  removeWorkoutExercise,
  reorderWorkoutExercises,
  updateWorkoutExercisePlanned,
  updateWorkoutExerciseWarmupPlanned,
  setSetWarmup,
  logSet,
  deleteSet,
  updateSet,
  completeWorkout,
  deleteWorkout,
  saveExerciseDefaults,
  saveWorkoutSummary,
  saveWorkoutAsTemplate,
  fetchTemplates,
  fetchTemplateExercises,
  uploadProgressPhoto,
} from "./lib/queries";

// ---------- Design tokens ----------
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

// The equipment filter's fixed set of buckets — see deriveEquipmentBucket
// in lib/queries.js for how a raw equipment list gets mapped onto one of these.
const EQUIPMENT_LIST = ["Barbell", "Dumbbell", "Cable", "Machine", "Kettlebell", "Bodyweight", "Other"];

// Plate/bar constants now live in lib/weight.js so both lb and kg sets
// are available; availablePlates(unit, muscleGroup) below picks the
// right set and applies the big-plate (55 lb / 25 kg) scope preference.
const availablePlates = (unit, muscleGroup) => {
  const scope = getPrefs().plate55Scope;
  const big = BIG_PLATE[unit];
  return platesFor(unit).filter((p) => p.value !== big || bigPlateAllowed(scope, muscleGroup));
};


// Quick-select splits for the generator's target-muscle picker. Picking one
// sets the muscle selection to exactly that group; picking it again clears
// back to none.

function e1RM(weight, reps, rir) {
  const eff = reps + rir;
  if (eff <= 0 || weight <= 0) return 0;
  if (eff === 1) return weight;
  if (eff <= 6) return weight / (1.0278 - 0.0278 * eff);
  return weight * (1 + eff / 30);
}
function weightForReps(oneRM, reps) {
  if (reps <= 6) return oneRM * (1.0278 - 0.0278 * reps);
  return oneRM / (1 + reps / 30);
}

// Formats a single metric delta vs last session as a signed, colored badge.
// Returns null when there's no change, so the caller can omit that line.
function diffBadge(diff, unit) {
  if (!diff) return null;
  const sign = diff > 0 ? "+" : "";
  return { text: `${sign}${diff} ${unit}`, color: diff > 0 ? T.green : T.accent };
}

// Always produces an ideology-adjusted target, with or without history.
// Falls back to treating the library's default weight as a Hypertrophy-effort
// performance at RIR 2, so every exercise responds to ideology switching.
function targetFor(ex, ideologyName, unit) {
  const { low, high } = IDEOLOGIES[ideologyName];
  const reps = Math.round((low + high) / 2);
  const bestFromHistory = ex.lastWeek.reduce((m, s) => Math.max(m, e1RM(s.weight, s.reps, s.rir)), 0);
  let baseE1RM, anchored, source;
  if (bestFromHistory > 0) {
    const bestSet = ex.lastWeek.reduce((best, s) => (e1RM(s.weight, s.reps, s.rir) > e1RM(best.weight, best.reps, best.rir) ? s : best));
    baseE1RM = bestFromHistory;
    anchored = true;
    source = bestSet;
  } else {
    const hypReps = Math.round((IDEOLOGIES.Hypertrophy.low + IDEOLOGIES.Hypertrophy.high) / 2);
    baseE1RM = e1RM(ex.targetWeight, hypReps, 2);
    anchored = false;
    source = { weight: ex.targetWeight, reps: hypReps, rir: 2 };
  }
  const step = unit === "kg" ? 2.5 : 5;
  const weight = Math.round(weightForReps(baseE1RM, reps) / step) * step;
  return { weight, reps, anchored, baseE1RM: Math.round(baseE1RM), source };
}

function greedyPerSide(total, bar, unit, muscleGroup) {
  let rem = (total - bar) / 2;
  if (rem < 0) return { stack: [], leftover: 0 };
  const stack = [];
  for (const p of availablePlates(unit, muscleGroup)) {
    while (rem >= p.value - 0.001) { stack.push(p.value); rem -= p.value; }
  }
  return { stack, leftover: rem };
}

// newItem builds a workout slot from a hydrated library exercise (already
// carrying lastWeek/sessions/savedNotes/savedSetup from hydrateExercise)
// plus the id of the workout_exercises row that was just created for it.
const newItem = (hydrated, dbId, planned = 3, plannedWarmup = 0) => ({
  ...hydrated,
  dbId,
  planned,
  plannedWarmup,
  notes: hydrated.savedNotes || "",
  setup: hydrated.savedSetup ? { ...hydrated.savedSetup } : {},
  restSeconds: hydrated.savedRestSeconds || null, // null = use the global default
  ideology: null,
  supersetGroup: null,
});

// ---------- Reusable pieces (module scope so identity stays stable across renders) ----------
// Plain color dot for muscle-group-only contexts (no specific exercise attached,
// e.g. the generator's muscle picker). Exercise rows use ExerciseThumb instead.
function MuscleDot({ muscle }) {
  return <span style={{ width: 8, height: 8, borderRadius: 4, background: MUSCLE_COLORS[muscle] || T.dim, display: "inline-block", flexShrink: 0 }} />;
}

function ExerciseRow({ l, onClick, badge, onToggleFavorite, selectable, selected }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, background: selectable && selected ? "rgba(232,68,46,0.08)" : "transparent", borderRadius: 8 }}>
      <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: "9px 6px", borderRadius: 8 }}>
        {selectable && (
          <div aria-hidden="true" style={{
            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
            border: `1.5px solid ${selected ? T.accent : T.line}`,
            background: selected ? T.accent : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 12, fontWeight: 700,
          }}>
            {selected ? <IconCheck size={11} /> : ""}
          </div>
        )}
        {badge}
        <ExerciseThumb muscle={l.muscle} mediaUrl={l.mediaUrl} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: T.text, fontSize: 14 }}>{l.name}</div>
          <div style={{ color: T.dim, fontSize: 11 }}>{muscleLabel(l.muscle)} · {l.equipment}</div>
        </div>
        <div style={{ color: T.dim, fontSize: 11, textAlign: "right", flexShrink: 0 }}>
          {l.sessions > 0 ? `${l.sessions} session${l.sessions > 1 ? "s" : ""}` : "Not performed"}
        </div>
      </button>
      {onToggleFavorite && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(l.id); }}
          aria-label={l.isFavorite ? "Unfavorite" : "Favorite"}
          title={l.isFavorite ? "Unfavorite" : "Favorite"}
          style={{ background: "none", border: "none", color: l.isFavorite ? "#F2C94C" : T.dim, fontSize: 16, padding: "4px 6px", flexShrink: 0 }}
        >
          <IconStar size={15} filled={l.isFavorite} />
        </button>
      )}
    </div>
  );
}

function ExercisePicker({ list, search, onSearchChange, muscleFilter, onToggleMuscle, onApplySplit, equipFilter, onToggleEquip, performedFilter, onSetPerformed, sourceFilter, onSetSource, showFilters, onToggleFilters, onPick, onToggleFavorite, footer, multiSelect, selectedIds, onToggleSelect }) {
  const rowClick = (l) => (multiSelect ? onToggleSelect(l) : onPick(l));
  const smallBtn = { background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 11, whiteSpace: "nowrap" };
  const chip = (active, color) => ({ padding: "5px 11px", borderRadius: 999, fontSize: 12, fontWeight: 600, border: `1px solid ${active ? (color || T.accent) : T.line}`, background: active ? `${color || T.accent}22` : T.surface, color: active ? T.text : T.dim });
  const activeCount = muscleFilter.length + equipFilter.length + (performedFilter !== "all" ? 1 : 0) + (sourceFilter !== "all" ? 1 : 0);
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input
          autoComplete="off"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search exercises, muscles, equipment..."
          style={{ flex: 1, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "8px 10px", outline: "none", boxSizing: "border-box" }}
        />
        <button onClick={onToggleFilters} style={{ ...smallBtn, color: activeCount > 0 ? T.text : T.dim, borderColor: activeCount > 0 ? T.accent : T.line }}>
          Filters{activeCount > 0 ? ` (${activeCount})` : ""}
        </button>
      </div>

      {showFilters && (
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Split</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
            {Object.keys(MOVEMENT_SPLITS).map((splitName) => {
              const active = muscleFilter.length === MOVEMENT_SPLITS[splitName].length && MOVEMENT_SPLITS[splitName].every((m) => muscleFilter.includes(m));
              return (
                <button key={splitName} onClick={() => onApplySplit(splitName)} style={chip(active)}>{splitName}</button>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Muscle group</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
            {Object.keys(MUSCLE_COLORS).map((m) => (
              <button key={m} onClick={() => onToggleMuscle(m)} style={chip(muscleFilter.includes(m), MUSCLE_COLORS[m])}>{m}</button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Equipment</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
            {EQUIPMENT_LIST.map((eq) => (
              <button key={eq} onClick={() => onToggleEquip(eq)} style={chip(equipFilter.includes(eq))}>{eq}</button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>History</div>
          <div style={{ display: "flex", gap: 5 }}>
            {[["all", "All"], ["performed", "Performed"], ["not", "Not performed"]].map(([k, label]) => (
              <button key={k} onClick={() => onSetPerformed(k)} style={chip(performedFilter === k)}>{label}</button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, marginTop: 8 }}>Source</div>
          <div style={{ display: "flex", gap: 5 }}>
            {[["all", "All"], ["custom", "Custom"]].map(([k, label]) => (
              <button key={k} onClick={() => onSetSource(k)} style={chip(sourceFilter === k)}>{label}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ maxHeight: "42vh", overflowY: "auto", marginBottom: 4 }}>
        {list.length === 0 && <div style={{ fontSize: 13, color: T.dim, padding: "8px 6px" }}>No matches.</div>}
        {(() => {
          const selected = multiSelect && selectedIds ? list.filter((l) => selectedIds.has(l.id)) : [];
          const remaining = selected.length > 0 ? list.filter((l) => !selectedIds.has(l.id)) : list;
          const favorites = remaining.filter((l) => l.isFavorite);
          const performed = remaining.filter((l) => !l.isFavorite && l.sessions > 0);
          const unperformed = remaining.filter((l) => !l.isFavorite && !(l.sessions > 0));
          return (
            <>
              {selected.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: T.accent, textTransform: "uppercase", letterSpacing: 1, padding: "6px 4px 4px" }}>Selected ({selected.length})</div>
                  {selected.map((l) => <ExerciseRow key={l.name} l={l} onClick={() => rowClick(l)} onToggleFavorite={onToggleFavorite} selectable={multiSelect} selected />)}
                  <div style={{ height: 1, background: T.line, margin: "6px 4px 4px" }} />
                </>
              )}
              {favorites.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, padding: "6px 4px 4px" }}>Favorites</div>
                  {favorites.map((l) => <ExerciseRow key={l.name} l={l} onClick={() => rowClick(l)} onToggleFavorite={onToggleFavorite} selectable={multiSelect} selected={selectedIds && selectedIds.has(l.id)} />)}
                </>
              )}
              {performed.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, padding: "6px 4px 4px" }}>Previously performed</div>
                  {performed.map((l) => <ExerciseRow key={l.name} l={l} onClick={() => rowClick(l)} onToggleFavorite={onToggleFavorite} selectable={multiSelect} selected={selectedIds && selectedIds.has(l.id)} />)}
                </>
              )}
              {unperformed.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, padding: "10px 4px 4px" }}>Unperformed</div>
                  {unperformed.map((l) => <ExerciseRow key={l.name} l={l} onClick={() => rowClick(l)} onToggleFavorite={onToggleFavorite} selectable={multiSelect} selected={selectedIds && selectedIds.has(l.id)} />)}
                </>
              )}
            </>
          );
        })()}
      </div>
      {footer}
    </div>
  );
}

// A left/right arrow selector standing in for a <select>, used anywhere
// someone steps through a short, ordered list of options.
function ArrowSelect({ options, value, onChange, renderLabel }) {
  const idx = options.indexOf(value);
  const go = (d) => {
    const n = idx + d;
    if (n >= 0 && n < options.length) onChange(options[n]);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, padding: "2px 4px" }}>
      <button type="button" onClick={() => go(-1)} disabled={idx <= 0} aria-label="Previous option" style={{ background: "none", border: "none", color: idx <= 0 ? "#3A404B" : T.dim, fontSize: 13, padding: "4px 4px", flexShrink: 0 }}>‹</button>
      <span style={{ color: T.text, fontSize: 12, textAlign: "center", flex: 1 }}>{renderLabel ? renderLabel(value) : value}</span>
      <button type="button" onClick={() => go(1)} disabled={idx >= options.length - 1} aria-label="Next option" style={{ background: "none", border: "none", color: idx >= options.length - 1 ? "#3A404B" : T.dim, fontSize: 13, padding: "4px 4px", flexShrink: 0 }}>›</button>
    </div>
  );
}

// Labels a sets array for display: warmup sets count independently as
// W1, W2… and the first working set restarts the count at 1 — based on
// each set's isWarmup flag, not physical position, so toggling a set's
// warmup status anywhere in the list renumbers everything correctly.
function setLabels(sets) {
  let working = 0;
  let warmup = 0;
  return (sets || []).map((s) => (s.isWarmup ? `W${++warmup}` : `${++working}`));
}

function SetCard({ s, label, ghost, actions, comparison, unit, onToggleWarmup }) {
  const repsBadge = comparison ? diffBadge(s.reps - comparison.reps, Math.abs(s.reps - comparison.reps) === 1 ? "Rep" : "Reps") : null;
  const weightBadge = comparison ? diffBadge(s.weight - comparison.weight, unit === "kg" ? "Kg" : "Lbs") : null;
  const matched = comparison && !repsBadge && !weightBadge;
  const badgeStyle = { width: 26, height: 26, borderRadius: 8, background: s.isWarmup ? "rgba(232,168,46,0.18)" : T.surface2, color: s.isWarmup ? "#E8A82E" : T.dim, fontSize: 12, fontWeight: s.isWarmup ? 700 : 400, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: ghost ? "transparent" : T.surface, border: `1px ${ghost ? "dashed" : "solid"} ${T.line}`, borderRadius: 12, marginBottom: 8, opacity: ghost ? 0.75 : 1 }}>
      {onToggleWarmup ? (
        <button onClick={onToggleWarmup} aria-label={s.isWarmup ? "Unmark as warmup" : "Mark as warmup"} title={s.isWarmup ? "Unmark as warmup" : "Mark as warmup"} style={{ ...badgeStyle, border: "none", cursor: "pointer" }}>{label}</button>
      ) : (
        <div style={badgeStyle}>{label}</div>
      )}
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 600, color: ghost ? T.dim : T.text }}>
        {s.weight} <span style={{ color: T.dim, fontSize: 16 }}>{unit} x</span> {s.reps}
      </div>
      <div style={{ marginLeft: "auto", textAlign: "right", display: "flex", alignItems: "center", gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, color: T.dim }}>RIR {s.rir} · e1RM {Math.round(e1RM(s.weight, s.reps, s.rir))}</div>
          {comparison && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1, marginTop: 2 }}>
              {repsBadge && <span style={{ fontSize: 11, fontWeight: 700, color: repsBadge.color }}>{repsBadge.text}</span>}
              {weightBadge && <span style={{ fontSize: 11, fontWeight: 700, color: weightBadge.color }}>{weightBadge.text}</span>}
              {matched && <span style={{ fontSize: 11, color: T.dim }}>Matched last session</span>}
            </div>
          )}
        </div>
        {actions}
      </div>
    </div>
  );
}

export default function SetLogger({ user, onFinished, resumeWorkout }) {
  const [view, setView] = useState("workout");
  const [library, setLibrary] = useState([]);
  const [workoutId, setWorkoutId] = useState(null);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState(null);
  const [workout, setWorkout] = useState([]);
  const [exIdx, setExIdx] = useState(0);
  const [allSets, setAllSets] = useState([]);
  const [globalIdeology, setGlobalIdeology] = useState(() => getPrefs().trainingIdeology || "Hypertrophy");
  const [showMenu, setShowMenu] = useState(false);
  const [finishConfirm, setFinishConfirm] = useState(false);
  const [outlierReview, setOutlierReview] = useState(null); // null | array of flagged sets pending review
  const [showExportImage, setShowExportImage] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [bodyWeightInput, setBodyWeightInput] = useState("");
  const [progressPhotoFile, setProgressPhotoFile] = useState(null);
  const [progressPhotoPreview, setProgressPhotoPreview] = useState(null);
  const [sessionNotesInput, setSessionNotesInput] = useState("");
  const [savingSummary, setSavingSummary] = useState(false);
  const [profile, setProfile] = useState(null);
  const [streakAfter, setStreakAfter] = useState(null);
  const [percentile, setPercentile] = useState(undefined); // undefined = not fetched yet, null = unavailable
  const [showIdeology, setShowIdeology] = useState(false);
  const [showTargetInfo, setShowTargetInfo] = useState(false);
  const [pickerFor, setPickerFor] = useState(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerMultiSelected, setPickerMultiSelected] = useState([]); // array of library items selected for batch-add
  const [showPickerFilters, setShowPickerFilters] = useState(false);
  const [muscleFilter, setMuscleFilter] = useState([]);
  function applyPickerSplit(splitName) {
    const group = MOVEMENT_SPLITS[splitName];
    const isActive = group.length === muscleFilter.length && group.every((m) => muscleFilter.includes(m));
    setMuscleFilter(isActive ? [] : [...group]);
  }
  const [equipFilter, setEquipFilter] = useState([]);
  const [performedFilter, setPerformedFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [showCreateCustom, setShowCreateCustom] = useState(false);
  const [linkingFrom, setLinkingFrom] = useState(null);
  const [expandedSetsFor, setExpandedSetsFor] = useState(null); // exercise index whose logged sets are expanded for delete, in Edit Workout
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [showMachineSetup, setShowMachineSetup] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rir, setRir] = useState(null);
  const [highlightMissing, setHighlightMissing] = useState({ weight: false, reps: false, rir: false });
  const [showCalc, setShowCalc] = useState(false);
  const [loaded, setLoaded] = useState([]);
  const [barMode, setBarMode] = useState(0); // starting weight for the plate calculator; 0 until a per-exercise value is loaded or set
  const [customBar, setCustomBar] = useState("");
  const [showBarInfo, setShowBarInfo] = useState(false);
  const [restLeft, setRestLeft] = useState(0);
  const [restEndsAt, setRestEndsAt] = useState(null); // timestamp (ms); source of truth for restLeft, persisted so a reload doesn't wipe the timer
  const [flash, setFlash] = useState(null);
  const [genMuscles, setGenMuscles] = useState([]);
  const [genPicks, setGenPicks] = useState([]);
  const [genSearch, setGenSearch] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showWorkoutPrefs, setShowWorkoutPrefs] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateIncludeDetails, setTemplateIncludeDetails] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templates, setTemplates] = useState(null); // null = not loaded yet
  const [loadingTemplateId, setLoadingTemplateId] = useState(null);
  const [genIdeology, setGenIdeology] = useState("Hypertrophy");
  const [genSets, setGenSets] = useState(3);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [prResults, setPrResults] = useState({ weight: [], reps: [], volume: [] });
  const [expandedPR, setExpandedPR] = useState(null);
  const pendingCustomPick = useRef(null);
  const rowRefs = useRef([]);
  const dragOverRef = useRef(null);
  const noteAnchorRef = useRef(null);
  const weightRef = useRef(null);
  const repsRef = useRef(null);
  const touch = useRef(null);
  const startTime = useRef(Date.now());
  const stripRef = useRef(null);
  const chipRefs = useRef([]);

  useEffect(() => {
    if (!restEndsAt) { setRestLeft(0); return; }
    const tick = () => {
      const left = Math.max(0, Math.round((restEndsAt - Date.now()) / 1000));
      setRestLeft(left);
      if (left <= 0) setRestEndsAt(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [restEndsAt]);

  // Persist a full "where was I" snapshot on every relevant change — not
  // just which exercise, but which sub-screen or tool was open: the set
  // logger (and its in-progress weight/reps/rir draft), the plate
  // calculator, the exercise picker (with its filters), machine setup,
  // the workout menu, etc. Closing the app, backgrounding it, or a plain
  // refresh should drop someone back on EXACTLY what they were looking
  // at, not just the right exercise index.
  useEffect(() => {
    if (!workoutId) return;
    saveSessionState(workoutId, {
      view, exIdx, showCalc, showMenu,
      wizardOpen, editIndex, weight, reps, rir,
      pickerFor, pickerSearch, showPickerFilters, muscleFilter, equipFilter, performedFilter, sourceFilter,
      showSetup, showMachineSetup, showWorkoutPrefs, showIdeology, showTargetInfo,
      editingNote, noteDraft,
      restEndsAt,
    });
  }, [
    workoutId, view, exIdx, showCalc, showMenu,
    wizardOpen, editIndex, weight, reps, rir,
    pickerFor, pickerSearch, showPickerFilters, muscleFilter, equipFilter, performedFilter, sourceFilter,
    showSetup, showMachineSetup, showWorkoutPrefs, showIdeology, showTargetInfo,
    editingNote, noteDraft,
    restEndsAt,
  ]);

  // Extra safety net beyond the effect above: force an immediate flush on
  // every plausible "about to lose the page" signal, rather than trusting
  // that the reactive effect already committed. Also flushes on a plain
  // interval as a last-resort backstop — belt and suspenders, since this
  // is the one thing that must never silently fail to persist.
  useEffect(() => {
    if (!workoutId) return;
    const flush = () => {
      saveSessionState(workoutId, {
        view, exIdx, showCalc, showMenu,
        wizardOpen, editIndex, weight, reps, rir,
        pickerFor, pickerSearch, showPickerFilters, muscleFilter, equipFilter, performedFilter, sourceFilter,
        showSetup, showMachineSetup, showWorkoutPrefs, showIdeology, showTargetInfo,
        editingNote, noteDraft,
        restEndsAt,
      });
    };
    flush();
    const intervalId = setInterval(flush, 1000);
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    window.addEventListener("blur", flush);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("blur", flush);
    };
  }, [
    workoutId, view, exIdx, showCalc, showMenu,
    wizardOpen, editIndex, weight, reps, rir,
    pickerFor, pickerSearch, showPickerFilters, muscleFilter, equipFilter, performedFilter, sourceFilter,
    showSetup, showMachineSetup, showWorkoutPrefs, showIdeology, showTargetInfo,
    editingNote, noteDraft,
    restEndsAt,
  ]);

  // Overall workout timer, shown in the menu. Ticks from when this
  // component mounted (i.e. when the workout was started).
  useEffect(() => {
    const id = setInterval(() => setElapsedSec(Math.floor((Date.now() - startTime.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Boots the session: loads the exercise library, then either resumes an
  // in-progress workout passed in from App (so leaving the browser
  // mid-workout never loses anything) or opens a fresh blank one. No
  // exercises are pre-added on a fresh start — the person picks via the
  // generator or "Add exercises manually" from the empty state.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const lib = await fetchExercises();
        if (cancelled) return;
        const [performedIds, favIds] = await Promise.all([fetchPerformedExerciseIds(user.id), fetchFavoriteExerciseIds(user.id)]);
        if (cancelled) return;
        setLibrary(lib.map((l) => ({ ...l, sessions: performedIds.has(l.id) ? 1 : 0, isFavorite: favIds.has(l.id) })));
        setFavoriteIds(favIds);

        if (resumeWorkout) {
          setWorkoutId(resumeWorkout.id);
          setGlobalIdeology(resumeWorkout.ideology);
          if (resumeWorkout.startedAt) startTime.current = new Date(resumeWorkout.startedAt).getTime();
          const items = [];
          const setsArr = [];
          for (const row of resumeWorkout.exerciseRows) {
            const hydrated = await hydrateExercise(user.id, row.exercise);
            if (cancelled) return;
            const item = newItem(hydrated, row.weId, row.plannedSets, row.plannedWarmupSets || 0);
            item.supersetGroup = row.supersetGroup ?? null;
            items.push(item);
            setsArr.push(row.sets);
          }
          setWorkout(items);
          setAllSets(setsArr);

          // Restore whichever screen, exercise, and tool were active before
          // the app was closed/backgrounded/reloaded — the set logger with
          // its draft set, the plate calculator, the exercise picker and
          // its filters, machine setup, the workout menu, all of it.
          const saved = loadSessionState(resumeWorkout.id);
          if (saved) {
            if (typeof saved.exIdx === "number" && saved.exIdx < items.length) setExIdx(saved.exIdx);
            if (saved.view) setView(saved.view);
            if (saved.showCalc) setShowCalc(true);
            if (saved.showMenu) setShowMenu(true);
            if (saved.wizardOpen) {
              setWizardOpen(true);
              setEditIndex(typeof saved.editIndex === "number" ? saved.editIndex : null);
              setWeight(saved.weight || "");
              setReps(saved.reps || "");
              setRir(saved.rir ?? null);
            }
            if (saved.pickerFor != null) {
              setPickerFor(saved.pickerFor);
              setPickerSearch(saved.pickerSearch || "");
              setShowPickerFilters(!!saved.showPickerFilters);
              setMuscleFilter(saved.muscleFilter || []);
              setEquipFilter(saved.equipFilter || []);
              setPerformedFilter(saved.performedFilter || "all");
              setSourceFilter(saved.sourceFilter || "all");
            }
            if (saved.showSetup) setShowSetup(true);
            if (saved.showMachineSetup) setShowMachineSetup(true);
            if (saved.showWorkoutPrefs) setShowWorkoutPrefs(true);
            if (saved.showIdeology) setShowIdeology(true);
            if (saved.showTargetInfo) setShowTargetInfo(true);
            if (saved.editingNote) { setEditingNote(true); setNoteDraft(saved.noteDraft || ""); }
            if (saved.restEndsAt && saved.restEndsAt > Date.now()) setRestEndsAt(saved.restEndsAt);
          }
        } else {
          const newWorkoutId = await startWorkout(user.id, globalIdeology);
          if (cancelled) return;
          setWorkoutId(newWorkoutId);
        }

        fetchProfile(user.id).then((p) => { if (!cancelled) setProfile(p); }).catch(() => {});
      } catch (err) {
        if (!cancelled) setBootError(err.message || "Failed to load your workout.");
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);


  // Auto-scroll the exercise strip so the active chip is always in view.
  useEffect(() => {
    const el = chipRefs.current[exIdx];
    if (el) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [exIdx, workout.length]);

  const ex = workout[exIdx] || null;
  const unit = getPrefs().units;
  const sets = allSets[exIdx] || [];
  const lastWeek = ex ? ex.lastWeek : [];
  const planned = ex ? ex.planned : 0;
  const effIdeology = ex && ex.ideology ? ex.ideology : globalIdeology;
  const ideo = IDEOLOGIES[effIdeology];
  const target = ex ? targetFor(ex, effIdeology, unit) : null;
  const barWeight = barMode === "custom" ? parseFloat(customBar) || 0 : barMode;
  const setNum = sets.length + 1;
  const lastLogged = sets[sets.length - 1];
  const stackSum = loaded.reduce((a, b) => a + b, 0);
  const exDone = ex ? sets.length >= planned : false;
  const workoutDone = workout.length > 0 && allSets.every((s, i) => s.length >= workout[i].planned);

  const note = (msg, type = "e1rm", ms = 4000) => { setFlash({ type, msg }); setTimeout(() => setFlash(null), ms); };

  function goTo(i) {
    if (i < 0 || i >= workout.length || i === exIdx) return;
    setExIdx(i);
    setWizardOpen(false); setShowCalc(false); setEditIndex(null); setLoaded([]);
    setEditingNote(false); setShowSetup(false); setShowIdeology(false); setShowTargetInfo(false);
  }

  function onTouchStart(e) { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
  function onTouchEnd(e) {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) goTo(exIdx + (dx < 0 ? 1 : -1));
  }

  function reorderTo(from, i) {
    if (from === null || from === i) return;
    const w = [...workout]; const [item] = w.splice(from, 1); w.splice(i, 0, item);
    const a = [...allSets]; const [aitem] = a.splice(from, 1); a.splice(i, 0, aitem);
    setWorkout(w); setAllSets(a);
    if (exIdx === from) setExIdx(i);
    else if (from < exIdx && i >= exIdx) setExIdx(exIdx - 1);
    else if (from > exIdx && i <= exIdx) setExIdx(exIdx + 1);
    reorderWorkoutExercises(w.map((x) => x.dbId)).catch(() => {});
  }

  // Pointer-based drag reorder (works for touch and mouse alike — the old
  // HTML5 draggable/onDragStart/onDrop API this replaced never fires on
  // mobile browsers, which is why reordering silently did nothing there).
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
      reorderTo(i, dragOverRef.current);
      setDragIndex(null);
      setDragOverIndex(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
  }

  function toggleFavorite(id) {
    const next = !favoriteIds.has(id);
    setFavoriteIds((prev) => { const s = new Set(prev); if (next) s.add(id); else s.delete(id); return s; });
    setLibrary((prev) => prev.map((l) => (l.id === id ? { ...l, isFavorite: next } : l)));
    setWorkout((prev) => prev.map((w) => (w.id === id ? { ...w, isFavorite: next } : w)));
    setFavoriteExercise(user.id, id, next).catch((err) => note(`Couldn't save favorite: ${err.message}`));
  }

  async function replaceExercise(i, libItem) {
    const planned = workout[i].planned;
    const plannedWarmup = workout[i].plannedWarmup || 0;
    try {
      const dbId = await addWorkoutExercise(workoutId, libItem.id, i, planned, "", null, plannedWarmup);
      const hydrated = await hydrateExercise(user.id, libItem);
      const item = newItem(hydrated, dbId, planned, plannedWarmup);
      setWorkout(workout.map((w, k) => (k === i ? item : w)));
      setAllSets(allSets.map((a, k) => (k === i ? [] : a)));
    } catch (err) {
      note(`Couldn't add ${libItem.name}: ${err.message}`);
    }
    closePicker();
  }
  async function addExercise(libItem) {
    try {
      const dbId = await addWorkoutExercise(workoutId, libItem.id, workout.length, 3);
      const hydrated = await hydrateExercise(user.id, libItem);
      const item = newItem(hydrated, dbId, 3);
      setWorkout([...workout, item]);
      setAllSets([...allSets, []]);
    } catch (err) {
      note(`Couldn't add ${libItem.name}: ${err.message}`);
    }
    closePicker();
  }
  function closePicker() { setPickerFor(null); setPickerSearch(""); setShowPickerFilters(false); setMuscleFilter([]); setEquipFilter([]); setPerformedFilter("all"); setShowCreateCustom(false); setPickerMultiSelected([]); }
  function togglePickerSelect(l) {
    setPickerMultiSelected((prev) => (prev.some((p) => p.id === l.id) ? prev.filter((p) => p.id !== l.id) : [...prev, l]));
    setPickerSearch("");
  }
  async function finishEditing() {
    if (pickerFor === "add" && pickerMultiSelected.length > 0) {
      await addSelectedExercises(); // commits pending picks instead of discarding them
    } else {
      closePicker();
    }
    setView("workout");
  }

  async function addSelectedExercises() {
    const picks = pickerMultiSelected;
    if (picks.length === 0) return;
    try {
      let nextWorkout = workout;
      let nextAllSets = allSets;
      for (const libItem of picks) {
        const dbId = await addWorkoutExercise(workoutId, libItem.id, nextWorkout.length, 3);
        const hydrated = await hydrateExercise(user.id, libItem);
        const item = newItem(hydrated, dbId, 3);
        nextWorkout = [...nextWorkout, item];
        nextAllSets = [...nextAllSets, []];
      }
      setWorkout(nextWorkout);
      setAllSets(nextAllSets);
    } catch (err) {
      note(`Couldn't add exercises: ${err.message}`);
    }
    closePicker();
  }

  // Returns JSX for the "create custom exercise" footer inside an
  // ExercisePicker. Written as a plain function (not a component) so it
  // doesn't remount — and lose input focus — on every keystroke.
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
    setLibrary([...library, normalized]);
    if (pendingCustomPick.current) pendingCustomPick.current(normalized);
  }

  async function handleSaveTemplate() {
    const name = templateName.trim();
    if (!name) return;
    setSavingTemplate(true);
    try {
      await saveWorkoutAsTemplate(user.id, name, workout, templateIncludeDetails);
      setShowSaveTemplate(false);
      setTemplateName("");
      setTemplateSaved(true);
    } catch (err) {
      note(`Couldn't save template: ${err.message}`);
    }
    setSavingTemplate(false);
  }

  async function openTemplates() {
    setView("templates");
    if (templates !== null) return; // already loaded this session
    try {
      const t = await fetchTemplates(user.id);
      setTemplates(t);
    } catch (err) {
      note(`Couldn't load templates: ${err.message}`);
      setTemplates([]);
    }
  }

  async function loadTemplate(template) {
    setLoadingTemplateId(template.id);
    try {
      const rows = await fetchTemplateExercises(template.id);
      const items = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const libItem = library.find((l) => l.id === row.exercise_id);
        if (!libItem) continue; // exercise may have been removed from the library since
        const dbId = await addWorkoutExercise(workoutId, libItem.id, i, row.planned_sets, "", row.superset_group ?? null, row.planned_warmup_sets || 0);
        const hydrated = await hydrateExercise(user.id, libItem);
        const item = newItem(hydrated, dbId, row.planned_sets, row.planned_warmup_sets || 0);
        item.notes = row.notes || item.notes;
        item.setup = Object.keys(row.setup || {}).length > 0 ? { ...row.setup } : item.setup;
        item.supersetGroup = row.superset_group ?? null;
        items.push(item);
      }
      setWorkout(items);
      setAllSets(items.map(() => []));
      setExIdx(0);
      setView("workout");
    } catch (err) {
      note(`Couldn't load template: ${err.message}`);
    }
    setLoadingTemplateId(null);
  }

  function toggleSupersetLink(i) {
    if (linkingFrom === null) { setLinkingFrom(i); return; }
    if (linkingFrom === i) { setLinkingFrom(null); return; }
    const a = workout[linkingFrom], b = workout[i];
    const group = a.supersetGroup ?? b.supersetGroup ?? (Math.max(0, ...workout.map((w) => w.supersetGroup || 0)) + 1);
    const w = workout.map((w, k) => (k === linkingFrom || k === i ? { ...w, supersetGroup: group } : w));
    setWorkout(w);
    setLinkingFrom(null);
    setWorkoutExerciseSuperset(a.dbId, group).catch(() => {});
    setWorkoutExerciseSuperset(b.dbId, group).catch(() => {});
  }

  function unlinkSuperset(i) {
    const group = workout[i].supersetGroup;
    if (group == null) return;
    const remaining = workout.filter((w, k) => k !== i && w.supersetGroup === group);
    // If unlinking leaves a solo exercise behind, dissolve the group entirely
    // rather than leaving a "superset" of one.
    const clearGroup = remaining.length === 1;
    const w = workout.map((w, k) => {
      if (k === i) return { ...w, supersetGroup: null };
      if (clearGroup && w.supersetGroup === group) return { ...w, supersetGroup: null };
      return w;
    });
    setWorkout(w);
    setWorkoutExerciseSuperset(workout[i].dbId, null).catch(() => {});
    if (clearGroup) {
      const other = remaining[0];
      setWorkoutExerciseSuperset(other.dbId, null).catch(() => {});
    }
  }

  function removeExercise(i) {
    const group = workout[i].supersetGroup;
    const removedDbId = workout[i].dbId;
    const w = workout.filter((_, k) => k !== i);
    if (group != null) {
      const stillPaired = w.filter((x) => x.supersetGroup === group).length;
      if (stillPaired === 1) {
        for (let k = 0; k < w.length; k++) {
          if (w[k].supersetGroup === group) { w[k] = { ...w[k], supersetGroup: null }; setWorkoutExerciseSuperset(w[k].dbId, null).catch(() => {}); }
        }
      }
    }
    setWorkout(w);
    setAllSets(allSets.filter((_, k) => k !== i));
    setExIdx(Math.max(0, Math.min(exIdx - (i <= exIdx ? 1 : 0), w.length - 1)));
    removeWorkoutExercise(removedDbId).catch(() => {});
  }
  function adjustPlanned(i, val) {
    setWorkout(workout.map((w, k) => (k === i ? { ...w, planned: val } : w)));
    updateWorkoutExercisePlanned(workout[i].dbId, val).catch(() => {});
  }
  function adjustWarmupPlanned(i, val) {
    setWorkout(workout.map((w, k) => (k === i ? { ...w, plannedWarmup: val } : w)));
    updateWorkoutExerciseWarmupPlanned(workout[i].dbId, val).catch(() => {});
  }
  // Removes one already-logged set from an exercise, from the Edit
  // Workout screen — for when a set got logged by mistake mid-session
  // (wrong exercise, double-tapped, etc). Renumbers locally by just
  // dropping the array entry, same convention the rest of the app uses
  // (set_number is always array position + 1).
  // Toggles a logged set's warmup flag from the workout view — clicking
  // the set number badge. Doesn't touch set_number/weight/reps/rir, so
  // there's nothing to renumber in storage; only the displayed label
  // (computed client-side by setLabels) changes.
  function toggleSetWarmup(i, setIdx) {
    setAllSets(allSets.map((arr, k) => (k === i ? arr.map((s, j) => (j === setIdx ? { ...s, isWarmup: !s.isWarmup } : s)) : arr)));
    const target = (allSets[i] || [])[setIdx];
    setSetWarmup(workout[i].dbId, setIdx + 1, !(target && target.isWarmup)).catch((err) => note(`Couldn't save: ${err.message}`));
  }
  function deleteLoggedSet(i, setIdx) {
    setAllSets(allSets.map((arr, k) => (k === i ? arr.filter((_, j) => j !== setIdx) : arr)));
    deleteSet(workout[i].dbId, setIdx + 1).catch((err) => note(`Couldn't remove set: ${err.message}`));
  }
  // Clears every exercise's custom rest-time override so they all follow
  // the shared default going forward — used by the confirm-gated "Apply
  // to all" control, since normal default changes intentionally leave
  // customized exercises alone.
  async function applyRestToAll(seconds) {
    try {
      await Promise.all(workout.map((w) => saveExerciseDefaults(user.id, w.id, w.setup, w.notes, null)));
      setWorkout(workout.map((w) => ({ ...w, restSeconds: null })));
    } catch (err) {
      note(`Couldn't apply to all: ${err.message}`);
    }
  }

  function adjustRest(i, seconds) {
    // If the new value matches the global default, this exercise is no
    // longer "custom" — store null so it inherits future default changes
    // too, instead of getting stuck pinned at whatever the default was
    // when it happened to match.
    const isDefault = seconds === getPrefs().restSeconds;
    const stored = isDefault ? null : seconds;
    setWorkout(workout.map((w, k) => (k === i ? { ...w, restSeconds: stored } : w)));
    const w = workout[i];
    saveExerciseDefaults(user.id, w.id, w.setup, w.notes, stored).catch((err) => note(`Couldn't save rest timer: ${err.message}`));
  }

  function saveNote() {
    const trimmed = noteDraft.trim();
    setWorkout(workout.map((w, k) => (k === exIdx ? { ...w, notes: trimmed } : w)));
    setEditingNote(false);
    saveExerciseDefaults(user.id, ex.id, ex.setup, trimmed).catch((err) => note(`Couldn't save note: ${err.message}`));
  }
  function deleteNote() {
    setWorkout(workout.map((w, k) => (k === exIdx ? { ...w, notes: "" } : w)));
    setEditingNote(false);
    saveExerciseDefaults(user.id, ex.id, ex.setup, "").catch((err) => note(`Couldn't clear note: ${err.message}`));
  }
  function updateSetup(field, val) {
    const nextSetup = { ...ex.setup, [field]: val };
    setWorkout(workout.map((w, k) => (k === exIdx ? { ...w, setup: nextSetup } : w)));
    saveExerciseDefaults(user.id, ex.id, nextSetup, ex.notes).catch((err) => note(`Couldn't save setup: ${err.message}`));
  }
  function clearSetup() {
    setWorkout(workout.map((w, k) => (k === exIdx ? { ...w, setup: {} } : w)));
    saveExerciseDefaults(user.id, ex.id, {}, ex.notes).catch((err) => note(`Couldn't clear setup: ${err.message}`));
  }

  // Starting weight carries over per exercise (set-to-set, workout-to-
  // workout) — it's the same machine/bar every time, so re-typing it each
  // session is pure friction. Rehydrate whenever the active exercise
  // changes; falls back to 0 for an exercise with no saved value yet.
  useEffect(() => {
    if (!ex) return;
    const saved = ex.setup && ex.setup["_startingWeight"];
    const savedLb = saved != null ? parseFloat(saved) : NaN;
    const display = isNaN(savedLb) ? 0 : roundDisplay(toDisplay(savedLb, unit), unit);
    const preset = BAR_PRESETS[unit].find((b) => b === display);
    if (preset !== undefined) { setBarMode(preset); setCustomBar(""); }
    else { setBarMode("custom"); setCustomBar(display ? String(display) : ""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex && ex.id]);

  function saveStartingWeight(displayValue) {
    if (!ex) return;
    updateSetup("_startingWeight", String(toCanonical(displayValue, unit)));
  }

  // Seat/bar/cable height are numeric on almost every machine, so numeric
  // entry is the default; the toggle covers the minority of machines
  // labeled with words/notches instead of numbers (e.g. "top pin").
  function heightField(field) {
    const isText = !!(ex.setup && ex.setup[`${field}__text`]);
    const val = (ex.setup && ex.setup[field]) || "";
    return (
      <>
        <input
          inputMode={isText ? "text" : "decimal"}
          value={val}
          onChange={(e) => updateSetup(field, isText ? e.target.value : e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="—"
          style={{ width: 90, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "5px 8px", outline: "none", textAlign: "center", boxSizing: "border-box" }}
        />
        <button
          onClick={() => updateSetup(`${field}__text`, isText ? "" : "1")}
          title={isText ? "Switch to numeric" : "Switch to text, e.g. \"top notch\""}
          style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${T.line}`, background: isText ? "rgba(232,68,46,0.12)" : "none", color: isText ? T.text : T.dim, fontSize: 10, fontWeight: 700, padding: 0, flexShrink: 0 }}
        >{isText ? "Abc" : "#"}</button>
      </>
    );
  }


  function setExerciseIdeology(name) {
    setWorkout(workout.map((w, k) => (k === exIdx ? { ...w, ideology: name === globalIdeology ? null : name } : w)));
    setShowIdeology(false);
  }

  function toggleGenMuscle(m) {
    if (genMuscles.includes(m)) {
      setGenMuscles(genMuscles.filter((x) => x !== m));
      setGenPicks(genPicks.filter((id) => library.find((l) => l.id === id)?.muscle !== m));
    } else setGenMuscles([...genMuscles, m]);
  }
  function applySplit(splitName) {
    const group = MOVEMENT_SPLITS[splitName];
    const isActive = group.length === genMuscles.length && group.every((m) => genMuscles.includes(m));
    if (isActive) {
      setGenMuscles([]);
      setGenPicks([]);
    } else {
      setGenMuscles(group);
      setGenPicks(genPicks.filter((id) => group.includes(library.find((l) => l.id === id)?.muscle)));
    }
  }
  function toggleGenPick(id) { setGenPicks(genPicks.includes(id) ? genPicks.filter((n) => n !== id) : [...genPicks, id]); }

  async function generateWorkout() {
    const picks = genPicks.map((id) => library.find((l) => l.id === id)).filter(Boolean);
    await finishGenerateWorkout(picks);
  }

  async function finishGenerateWorkout(allPicks, addedSuggestionNames = []) {
    try {
      const items = [];
      for (let i = 0; i < allPicks.length; i++) {
        const p = allPicks[i];
        const dbId = await addWorkoutExercise(workoutId, p.id, i, genSets);
        const hydrated = await hydrateExercise(user.id, p);
        const item = newItem(hydrated, dbId, genSets);
        if (addedSuggestionNames.includes(p.name)) item.suggested = true;
        items.push(item);
      }
      setWorkout(items);
      setAllSets(items.map(() => []));
      setExIdx(0);
      setGlobalIdeology(genIdeology);
      setView("workout");
    } catch (err) {
      note(`Couldn't generate workout: ${err.message}`);
    }
  }

  function openWizard(prefill, editIdx = null) {
    if (prefill) { setWeight(String(prefill.weight)); setReps(String(prefill.reps)); setRir(prefill.rir !== undefined ? prefill.rir : null); }
    else if (lastLogged) {
      const lw = lastWeek[Math.min(sets.length, lastWeek.length - 1)];
      setWeight(String(lastLogged.weight)); setReps(String(lw ? lw.reps : target.reps)); setRir(null);
    } else { setWeight(String(target.weight)); setReps(String(target.reps)); setRir(null); }
    setEditIndex(editIdx); setLoaded([]); setWizardOpen(true);
    setShowCalc(getPrefs().weightEntryMode === "plate");
    setTimeout(() => {
      weightRef.current && weightRef.current.focus();
      noteAnchorRef.current && noteAnchorRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 60);
  }
  function fillFrom(s) { setWeight(String(s.weight)); setReps(String(s.reps)); setRir(s.rir); setLoaded([]); }
  function copyAll() {
    if (lastWeek.length === 0) return note("No last session on record for this exercise.");
    const remaining = lastWeek.slice(sets.length);
    if (remaining.length === 0) return note("All of last session's sets are already logged.");
    const nextSets = [...sets, ...remaining.map((s) => ({ ...s }))];
    setAllSets(allSets.map((arr, i) => (i === exIdx ? nextSets : arr)));
    note(`Copied ${remaining.length} set${remaining.length > 1 ? "s" : ""} from last session. Tap Edit on any set to adjust.`);
  }

  function addPlate(lb) { const next = [...loaded, lb]; setLoaded(next); setWeight(String(barWeight + 2 * next.reduce((a, b) => a + b, 0))); }
  function removePlate(i) { const next = loaded.filter((_, idx) => idx !== i); setLoaded(next); setWeight(String(barWeight + 2 * next.reduce((a, b) => a + b, 0))); }
  function clearPlates() { setLoaded([]); setWeight(String(barWeight)); }
  function autoLoad() {
    const w = parseFloat(weight) || 0;
    if (barWeight <= 0) return note("Set a starting weight first (bar, machine arms, etc.).");
    if (w <= 0) return note("Type a target weight, then tap Optimize loading.");
    if (w <= barWeight) return note("Target is at or below the starting weight. Nothing to load.");
    const g = greedyPerSide(w, barWeight, unit, ex && ex.muscle);
    setLoaded(g.stack);
    if (g.leftover > 0.01) note(`${g.leftover.toFixed(1)} ${unit} per side can't be loaded with standard plates.`);
  }

  function saveSet() {
    const w = parseFloat(weight); const r = parseInt(reps, 10);
    if (!w || !r || rir === null) {
      setHighlightMissing({ weight: !w, reps: !r, rir: rir === null });
      setTimeout(() => setHighlightMissing({ weight: false, reps: false, rir: false }), 1600);
      return;
    }
    const entry = { weight: w, reps: r, rir };
    if (editIndex !== null) {
      setAllSets(allSets.map((arr, i) => (i === exIdx ? arr.map((s, j) => (j === editIndex ? { ...s, ...entry } : s)) : arr)));
      setWizardOpen(false); setShowCalc(false); setEditIndex(null);
      note(`Set ${editIndex + 1} updated.`, "e1rm", 3000);
      updateSet(ex.dbId, editIndex + 1, toCanonical(w, unit), r, rir).catch((err) => note(`Set updated locally, but didn't sync: ${err.message}`));
      return;
    }
    // New sets default to warmup while they're still within the planned
    // warmup count for this exercise — e.g. 2 planned warmups means the
    // first two sets logged come in tagged, and the third restarts the
    // working count at 1. Still fully overridable by tapping the badge.
    const isWarmup = sets.length < (ex.plannedWarmup || 0);
    const nextSets = [...sets, { ...entry, isWarmup }];
    setAllSets(allSets.map((arr, i) => (i === exIdx ? nextSets : arr)));
    setWizardOpen(false); setShowCalc(false);
    // Superset: no rest between paired exercises, only after finishing a full
    // round through the group. Jump straight to whichever partner is behind.
    const partnerIdx = ex.supersetGroup != null
      ? workout.findIndex((o, k) => k !== exIdx && o.supersetGroup === ex.supersetGroup && allSets[k].length < nextSets.length)
      : -1;
    if (partnerIdx !== -1) {
      setRestEndsAt(null);
      goTo(partnerIdx);
    } else {
      setRestEndsAt(Date.now() + (ex.restSeconds || getPrefs().restSeconds) * 1000);
    }
    if (nextSets.length === planned && lastWeek.length >= planned && r >= lastWeek[planned - 1].reps + 2) {
      note(`Final set beat last session by ${r - lastWeek[planned - 1].reps} reps. Do it again next workout and the target moves up.`, "progress", 5000);
    }
    logSet(ex.dbId, nextSets.length, toCanonical(w, unit), r, rir, isWarmup).catch((err) => note(`Set logged locally, but didn't sync: ${err.message}`));
  }

  const bestE1RM = sets.filter((s) => !s.isWarmup).reduce((m, s) => Math.max(m, e1RM(s.weight, s.reps, s.rir)), 0);
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const hhmmss = (totalSec) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  };

  // Live muscle volumes for the in-workout heatmap, computed from whatever
  // has actually been logged so far this session. Warmup sets are excluded
  // — they're not working volume.
  const liveVolumeEntries = workout.map((w, i) => ({ muscle: w.muscle, secondaryMuscles: w.secondaryMuscles, sets: (allSets[i] || []).filter((s) => !s.isWarmup) }));
  const { primary: livePrimary, secondary: liveSecondary, fullBodySets: liveFullBodySets } = computeMuscleSetCounts(liveVolumeEntries);

  // Flags sets that look like a typo or wrong-plate mistake rather than a
  // real effort: way outside both what else got logged this session for
  // the same exercise AND what was logged last time. Small swings are
  // normal training variation, not a mistake — only flags a meaningful
  // jump so this doesn't nag on every heavier or lighter set.
  function detectOutlierSets() {
    const minAbsDiff = unit === "kg" ? 5 : 10;
    const flagged = [];
    workout.forEach((w, i) => {
      const sets = allSets[i] || [];
      if (sets.length === 0) return;
      const historyWeights = (w.lastWeek || []).map((s) => s.weight).filter((v) => v > 0);
      sets.forEach((s, j) => {
        if (!s.weight || s.isWarmup) return; // warmup weight is expected to be lighter, not a mistake
        const sessionOthers = sets.filter((_, k) => k !== j && !sets[k].isWarmup).map((o) => o.weight).filter((v) => v > 0);
        const reference = [...sessionOthers, ...historyWeights];
        if (reference.length === 0) return; // nothing to compare against yet
        const avg = reference.reduce((a, b) => a + b, 0) / reference.length;
        if (avg <= 0) return;
        const ratio = s.weight / avg;
        if ((ratio >= 1.4 || ratio <= 0.6) && Math.abs(s.weight - avg) >= minAbsDiff) {
          flagged.push({ exIdx: i, setIdx: j, name: w.short || w.name, weight: s.weight, reps: s.reps, avg: Math.round(avg), direction: ratio > 1 ? "high" : "low" });
        }
      });
    });
    return flagged;
  }

  function handleFinishClick() {
    const flags = detectOutlierSets();
    if (flags.length > 0) { setOutlierReview(flags); return; }
    handleConfirmFinish();
  }

  function editFlaggedSet(flag) {
    const setObj = (allSets[flag.exIdx] || [])[flag.setIdx];
    setOutlierReview(null);
    setFinishConfirm(false);
    goTo(flag.exIdx);
    setTimeout(() => openWizard(setObj, flag.setIdx), 0);
  }

  function dismissFlag(flag) {
    setOutlierReview((prev) => (prev || []).filter((f) => !(f.exIdx === flag.exIdx && f.setIdx === flag.setIdx)));
  }

  // Deletes a flagged set straight from the review card — for a clear
  // typo (wrong plates, fat-fingered a number) where there's nothing to
  // "fix," just remove. Other pending flags on the same exercise get
  // their setIdx shifted down since deleting drops the array index.
  function deleteFlaggedSet(flag) {
    deleteLoggedSet(flag.exIdx, flag.setIdx);
    setOutlierReview((prev) =>
      (prev || [])
        .filter((f) => !(f.exIdx === flag.exIdx && f.setIdx === flag.setIdx))
        .map((f) => (f.exIdx === flag.exIdx && f.setIdx > flag.setIdx ? { ...f, setIdx: f.setIdx - 1 } : f))
    );
  }

  async function handleConfirmFinish() {
    try {
      const exerciseIds = [...new Set(workout.map((w) => w.id))];
      const baselines = await fetchExercisePRBaselines(user.id, exerciseIds, workoutId);
      Object.values(baselines).forEach((b) => {
        b.maxWeight = toDisplay(b.maxWeight, unit);
        b.maxSetVolume = toDisplay(b.maxSetVolume, unit);
      });
      const weightPRs = [], repPRs = [], volumePRs = [];
      workout.forEach((w, i) => {
        const sets = (allSets[i] || []).filter((s) => !s.isWarmup);
        if (!sets || sets.length === 0) return;
        const base = baselines[w.id];
        if (!base) return; // no prior history for this exercise — nothing to beat yet
        const sessionMaxWeight = Math.max(...sets.map((s) => s.weight || 0));
        const sessionMaxReps = Math.max(...sets.map((s) => s.reps || 0));
        const sessionMaxVolume = Math.max(...sets.map((s) => (s.weight || 0) * (s.reps || 0)));
        if (sessionMaxWeight > base.maxWeight) weightPRs.push({ name: w.name, value: sessionMaxWeight, previous: base.maxWeight });
        if (sessionMaxReps > base.maxReps) repPRs.push({ name: w.name, value: sessionMaxReps, previous: base.maxReps });
        if (sessionMaxVolume > base.maxSetVolume) volumePRs.push({ name: w.name, value: Math.round(sessionMaxVolume), previous: Math.round(base.maxSetVolume) });
      });
      setPrResults({ weight: weightPRs, reps: repPRs, volume: volumePRs });
    } catch (err) {
      note(`Couldn't check personal records: ${err.message}`);
    }
    try {
      await completeWorkout(workoutId);
    } catch (err) {
      note(`Finished locally, but didn't sync: ${err.message}`);
    }
    clearSessionState(workoutId);
    setShowMenu(false);
    setFinishConfirm(false);
    setView("postWorkout");
  }

  async function handleConfirmCancel() {
    setCancelling(true);
    try {
      await deleteWorkout(workoutId);
    } catch (err) {
      note(`Couldn't fully delete on the server, but leaving anyway: ${err.message}`);
    }
    clearSessionState(workoutId);
    setCancelling(false);
    setShowMenu(false);
    setCancelConfirm(false);
    onFinished();
  }

  async function handleSavePostWorkout() {
    setSavingSummary(true);
    try {
      const entered = bodyWeightInput ? parseFloat(bodyWeightInput) : null;
      const hasEntered = entered != null && !Number.isNaN(entered);
      // No weight entered? Fall back to the last recorded weight so the
      // session still has a data point instead of a gap.
      const w = hasEntered ? entered : (profile && profile.weight) || null;
      await saveWorkoutSummary(workoutId, w, sessionNotesInput.trim());
      // A freshly entered weight overrides the profile's stored weight, so
      // Home's profile section and weight chart pick it up automatically.
      if (hasEntered && profile) {
        saveProfile(user.id, {
          gender: profile.gender,
          dateOfBirth: profile.date_of_birth,
          weight: entered,
          weightUnit: profile.weight_unit || getPrefs().units,
        }).then(() => setProfile({ ...profile, weight: entered })).catch(() => {});
      }
      fetchStreak(user.id).then(setStreakAfter).catch(() => {});
      if (getPrefs().scoreDisplay !== "none") {
        fetchDotsPercentile().then(setPercentile).catch(() => setPercentile(null));
      }
      if (progressPhotoFile) {
        const dateStr = toLocalDateStr(new Date());
        try {
          await uploadProgressPhoto(user.id, dateStr, progressPhotoFile);
        } catch (err) {
          note(`Saved, but the photo didn't upload: ${err.message}`);
        }
      }
    } catch (err) {
      note(`Couldn't save: ${err.message}`);
    }
    setSavingSummary(false);
    setView("summary");
  }


  const inputStyle = { width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, color: T.text, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 34, fontWeight: 600, textAlign: "center", padding: "6px 8px", outline: "none", boxSizing: "border-box" };
  const smallBtn = { background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 11, whiteSpace: "nowrap" };
  const arrowBtn = (disabled) => ({ width: 34, height: 34, borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface, color: disabled ? "#3A404B" : T.dim, fontSize: 16, flexShrink: 0, cursor: disabled ? "default" : "pointer" });
  const fontImport = `@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&display=swap');`;
  const frame = { width: "100%", maxWidth: 400, background: T.bg, minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" };
  const outer = { minHeight: "100vh", background: "#0A0B0D", display: "flex", justifyContent: "center" };

  function filteredLibrary(exclude) {
    const q = pickerSearch.toLowerCase();
    return library.filter((l) => {
      if (exclude.has(l.name)) return false;
      if (q && !(l.name.toLowerCase().includes(q) || (l.aliases || []).some((a) => a.toLowerCase().includes(q)) || (l.muscle || "").toLowerCase().includes(q) || (l.equipment || "").toLowerCase().includes(q))) return false;
      if (muscleFilter.length && !muscleFilter.includes(l.muscle)) return false;
      if (equipFilter.length && !equipFilter.includes(l.equipment)) return false;
      if (performedFilter === "performed" && l.sessions === 0) return false;
      if (performedFilter === "not" && l.sessions > 0) return false;
      if (sourceFilter === "custom" && !l.isCustom) return false;
      return true;
    });
  }

  // ---------- Loading / error states ----------
  // Guards every view below, since they all assume `workout` and `library`
  // are populated. Shown while the boot effect is fetching from Supabase.
  if (bootError) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 320, textAlign: "center" }}>
          <div style={{ color: T.accent, fontWeight: 700, marginBottom: 8 }}>Couldn't load your workout</div>
          <div style={{ color: T.dim, fontSize: 13 }}>{bootError}</div>
        </div>
      </div>
    );
  }
  if (booting || !workoutId) {
    return <div style={{ minHeight: "100vh", background: T.bg }} />;
  }

  // ---------- Generator view ----------
  if (view === "generator") {
    const genQ = genSearch.toLowerCase();
    const candidates = library.filter((l) => genMuscles.includes(l.muscle) && (
      !genQ || l.name.toLowerCase().includes(genQ) || (l.aliases || []).some((a) => a.toLowerCase().includes(genQ)) || l.equipment.toLowerCase().includes(genQ)
    ));
    return (
      <div style={outer}>
        <style>{`${fontImport} button { cursor: pointer; } input:focus { border-color: ${T.accent} !important; }`}</style>
        <div style={frame}>
          <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}>
            <button onClick={() => setView("workout")} aria-label="Back" style={smallBtn}>‹</button>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, color: T.text, textAlign: "center" }}>WORKOUT GENERATOR</div>
            <div style={{ width: 26 }} />
          </div>
          <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>
            <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Split</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 16 }}>
              {Object.keys(MOVEMENT_SPLITS).map((splitName) => {
                const group = MOVEMENT_SPLITS[splitName];
                const active = group.length === genMuscles.length && group.every((m) => genMuscles.includes(m));
                return (
                  <button key={splitName} onClick={() => applySplit(splitName)} style={{ padding: "9px 2px", borderRadius: 10, fontSize: 12, fontWeight: 700, border: `1px solid ${active ? T.accent : T.line}`, background: active ? "rgba(232,68,46,0.15)" : T.surface, color: active ? T.text : T.dim }}>
                    {splitName}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Target muscle groups</div>
            {genMuscles.length > 0 && (
              <>
                <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Selected</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
                  {genMuscles.map((m) => (
                    <button key={m} onClick={() => toggleGenMuscle(m)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "12px 6px", borderRadius: 12, fontSize: 12, fontWeight: 600, border: `1px solid ${MUSCLE_COLORS[m]}`, background: `${MUSCLE_COLORS[m]}22`, color: T.text }}>
                      <MuscleDot muscle={m} /> {muscleLabel(m)}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{genMuscles.length > 0 ? "Available" : "All muscle groups"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
              {Object.keys(MUSCLE_COLORS).filter((m) => !genMuscles.includes(m)).map((m) => (
                <button key={m} onClick={() => toggleGenMuscle(m)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "12px 6px", borderRadius: 12, fontSize: 12, fontWeight: 600, border: `1px solid ${T.line}`, background: T.surface, color: T.dim }}>
                  <MuscleDot muscle={m} /> {muscleLabel(m)}
                </button>
              ))}
            </div>
            {genMuscles.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Pick preferred exercises</div>
                <div style={{ fontSize: 12, color: T.dim, marginBottom: 8 }}>Tap in order of preference.</div>
                <input
                  autoComplete="off"
                  value={genSearch}
                  onChange={(e) => setGenSearch(e.target.value)}
                  placeholder="Search within selected muscle groups…"
                  style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "8px 10px", outline: "none", boxSizing: "border-box", marginBottom: 8 }}
                />
                <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 6, marginBottom: 20 }}>
                  {candidates.length === 0 && <div style={{ fontSize: 13, color: T.dim, padding: "8px 6px" }}>No matches.</div>}
                  {(() => {
                    const renderRow = (l) => {
                      const rank = genPicks.indexOf(l.id);
                      return (
                        <ExerciseRow key={l.name} l={l} onClick={() => toggleGenPick(l.id)}
                          badge={<div style={{ width: 22, height: 22, borderRadius: 7, background: rank >= 0 ? T.accent : T.surface2, color: rank >= 0 ? "#fff" : T.dim, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{rank >= 0 ? rank + 1 : "·"}</div>} />
                      );
                    };
                    const performed = candidates.filter((l) => l.sessions > 0);
                    const unperformed = candidates.filter((l) => !(l.sessions > 0));
                    return (
                      <>
                        {performed.length > 0 && (
                          <>
                            <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, padding: "6px 4px 4px" }}>Previously performed</div>
                            {performed.map(renderRow)}
                          </>
                        )}
                        {unperformed.length > 0 && (
                          <>
                            <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, padding: "10px 4px 4px" }}>Unperformed</div>
                            {unperformed.map(renderRow)}
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              </>
            )}
            {genPicks.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Training focus</div>
                <div style={{ marginBottom: 14 }}>
                  {Object.entries(IDEOLOGIES).map(([name, v]) => {
                    const selected = genIdeology === name;
                    return (
                      <button key={name} onClick={() => setGenIdeology(name)} style={{ display: "block", width: "100%", textAlign: "left", background: selected ? "rgba(232,68,46,0.12)" : T.surface, border: `1px solid ${selected ? T.accent : T.line}`, borderRadius: 10, padding: "10px 12px", marginBottom: 6 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{name} <span style={{ color: T.dim, fontWeight: 400 }}>· {v.low}-{v.high} reps</span></div>
                        <div style={{ fontSize: 12, color: T.dim, lineHeight: 1.4, marginTop: 2 }}>{v.desc}</div>
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Sets per exercise</div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
                  <button onClick={() => setGenSets(Math.max(1, genSets - 1))} style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface, color: T.text, fontSize: 20, fontWeight: 700 }}>−</button>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, color: T.text, minWidth: 28, textAlign: "center" }}>{genSets}</div>
                  <button onClick={() => setGenSets(Math.min(8, genSets + 1))} style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface, color: T.text, fontSize: 20, fontWeight: 700 }}>+</button>
                </div>
              </>
            )}
          </div>
          <div style={{ padding: 16, borderTop: `1px solid ${T.line}`, background: T.surface }}>
            <button onClick={generateWorkout} disabled={genPicks.length === 0} style={{ width: "100%", padding: "15px 0", borderRadius: 14, border: "none", background: genPicks.length === 0 ? T.surface2 : T.accent, color: genPicks.length === 0 ? T.dim : "#fff", fontSize: 16, fontWeight: 700 }}>
              {genPicks.length === 0 ? "Pick at least one exercise" : `Generate workout (${genPicks.length} picked, ${genSets} sets each)`}
            </button>
            <div style={{ fontSize: 11, color: T.dim, textAlign: "center", marginTop: 8 }}>This replaces the current workout.</div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Manage view ----------
  if (view === "manage") {
    const inWorkout = new Set(workout.map((w) => w.name));
    const list = filteredLibrary(inWorkout);
    return (
      <div style={outer}>
        <style>{`${fontImport} button { cursor: pointer; } input:focus { border-color: ${T.accent} !important; }`}</style>
        <div style={frame}>
          <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, color: T.text }}>EDIT WORKOUT</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={finishEditing} data-tutorial="manage-done-btn" aria-label="Done" style={{ ...smallBtn, color: T.text, borderColor: T.accent, fontSize: 13 }}><IconCheck size={12} /></button>
            </div>
          </div>
          <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>
            {workout.length === 0 && (
              <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "20px", border: `1px dashed ${T.line}`, borderRadius: 12, marginBottom: 10 }}>
                Empty workout. Add exercises below or use the generator.
              </div>
            )}
            {linkingFrom !== null && (
              <div style={{ background: "rgba(232,68,46,0.1)", border: `1px solid ${T.accent}`, borderRadius: 10, padding: 10, marginBottom: 10, fontSize: 12, color: T.text, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                Tap the link icon on another exercise to pair them into a superset.
                <button onClick={() => setLinkingFrom(null)} style={{ ...smallBtn, marginLeft: 8, flexShrink: 0 }}>Cancel</button>
              </div>
            )}
            {workout.map((w, i) => (
              <div
                key={i}
                ref={(el) => (rowRefs.current[i] = el)}
                data-tutorial="manage-exercise-row"
                style={{ position: "relative", background: T.surface, border: `1px solid ${w.supersetGroup != null ? T.accent : T.line}`, borderRadius: 12, padding: 12, marginBottom: w.supersetGroup != null && workout[i + 1]?.supersetGroup === w.supersetGroup ? 4 : 10, opacity: dragIndex === i ? 0.5 : 1 }}
              >
                {dragIndex !== null && dragOverIndex === i && dragIndex > i && (
                  <div style={{ position: "absolute", left: 8, right: 8, top: -6, height: 3, borderRadius: 2, background: T.accent }} />
                )}
                {dragIndex !== null && dragOverIndex === i && dragIndex < i && (
                  <div style={{ position: "absolute", left: 8, right: 8, bottom: -6, height: 3, borderRadius: 2, background: T.accent }} />
                )}
                {w.supersetGroup != null && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                    Superset · no rest to next exercise
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    onPointerDown={(e) => startRowDrag(i, e)}
                    aria-label="Drag to reorder"
                    title="Drag to reorder"
                    style={{ cursor: "grab", color: T.dim, fontSize: 18, padding: "4px 2px", touchAction: "none", flexShrink: 0, alignSelf: "stretch", display: "flex", alignItems: "center" }}
                  >⠿</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: T.text, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <ExerciseThumb muscle={w.muscle} mediaUrl={w.mediaUrl} size={22} /> {w.name}
                      {w.suggested && <span style={{ fontSize: 10, fontWeight: 700, color: "#7BD69B", border: `1px solid ${T.green}`, borderRadius: 999, padding: "1px 7px" }}>Balance pick</span>}
                      {w.ideology && <span style={{ fontSize: 10, fontWeight: 700, color: T.dim, border: `1px solid ${T.line}`, borderRadius: 999, padding: "1px 7px" }}>{w.ideology}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: T.dim, marginTop: 6 }}>Sets</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                      <button onClick={() => adjustPlanned(i, Math.max(1, w.planned - 1))} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 14, fontWeight: 700 }}>−</button>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: T.text, minWidth: 16, textAlign: "center" }}>{w.planned}</div>
                      <button onClick={() => adjustPlanned(i, Math.min(12, w.planned + 1))} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 14, fontWeight: 700 }}>+</button>
                      <div style={{ width: 1, height: 18, background: T.line, margin: "0 2px" }} />
                      <button onClick={() => adjustWarmupPlanned(i, Math.max(0, (w.plannedWarmup || 0) - 1))} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 14, fontWeight: 700 }}>−</button>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: T.text, minWidth: 16, textAlign: "center" }}>{w.plannedWarmup || 0}</div>
                      <button onClick={() => adjustWarmupPlanned(i, Math.min(6, (w.plannedWarmup || 0) + 1))} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 14, fontWeight: 700 }}>+</button>
                      <div style={{ fontSize: 11, color: T.dim }}>warmup</div>
                      {allSets[i].length > 0 && (
                        <button
                          onClick={() => setExpandedSetsFor(expandedSetsFor === i ? null : i)}
                          style={{ fontSize: 11, color: T.dim, marginLeft: 4, background: "none", border: "none", padding: 0, textDecoration: "underline" }}
                        >
                          {allSets[i].length} logged{expandedSetsFor === i ? " · hide" : " · edit"}
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: T.dim, marginTop: 8 }}>Rest timer</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                      <button onClick={() => adjustRest(i, Math.max(15, (w.restSeconds || getPrefs().restSeconds) - 15))} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 14, fontWeight: 700 }}>−</button>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, color: T.text, minWidth: 40, textAlign: "center" }}>
                        {mmss(w.restSeconds || getPrefs().restSeconds)}
                      </div>
                      <button onClick={() => adjustRest(i, Math.min(600, (w.restSeconds || getPrefs().restSeconds) + 15))} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 14, fontWeight: 700 }}>+</button>
                      {w.restSeconds != null && <span style={{ fontSize: 10, color: T.dim, marginLeft: 4 }}>custom</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <button
                      onClick={() => toggleFavorite(w.id)}
                      aria-label={favoriteIds.has(w.id) ? "Unfavorite" : "Favorite"}
                      title={favoriteIds.has(w.id) ? "Unfavorite" : "Favorite"}
                      style={{ ...smallBtn, color: favoriteIds.has(w.id) ? "#F2C94C" : T.dim, borderColor: favoriteIds.has(w.id) ? "#F2C94C" : T.line, fontSize: 15, padding: "3px 10px" }}
                    >
                      <IconStar size={14} filled={favoriteIds.has(w.id)} />
                    </button>
                    <button onClick={() => { setPickerFor(pickerFor === i ? null : i); setPickerSearch(""); }} aria-label="Replace exercise" title="Replace" style={{ ...smallBtn, fontSize: 15, padding: "3px 10px" }}>⇄</button>
                    <button
                      onClick={() => (w.supersetGroup != null ? unlinkSuperset(i) : toggleSupersetLink(i))}
                      aria-label={w.supersetGroup != null ? "Remove from superset" : "Link into superset"}
                      title={w.supersetGroup != null ? "Unlink superset" : linkingFrom === i ? "Tap another exercise to link" : "Link into superset"}
                      style={{ ...smallBtn, fontSize: 15, padding: "3px 10px", color: w.supersetGroup != null || linkingFrom === i ? T.accent : T.dim, borderColor: w.supersetGroup != null || linkingFrom === i ? T.accent : T.line }}
                    ><IconLink size={13} /></button>
                    <button onClick={() => removeExercise(i)} aria-label="Remove exercise" title="Remove" style={{ ...smallBtn, color: T.accent, borderColor: T.accent, fontSize: 15, padding: "3px 10px" }}>−</button>
                  </div>
                </div>
                {expandedSetsFor === i && allSets[i].length > 0 && (
                  <div style={{ marginTop: 8, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: 8 }}>
                    <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Logged sets — remove any that shouldn't count</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {allSets[i].map((s, j) => (
                        <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                          <span style={{ width: 16, color: T.dim }}>{j + 1}</span>
                          <span style={{ color: T.text, fontWeight: 600, flex: 1 }}>{formatWeight(s.weight, unit)} {unit} × {s.reps}{s.rir != null ? ` · RIR ${s.rir}` : ""}</span>
                          <button onClick={() => deleteLoggedSet(i, j)} aria-label="Remove set" style={{ background: "none", border: `1px solid ${T.line}`, color: T.accent, borderRadius: 6, padding: "3px 8px", fontSize: 12 }}>Remove</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {w.notes && <div style={{ fontSize: 12, color: T.dim, marginTop: 8, fontStyle: "italic" }}>Note: {w.notes}</div>}
                {pickerFor === i && (
                  <div style={{ marginTop: 10, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: 8 }}>
                    <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Replace with</div>
                    <ExercisePicker
                      list={filteredLibrary(inWorkout)}
                      search={pickerSearch} onSearchChange={setPickerSearch}
                      muscleFilter={muscleFilter} onToggleMuscle={(m) => setMuscleFilter(muscleFilter.includes(m) ? muscleFilter.filter((x) => x !== m) : [...muscleFilter, m])} onApplySplit={applyPickerSplit}
                      equipFilter={equipFilter} onToggleEquip={(eq) => setEquipFilter(equipFilter.includes(eq) ? equipFilter.filter((x) => x !== eq) : [...equipFilter, eq])}
                      performedFilter={performedFilter} onSetPerformed={setPerformedFilter}
                      sourceFilter={sourceFilter} onSetSource={setSourceFilter}
                      showFilters={showPickerFilters} onToggleFilters={() => setShowPickerFilters(!showPickerFilters)}
                      onPick={(l) => replaceExercise(i, l)}
                      onToggleFavorite={toggleFavorite}
                      footer={<>
                        {allSets[i].length > 0 && <div style={{ fontSize: 11, color: T.accent, marginTop: 4 }}>Replacing clears the {allSets[i].length} set{allSets[i].length > 1 ? "s" : ""} already logged today.</div>}
                        {createCustomFooter((l) => replaceExercise(i, l))}
                      </>}
                    />
                  </div>
                )}
              </div>
            ))}
            {pickerFor === "add" ? (
              <div data-tutorial="add-exercise-panel" style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>Add exercises{pickerMultiSelected.length > 0 ? ` (${pickerMultiSelected.length} selected)` : ""}</div>
                  <button onClick={closePicker} aria-label="Close" style={smallBtn}>‹</button>
                </div>
                <ExercisePicker
                  list={list}
                  search={pickerSearch} onSearchChange={setPickerSearch}
                  muscleFilter={muscleFilter} onToggleMuscle={(m) => setMuscleFilter(muscleFilter.includes(m) ? muscleFilter.filter((x) => x !== m) : [...muscleFilter, m])} onApplySplit={applyPickerSplit}
                  equipFilter={equipFilter} onToggleEquip={(eq) => setEquipFilter(equipFilter.includes(eq) ? equipFilter.filter((x) => x !== eq) : [...equipFilter, eq])}
                  performedFilter={performedFilter} onSetPerformed={setPerformedFilter}
                      sourceFilter={sourceFilter} onSetSource={setSourceFilter}
                  showFilters={showPickerFilters} onToggleFilters={() => setShowPickerFilters(!showPickerFilters)}
                  onPick={addExercise}
                  multiSelect
                  selectedIds={new Set(pickerMultiSelected.map((p) => p.id))}
                  onToggleSelect={togglePickerSelect}
                  onToggleFavorite={toggleFavorite}
                  footer={<>
                    {createCustomFooter(addExercise)}
                    <button
                      onClick={addSelectedExercises}
                      disabled={pickerMultiSelected.length === 0}
                      style={{
                        width: "100%", padding: "12px 0", marginTop: 8, borderRadius: 10, border: "none",
                        background: pickerMultiSelected.length === 0 ? T.surface2 : T.accent,
                        color: pickerMultiSelected.length === 0 ? T.dim : "#fff",
                        fontSize: 14, fontWeight: 700,
                      }}
                    >
                      {pickerMultiSelected.length === 0 ? "Select exercises to add" : `Add ${pickerMultiSelected.length} exercise${pickerMultiSelected.length > 1 ? "s" : ""}`}
                    </button>
                  </>}
                />
              </div>
            ) : (
              <button onClick={() => { setPickerFor("add"); setPickerSearch(""); }} data-tutorial="manage-add-btn" style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: `1px dashed ${T.line}`, background: "none", color: T.dim, fontSize: 14, fontWeight: 600 }}>+ Add exercise</button>
            )}
          </div>
        </div>
        {showCreateCustom && (
          <CustomExerciseModal
            onClose={() => setShowCreateCustom(false)}
            onCreate={handleCreateCustomExercise}
            initialName={pickerSearch}
          />
        )}
      </div>
    );
  }

  // ---------- Summary view ----------
  if (view === "summary") {
    const totalSets = allSets.flat().length;
    const totalVolume = Math.round(allSets.flat().filter((s) => !s.isWarmup).reduce((v, s) => v + s.weight * s.reps, 0));
    const durationMin = Math.max(1, Math.round((Date.now() - startTime.current) / 60000));
    const dateStr = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

    // Gather per-exercise PR flags and the single best e1RM of the session
    // (used as the "current strength" input to the DOTS score below).
    let prCount = 0;
    let bestE1RMOverall = 0;
    const exerciseRows = workout.map((w, i) => {
      const exSets = allSets[i];
      if (exSets.length === 0) return null;
      const bestToday = exSets.reduce((m, s) => Math.max(m, e1RM(s.weight, s.reps, s.rir)), 0);
      bestE1RMOverall = Math.max(bestE1RMOverall, bestToday);
      const bestLast = w.lastWeek.reduce((m, s) => Math.max(m, e1RM(s.weight, s.reps, s.rir)), 0);
      const hasHistory = w.lastWeek.length > 0;
      const delta = bestToday - bestLast;
      const isPR = hasHistory && delta > 0.5;
      if (isPR) prCount++;
      const workingSets = exSets.filter((s) => !s.isWarmup);
      const finalToday = workingSets[workingSets.length - 1];
      const finalLast = w.lastWeek[w.lastWeek.length - 1];
      const twoForTwo = finalToday && finalLast && finalToday.reps >= finalLast.reps + 2;
      return { w, i, exSets, bestToday, bestLast, hasHistory, delta, isPR, twoForTwo };
    });

    const bestE1RMLb = toCanonical(bestE1RMOverall, unit);
    const bodyweightLb = profile ? toCanonical(profile.weight, profile.weight_unit || unit) : null;
    const dots = profile ? computeDOTS(bestE1RMLb, bodyweightLb, profile.gender) : null;
    const band = dotsBand(dots);
    const scorePref = getPrefs().scoreDisplay;

    const facts = [];
    if (prCount > 0) facts.push(`${prCount} exercise${prCount === 1 ? "" : "s"} hit a new e1RM PR today.`);
    if (streakAfter !== null && streakAfter > 1) facts.push(`You're on a ${streakAfter}-day streak.`);
    if (totalVolume > 0) facts.push(`Total volume moved: ${totalVolume.toLocaleString()} ${unit}.`);

    return (
      <div style={outer}>
        <style>{`${fontImport} button { cursor: pointer; }`}</style>
        <div style={frame}>
          <div style={{ padding: "22px 16px 14px", borderBottom: `1px solid ${T.line}`, textAlign: "center" }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 30, fontWeight: 700, color: T.text }}>WORKOUT COMPLETE</div>
            <div style={{ color: T.dim, fontSize: 13, marginTop: 2 }}>{dateStr}</div>
          </div>
          <div style={{ display: "flex", gap: 8, padding: "14px 16px" }}>
            {[{ label: "Sets", value: totalSets }, { label: "Volume", value: `${totalVolume.toLocaleString()} ${unit}` }, { label: "Duration", value: `${durationMin} min` }].map((s) => (
              <div key={s.label} style={{ flex: 1, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: T.text }}>{s.value}</div>
                <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {facts.length > 0 && (
            <div style={{ margin: "0 16px 14px", background: "rgba(59,165,93,0.1)", border: `1px solid ${T.green}`, borderRadius: 12, padding: 12 }}>
              {facts.map((f, idx) => (
                <div key={idx} style={{ fontSize: 13, color: "#7BD69B", marginBottom: idx < facts.length - 1 ? 4 : 0, display: "flex", alignItems: "center", gap: 6 }}><IconCheck size={12} /> {f}</div>
              ))}
            </div>
          )}

          {(prResults.weight.length + prResults.reps.length + prResults.volume.length) > 0 && (
            <div style={{ margin: "0 16px 14px", background: T.surface, border: "1px solid #FFD166", borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Personal records</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { key: "weight", label: "Weight", list: prResults.weight, unit },
                  { key: "reps", label: "Reps", list: prResults.reps, unit: "reps" },
                  { key: "volume", label: "Volume", list: prResults.volume, unit },
                ].map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => cat.list.length > 0 && setExpandedPR(expandedPR === cat.key ? null : cat.key)}
                    disabled={cat.list.length === 0}
                    style={{
                      flex: 1, background: expandedPR === cat.key ? "rgba(255,209,102,0.18)" : T.surface2,
                      border: `1px solid ${cat.list.length > 0 ? "#FFD166" : T.line}`, borderRadius: 10, padding: "10px 6px", textAlign: "center",
                      opacity: cat.list.length === 0 ? 0.4 : 1,
                    }}
                  >
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: cat.list.length > 0 ? "#FFD166" : T.dim }}>{cat.list.length}</div>
                    <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>{cat.label} PR{cat.list.length === 1 ? "" : "s"}</div>
                  </button>
                ))}
              </div>
              {expandedPR && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  {{ weight: prResults.weight, reps: prResults.reps, volume: prResults.volume }[expandedPR].map((pr, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "4px 0", borderTop: idx > 0 ? `1px solid ${T.line}` : "none" }}>
                      <span style={{ color: T.text }}>{pr.name}</span>
                      <span style={{ color: "#FFD166", fontWeight: 700 }}>
                        {expandedPR === "reps" ? `${pr.value} reps` : `${pr.value} ${unit}`}
                        {pr.previous > 0 && <span style={{ color: T.dim, fontWeight: 400 }}> (prev {pr.previous}{expandedPR === "reps" ? "" : " lb"})</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ flex: 1, padding: "0 16px 16px", overflowY: "auto" }}>
            {exerciseRows.map((row) => {
              if (!row) return null;
              const { w, i, exSets, bestToday, delta, hasHistory, isPR, twoForTwo } = row;
              return (
                <div key={i} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 19, fontWeight: 700, color: T.text }}>{w.name}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {isPR && <span style={{ fontSize: 11, fontWeight: 700, color: "#FFD166", border: "1px solid #FFD166", borderRadius: 999, padding: "2px 8px" }}>e1RM PR</span>}
                      {twoForTwo && <span style={{ fontSize: 11, fontWeight: 700, color: "#7BD69B", border: `1px solid ${T.green}`, borderRadius: 999, padding: "2px 8px" }}>Progress +2</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: T.dim, marginTop: 4 }}>
                    Best e1RM {Math.round(bestToday)} {unit}
                    {hasHistory && <span style={{ color: delta > 0.5 ? T.green : delta < -0.5 ? T.accent : T.dim }}> ({delta > 0 ? "+" : ""}{Math.round(delta)} vs last session)</span>}
                    {!hasHistory && <span> · first session on record</span>}
                  </div>
                  {w.notes && <div style={{ fontSize: 12, color: T.dim, fontStyle: "italic", marginTop: 4 }}>Note: {w.notes}</div>}
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                    {exSets.map((s, j) => (
                      <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.text }}>
                        <span style={{ color: s.isWarmup ? "#E8A82E" : T.dim }}>{s.isWarmup ? setLabels(exSets)[j] : `Set ${setLabels(exSets)[j]}${j >= w.planned ? " (extra)" : ""}`}</span>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600 }}>{s.weight} {unit} x {s.reps} <span style={{ color: T.dim, fontWeight: 400 }}>@ RIR {s.rir}</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {scorePref !== "none" && (
            <div style={{ background: T.surface, border: `1px dashed ${T.line}`, borderRadius: 12, padding: "10px 12px" }}>
              {scorePref === "percentile" ? (
                percentile === null ? (
                  <div style={{ fontSize: 12, color: T.dim }}>
                    Percentile needs more DeltaLog users with a completed lift and a full profile to be meaningful yet. Switch to DOTS in Settings for a formula-based score instead.
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: T.dim }}>
                    <span>DeltaLog percentile</span>
                    <span style={{ color: T.text, fontWeight: 700 }}>
                      {percentile === undefined ? "Calculating…" : <>{percentile}<span style={{ fontSize: 11, fontWeight: 400 }}>th</span></>}
                    </span>
                  </div>
                )
              ) : dots !== null ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: T.dim }}>
                  <span>DOTS score (best lift today)</span>
                  <span style={{ color: T.text, fontWeight: 700 }}>{dots} <span style={{ color: T.dim, fontWeight: 400 }}>· {band}</span></span>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: T.dim }}>
                  {profile && profile.gender === "Other"
                    ? "DOTS scoring isn't available for the gender option on your profile."
                    : "Add your gender and weight in Settings to see a DOTS strength score."}
                </div>
              )}
              <div style={{ fontSize: 10, color: T.dim, marginTop: 4 }}>
                {scorePref === "percentile"
                  ? "Computed from other DeltaLog users' all-time best lifts. Switch to DOTS in Settings for a formula-based score instead."
                  : "A rough, widely-used reference band, not a real percentile. Switch to DeltaLog Percentile in Settings to see how you rank against other users."}
              </div>
            </div>
            )}
          </div>
          <div style={{ padding: 16, borderTop: `1px solid ${T.line}`, background: T.surface }}>
            <button onClick={() => setShowExportImage(true)} style={{ width: "100%", padding: "13px 0", borderRadius: 14, border: `1px solid ${T.line}`, background: "none", color: T.text, fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Save as image</button>
            <button onClick={onFinished} style={{ width: "100%", padding: "15px 0", borderRadius: 14, border: "none", background: T.accent, color: "#fff", fontSize: 16, fontWeight: 700 }}>Done</button>
          </div>
        </div>
        {showExportImage && (
          <ExportWorkoutModal
            data={{
              dateLabel: dateStr,
              unit,
              totalSets,
              totalVolume,
              durationMin,
              bodyWeight: bodyWeightInput ? parseFloat(bodyWeightInput) : null,
              photoUrl: progressPhotoPreview || null,
              exercises: exerciseRows.filter(Boolean).map((row) => {
                const labels = setLabels(row.exSets);
                return {
                  name: row.w.short || row.w.name,
                  sets: row.exSets.map((s, j) => ({ label: labels[j], weight: s.weight, reps: s.reps, rir: s.rir, isWarmup: !!s.isWarmup })),
                };
              }),
            }}
            onClose={() => setShowExportImage(false)}
          />
        )}
      </div>
    );
  }

  // ---------- Post-workout capture (body weight + notes) ----------
  if (view === "postWorkout") {
    return (
      <div style={outer}>
        <style>{`${fontImport} button { cursor: pointer; } input:focus, textarea:focus { border-color: ${T.accent} !important; }`}</style>
        <div style={frame}>
          <div style={{ padding: "22px 16px 14px", borderBottom: `1px solid ${T.line}`, textAlign: "center" }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: T.text }}>NICE WORK</div>
            <div style={{ color: T.dim, fontSize: 13, marginTop: 2 }}>A couple quick things before you go.</div>
          </div>
          <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>
            <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Body weight ({(profile && profile.weight_unit) || getPrefs().units}) — optional</div>
            <input
              inputMode="decimal"
              value={bodyWeightInput}
              onChange={(e) => setBodyWeightInput(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="e.g. 178"
              style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, color: T.text, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 600, textAlign: "center", padding: "10px 8px", outline: "none", boxSizing: "border-box", marginBottom: 8 }}
            />
            <div style={{ fontSize: 11, color: T.dim, marginBottom: 20, lineHeight: 1.4 }}>
              Logging it here keeps your strength score sharp and updates your profile automatically. Leave it blank and we'll use your last recorded weight instead.
            </div>

            <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Progress photo — optional, private to you</div>
            {progressPhotoPreview ? (
              <div style={{ position: "relative", marginBottom: 20 }}>
                <img src={progressPhotoPreview} alt="Progress preview" style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 12, border: `1px solid ${T.line}` }} />
                <button
                  onClick={() => { setProgressPhotoFile(null); setProgressPhotoPreview(null); }}
                  aria-label="Remove photo"
                  style={{ position: "absolute", top: 8, right: 8, background: "rgba(16,18,22,0.8)", border: `1px solid ${T.line}`, color: T.text, borderRadius: 999, width: 28, height: 28, fontSize: 14 }}
                ><IconX size={13} /></button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                <label style={{ flex: 1, display: "block", padding: "14px 0", borderRadius: 12, border: `1px dashed ${T.line}`, textAlign: "center", color: T.dim, fontSize: 13, cursor: "pointer" }}>
                  <IconCamera size={14} /> Take Photo
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setProgressPhotoFile(f);
                      setProgressPhotoPreview(URL.createObjectURL(f));
                    }}
                    style={{ display: "none" }}
                  />
                </label>
                <label style={{ flex: 1, display: "block", padding: "14px 0", borderRadius: 12, border: `1px dashed ${T.line}`, textAlign: "center", color: T.dim, fontSize: 13, cursor: "pointer" }}>
                  <IconImage size={14} /> Choose from Library
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setProgressPhotoFile(f);
                      setProgressPhotoPreview(URL.createObjectURL(f));
                    }}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            )}
            <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Session notes — optional</div>
            <textarea
              value={sessionNotesInput}
              onChange={(e) => setSessionNotesInput(e.target.value)}
              placeholder="How did it feel? Anything to remember for next time?"
              rows={4}
              style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, color: T.text, fontSize: 14, padding: "10px 12px", outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }}
            />
          </div>
          <div style={{ padding: 16, borderTop: `1px solid ${T.line}`, background: T.surface }}>
            <button onClick={handleSavePostWorkout} disabled={savingSummary} style={{ width: "100%", padding: "16px 0", borderRadius: 14, border: "none", background: savingSummary ? T.surface2 : T.accent, color: savingSummary ? T.dim : "#fff", fontSize: 17, fontWeight: 700, letterSpacing: 0.3 }}>
              {savingSummary ? "Saving…" : "Save & Return Home"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Templates view ----------
  if (view === "templates") {
    return (
      <div style={outer}>
        <style>{`${fontImport} button { cursor: pointer; }`}</style>
        <div style={frame}>
          <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}>
            <button onClick={() => setView("workout")} aria-label="Back" style={smallBtn}>‹</button>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, color: T.text, textAlign: "center" }}>TEMPLATES</div>
            <div style={{ width: 26 }} />
          </div>
          <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>
            {templates === null && <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>Loading templates…</div>}
            {templates !== null && templates.length === 0 && (
              <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 20px", border: `1px dashed ${T.line}`, borderRadius: 12 }}>
                No templates yet. Build a workout, then use "Save as Template" from the workout menu.
              </div>
            )}
            {templates?.map((t) => (
              <div key={t.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: T.text }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>{t.exerciseCount} exercise{t.exerciseCount === 1 ? "" : "s"}</div>
                </div>
                <button onClick={() => loadTemplate(t)} disabled={loadingTemplateId === t.id} style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: T.accent, color: "#fff", fontSize: 14, fontWeight: 700 }}>
                  {loadingTemplateId === t.id ? "Loading…" : "Use"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------- Empty workout ----------
  if (workout.length === 0) {
    return (
      <div style={outer}>
        <style>{`${fontImport} button { cursor: pointer; }`}</style>
        <div style={frame} data-tutorial="empty-workout-screen">
          <div style={{ padding: "16px 16px 0" }}>
            <button onClick={() => { deleteWorkout(workoutId).catch(() => {}); clearSessionState(workoutId); onFinished(); }} aria-label="Back to home" style={smallBtn}>‹</button>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 24, textAlign: "center" }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: T.text }}>EMPTY WORKOUT</div>
            <div style={{ color: T.dim, fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>Build it yourself or let the generator put one together from your preferences.</div>
            <button onClick={() => setView("generator")} style={{ width: "100%", maxWidth: 280, marginTop: 24, padding: "15px 0", borderRadius: 14, border: "none", background: T.accent, color: "#fff", fontSize: 16, fontWeight: 700 }}><IconBolt size={14} /> Generate workout</button>
            <button onClick={openTemplates} style={{ width: "100%", maxWidth: 280, marginTop: 10, padding: "13px 0", borderRadius: 12, border: `1px solid ${T.line}`, background: "none", color: T.text, fontSize: 15 }}>Use a Template</button>
            <button onClick={() => setView("manage")} data-tutorial="add-manual-btn" style={{ width: "100%", maxWidth: 280, marginTop: 10, padding: "13px 0", borderRadius: 12, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 15 }}>Add exercises manually</button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Workout view ----------
  const setupSummary = ex.setupFields.filter((f) => ex.setup[f]).map((f) => `${f}: ${ex.setup[f]}`).join(" · ");
  const machineSetupSummary = ["Seat height", "Bar height", "Cable height"].filter((f) => ex.setup[f]).map((f) => `${f}: ${ex.setup[f]}`).join(" · ") || (ex.setup["_machineNotes"] ? "Notes saved" : "");
  function clearMachineSetup() {
    const nextSetup = { ...ex.setup };
    delete nextSetup["Seat height"]; delete nextSetup["Bar height"]; delete nextSetup["Cable height"]; delete nextSetup["_machineNotes"];
    setWorkout(workout.map((w, k) => (k === exIdx ? { ...w, setup: nextSetup } : w)));
    saveExerciseDefaults(user.id, ex.id, nextSetup, ex.notes).catch((err) => note(`Couldn't clear setup: ${err.message}`));
  }

  return (
    <div style={outer}>
      <style>{`
        ${fontImport}
        input:focus, textarea:focus { border-color: ${T.accent} !important; }
        button { cursor: pointer; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }
        .chipstrip::-webkit-scrollbar { display: none; }
      `}</style>
      <div style={wizardOpen ? { ...frame, height: "100vh", minHeight: "100vh", overflow: "hidden" } : frame}>
        {showMenu && (
          <div style={{ position: "absolute", inset: 0, background: T.bg, zIndex: 10, display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}>
              <button onClick={() => { setShowMenu(false); setFinishConfirm(false); }} aria-label="Close" style={smallBtn}>‹</button>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: T.text, textAlign: "center" }}>WORKOUT MENU</div>
              <div style={{ width: 26 }} />
            </div>
            <div style={{ padding: 16, flex: 1 }}>
              <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 16, textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Workout time</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 700, color: T.text }}>{hhmmss(elapsedSec)}</div>
              </div>

              <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Muscles worked, this session</div>
                {Object.keys(livePrimary).length === 0 && Object.keys(liveSecondary).length === 0 ? (
                  <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "12px 0" }}>Log a set to see it light up here.</div>
                ) : (
                  <BodyHeatmap primary={livePrimary} secondary={liveSecondary} fullBodySets={liveFullBodySets} />
                )}
              </div>

              {!finishConfirm ? (
                <button onClick={() => { setFinishConfirm(true); setCancelConfirm(false); }} style={{ width: "100%", padding: "16px 0", borderRadius: 14, border: "none", background: T.green, color: "#fff", fontSize: 17, fontWeight: 700, letterSpacing: 0.3 }}>Finish workout</button>
              ) : (
                <div style={{ background: T.surface, border: `1px solid ${T.accent}`, borderRadius: 14, padding: 14 }}>
                  <div style={{ color: T.text, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>End this workout?</div>
                  <div style={{ color: T.dim, fontSize: 13, marginBottom: 12 }}>
                    {allSets.flat().length} set{allSets.flat().length === 1 ? "" : "s"} logged. You can still review it after, but it'll be marked complete.
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => { setFinishConfirm(false); setOutlierReview(null); }} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 15 }}>Cancel</button>
                    <button onClick={handleFinishClick} style={{ flex: 2, padding: "12px 0", borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 15, fontWeight: 700 }}>Yes, finish</button>
                  </div>
                </div>
              )}

              {outlierReview && outlierReview.length > 0 && (
                <div style={{ marginTop: 12, background: T.surface, border: `1px solid ${T.accent}`, borderRadius: 14, padding: 14 }}>
                  <div style={{ color: T.text, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Double-check these sets</div>
                  <div style={{ color: T.dim, fontSize: 12.5, marginBottom: 10, lineHeight: 1.4 }}>
                    {outlierReview.length} set{outlierReview.length === 1 ? "" : "s"} logged {outlierReview.some((f) => f.direction === "high") && outlierReview.some((f) => f.direction === "low") ? "far off" : outlierReview[0].direction === "high" ? "much heavier than" : "much lighter than"} your other sets on that exercise — worth a quick look in case it's a typo or the wrong plates.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                    {outlierReview.map((f, idx) => (
                      <div key={idx} style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 2 }}>{f.name} · Set {f.setIdx + 1}</div>
                        <div style={{ fontSize: 12, color: T.dim, marginBottom: 8 }}>
                          Logged <b style={{ color: T.text }}>{f.weight} {unit} × {f.reps}</b>, {f.direction === "high" ? "well above" : "well below"} your usual ~{f.avg} {unit}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => dismissFlag(f)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 12.5 }}>Looks right</button>
                          <button onClick={() => editFlaggedSet(f)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: `1px solid ${T.accent}`, background: "rgba(232,68,46,0.1)", color: T.accent, fontSize: 12.5, fontWeight: 700 }}>Edit set</button>
                          <button onClick={() => deleteFlaggedSet(f)} aria-label="Delete set" title="Delete set" style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 12.5 }}><IconTrash size={13} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleConfirmFinish} style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 14, fontWeight: 700 }}>
                    Finish workout anyway
                  </button>
                </div>
              )}

              <button onClick={() => setView("manage")} style={{ width: "100%", marginTop: 10, padding: "14px 0", borderRadius: 14, border: `1px solid ${T.line}`, background: T.surface, color: T.text, fontSize: 15, fontWeight: 600 }}>Edit Workout</button>

              <button
                onClick={() => setShowWorkoutPrefs(!showWorkoutPrefs)}
                style={{ width: "100%", marginTop: 10, padding: "14px 0", borderRadius: 14, border: `1px solid ${T.line}`, background: T.surface, color: T.text, fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                Preferences {showWorkoutPrefs ? "▲" : "▼"}
              </button>
              {showWorkoutPrefs && (
                <div style={{ marginTop: 10 }}>
                  <Preferences fields={["units", "scientificNames", "weightEntryMode", "plateSizes"]} />
                </div>
              )}

              {!showSaveTemplate ? (
                <button
                  onClick={() => { setShowSaveTemplate(true); setTemplateSaved(false); }}
                  data-tutorial="save-template-btn"
                  style={{
                    width: "100%", marginTop: 10, padding: "14px 0", borderRadius: 14,
                    border: `1px solid ${templateSaved ? T.green : T.line}`,
                    background: templateSaved ? "rgba(59,165,93,0.12)" : T.surface,
                    color: templateSaved ? "#7BD69B" : T.text, fontSize: 15, fontWeight: 600,
                  }}
                >
                  {templateSaved ? <><IconCheck size={13} /> Saved as Template</> : "Save as Template"}
                </button>
              ) : (
                <div style={{ background: T.surface, border: `1px solid ${T.accent}`, borderRadius: 14, padding: 14, marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Template name</div>
                  <input
                    autoFocus
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g. Push Day A"
                    style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 14, padding: "8px 10px", outline: "none", boxSizing: "border-box", marginBottom: 10 }}
                  />
                  <button onClick={() => setTemplateIncludeDetails(!templateIncludeDetails)} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, marginBottom: 12, textAlign: "left", width: "100%" }}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, border: `1px solid ${templateIncludeDetails ? T.accent : T.line}`, background: templateIncludeDetails ? T.accent : "none", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12 }}>
                      {templateIncludeDetails && <IconCheck size={11} />}
                    </div>
                    <span style={{ fontSize: 13, color: T.text }}>Include current notes & setup for each exercise</span>
                  </button>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { setShowSaveTemplate(false); setTemplateName(""); }} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 14 }}>Cancel</button>
                    <button onClick={handleSaveTemplate} disabled={!templateName.trim() || savingTemplate} style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", background: !templateName.trim() || savingTemplate ? T.surface2 : T.accent, color: !templateName.trim() || savingTemplate ? T.dim : "#fff", fontSize: 14, fontWeight: 700 }}>
                      {savingTemplate ? "Saving…" : "Save Template"}
                    </button>
                  </div>
                </div>
              )}

              {!cancelConfirm ? (
                <button onClick={() => { setCancelConfirm(true); setFinishConfirm(false); }} style={{ width: "100%", marginTop: 10, padding: "14px 0", borderRadius: 14, border: `1px solid ${T.accent}`, background: "none", color: T.accent, fontSize: 15, fontWeight: 700 }}>Cancel workout</button>
              ) : (
                <div style={{ background: T.surface, border: `1px solid ${T.accent}`, borderRadius: 14, padding: 14, marginTop: 10 }}>
                  <div style={{ color: T.accent, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Discard this workout?</div>
                  <div style={{ color: T.dim, fontSize: 13, marginBottom: 12 }}>
                    {allSets.flat().length} set{allSets.flat().length === 1 ? "" : "s"} logged this session will be permanently deleted. This can't be undone.
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setCancelConfirm(false)} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 15 }}>Keep going</button>
                    <button onClick={handleConfirmCancel} disabled={cancelling} style={{ flex: 2, padding: "12px 0", borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 15, fontWeight: 700 }}>
                      {cancelling ? "Deleting…" : "Yes, discard it"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Top bar: scrollable strip + pinned pencil, always visible */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px 0" }}>
          <div ref={stripRef} className="chipstrip" style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", flex: 1 }}>
            {workout.map((w, i) => {
              const done = allSets[i].length >= w.planned;
              const active = i === exIdx;
              return (
                <button key={i} ref={(el) => (chipRefs.current[i] = el)} onClick={() => goTo(i)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, fontSize: 12, whiteSpace: "nowrap", border: `1px solid ${active ? T.accent : T.line}`, background: active ? "rgba(232,68,46,0.12)" : T.surface, color: active ? T.text : T.dim, flexShrink: 0 }}>
                  {done && <span style={{ color: T.green, fontWeight: 700 }}><IconCheck size={12} /></span>}
                  {w.short}
                  {!done && <span style={{ opacity: 0.7 }}>{allSets[i].length}/{w.planned}</span>}
                </button>
              );
            })}
          </div>
          <button onClick={() => setShowMenu(true)} data-tutorial="workout-menu-btn" aria-label="Workout menu" title="Timer, muscle map, finish workout" style={{ width: 32, height: 32, borderRadius: 999, border: `1px solid ${T.line}`, background: T.surface, color: T.dim, fontSize: 14, flexShrink: 0 }}><IconMenu size={16} /></button>
        </div>

        {/* Header */}
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.line}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => goTo(exIdx - 1)} style={arrowBtn(exIdx === 0)} aria-label="Previous exercise">‹</button>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, letterSpacing: 0.3, color: T.text, lineHeight: 1.1 }}>{ex.name}</div>
              <div style={{ color: T.dim, fontSize: 12, marginTop: 2 }}>Exercise {exIdx + 1} of {workout.length} · {exDone ? `${sets.length}/${planned} sets done` : `Set ${setNum} of ${planned}`}{ex.supersetGroup != null && <span style={{ color: T.accent, fontWeight: 700 }}> · Superset</span>}</div>
            </div>
            <button onClick={() => goTo(exIdx + 1)} style={arrowBtn(exIdx === workout.length - 1)} aria-label="Next exercise">›</button>
          </div>

          {!wizardOpen && (
          <>
          <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "center" }}>
            <button onClick={() => { setShowIdeology(!showIdeology); setShowTargetInfo(false); }} style={{ fontSize: 12, color: T.text, background: T.surface2, border: `1px solid ${showIdeology ? T.accent : T.line}`, borderRadius: 999, padding: "3px 10px", display: "flex", alignItems: "center", gap: 5 }}>
              {effIdeology} · {ideo.low}-{ideo.high} reps
              {ex.ideology && <span style={{ width: 5, height: 5, borderRadius: 3, background: T.accent, display: "inline-block" }} title="Override for this exercise" />}
              <span style={{ fontSize: 9, color: T.dim }}>▾</span>
            </button>
            <button onClick={() => { setShowTargetInfo(!showTargetInfo); setShowIdeology(false); }} style={{ fontSize: 12, color: T.dim, background: T.surface, border: `1px solid ${showTargetInfo ? T.accent : T.line}`, borderRadius: 999, padding: "3px 10px" }}>
              Target {target.weight} {unit} x {target.reps} <span style={{ fontSize: 9 }}>ⓘ</span>
            </button>
          </div>

          {showTargetInfo && (
            <div style={{ marginTop: 10, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: "10px 12px", fontSize: 12, color: T.dim, lineHeight: 1.5 }}>
              {target.anchored ? (
                <>Based on your best estimated 1RM of <b style={{ color: T.text }}>{target.baseE1RM} {unit}</b>, from {target.source.weight} {unit} x {target.source.reps} @ RIR {target.source.rir} last session. Scaled to {effIdeology}'s {ideo.low}-{ideo.high} rep range using {target.reps} reps as the working target.</>
              ) : (
                <>No session history yet, so this starts from the library default of {ex.targetWeight} {unit}, treated as a moderate hypertrophy effort (~{target.baseE1RM} {unit} estimated 1RM). Scaled to {effIdeology}'s {ideo.low}-{ideo.high} rep range. Log a session and this becomes personalized.</>
              )}
            </div>
          )}

          {showIdeology && (
            <div style={{ marginTop: 10, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: 8 }}>
              {Object.entries(IDEOLOGIES).map(([name, v]) => {
                const selected = effIdeology === name;
                return (
                  <button key={name} onClick={() => setExerciseIdeology(name)} style={{ display: "block", width: "100%", textAlign: "left", background: selected ? "rgba(232,68,46,0.12)" : "none", border: `1px solid ${selected ? T.accent : "transparent"}`, borderRadius: 8, padding: "8px 10px", marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{name} <span style={{ color: T.dim, fontWeight: 400 }}>· {v.low}-{v.high} reps</span></div>
                    <div style={{ fontSize: 12, color: T.dim, lineHeight: 1.4, marginTop: 2 }}>{v.desc}</div>
                  </button>
                );
              })}
              <div style={{ fontSize: 11, color: T.dim, padding: "4px 10px 2px", lineHeight: 1.4 }}>
                Applies to {ex.short} only. App default stays {globalIdeology} — change that from the main Preferences menu. Targets recalculate from your estimated 1RM either way.
              </div>
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            {!showMachineSetup ? (
              <div style={{ textAlign: "center" }}>
                <button onClick={() => setShowMachineSetup(true)} style={{ background: "none", border: "none", color: T.dim, fontSize: 12, padding: 0 }}>
                  {machineSetupSummary ? <><IconGear size={11} /> {machineSetupSummary}</> : <><IconGear size={11} /> Machine setup</>}
                </button>
              </div>
            ) : (
              <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>Machine setup</div>
                  {machineSetupSummary && <button onClick={clearMachineSetup} style={{ background: "none", border: "none", color: T.accent, fontSize: 11 }}>Clear</button>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 13, color: T.text, flex: 1 }}>Seat height</div>
                  {heightField("Seat height")}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 13, color: T.text, flex: 1 }}>Bar height</div>
                  {heightField("Bar height")}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 13, color: T.text, flex: 1 }}>Cable height</div>
                  {heightField("Cable height")}
                </div>
                <textarea
                  value={ex.setup["_machineNotes"] || ""}
                  onChange={(e) => updateSetup("_machineNotes", e.target.value)}
                  placeholder="Other setup details (pin position, attachment, etc.)"
                  rows={2}
                  style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 13, padding: 8, outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "inherit", marginTop: 2 }}
                />
                <div style={{ fontSize: 10, color: T.dim, marginTop: 4 }}>Saved per exercise, carries over session to session.</div>
                <div style={{ textAlign: "right", marginTop: 4 }}><button onClick={() => setShowMachineSetup(false)} aria-label="Done" style={smallBtn}><IconCheck size={12} /></button></div>
              </div>
            )}
          </div>

          {ex.setupFields.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {!showSetup ? (
                <div style={{ textAlign: "center" }}>
                  <button onClick={() => setShowSetup(true)} style={{ background: "none", border: "none", color: T.dim, fontSize: 12, padding: 0 }}>
                    {setupSummary ? <><IconGear size={11} /> {setupSummary}</> : <><IconGear size={11} /> Set up ({ex.setupFields.map((f) => f.toLowerCase()).join(", ")})</>}
                  </button>
                </div>
              ) : (
                <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>Equipment setup</div>
                    {setupSummary && <button onClick={clearSetup} style={{ background: "none", border: "none", color: T.accent, fontSize: 11 }}>Clear</button>}
                  </div>
                  {ex.setupFields.map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div style={{ fontSize: 13, color: T.text, flex: 1 }}>{f}</div>
                      <input value={ex.setup[f] || ""} onChange={(e) => updateSetup(f, e.target.value)} placeholder="—" style={{ width: 90, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "5px 8px", outline: "none", textAlign: "center", boxSizing: "border-box" }} />
                    </div>
                  ))}
                  <div style={{ fontSize: 10, color: T.dim, marginTop: 4 }}>Saved per exercise until you clear it.</div>
                  <div style={{ textAlign: "right", marginTop: 4 }}><button onClick={() => setShowSetup(false)} aria-label="Done" style={smallBtn}><IconCheck size={12} /></button></div>
                </div>
              )}
            </div>
          )}

          <div ref={noteAnchorRef} />
          {!editingNote ? (
            <div style={{ marginTop: 6, textAlign: "center", display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
              <button onClick={() => { setNoteDraft(ex.notes); setEditingNote(true); }} style={{ background: "none", border: "none", color: T.dim, fontSize: 12, fontStyle: ex.notes ? "italic" : "normal", padding: 0 }}>
                {ex.notes ? <>"{ex.notes}" <IconPencil size={11} /></> : "+ Add note"}
              </button>
              {ex.notes && <button onClick={deleteNote} style={{ background: "none", border: "none", color: T.accent, fontSize: 11, padding: 0 }}>Delete</button>}
            </div>
          ) : (
            <div style={{ marginTop: 6 }}>
              <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Cues, tempo, anything worth remembering..." rows={2} style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, color: T.text, fontSize: 13, padding: 8, outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
              <div style={{ fontSize: 10, color: T.dim, marginTop: 3 }}>Saved per exercise, persists across sessions until deleted.</div>
              <div style={{ display: "flex", gap: 6, marginTop: 6, justifyContent: "flex-end" }}>
                <button onClick={() => setEditingNote(false)} style={smallBtn}>Cancel</button>
                <button onClick={saveNote} style={{ ...smallBtn, color: T.text, borderColor: T.accent }}>Save note</button>
              </div>
            </div>
          )}
          </>
          )}
        </div>

        {restLeft > 0 && (
          <div data-tutorial="rest-timer-bar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.surface2, borderBottom: `1px solid ${T.line}`, padding: "10px 16px" }}>
            <div style={{ color: T.dim, fontSize: 13 }}>Rest</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: T.text }}>{mmss(restLeft)}</div>
            <button onClick={() => setRestEndsAt(null)} style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 12px", fontSize: 12 }}>Skip</button>
          </div>
        )}

        {!wizardOpen && flash && (
          <div style={{ margin: "12px 16px 0", padding: "10px 12px", borderRadius: 10, fontSize: 13, lineHeight: 1.4, background: flash.type === "progress" ? "rgba(59,165,93,0.12)" : T.surface2, border: `1px solid ${flash.type === "progress" ? T.green : T.line}`, color: flash.type === "progress" ? "#7BD69B" : T.text }}>{flash.msg}</div>
        )}

        {!wizardOpen && (
        <div key={exIdx} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ flex: 1, padding: "12px 16px", overflowY: "auto", animation: "slideIn 0.18s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>Last session</div>
            {lastWeek.length > 0 && <button onClick={copyAll} style={smallBtn}>Copy all</button>}
          </div>
          {lastWeek.length === 0 && (
            <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "12px 20px", border: `1px dashed ${T.line}`, borderRadius: 12, marginBottom: 8 }}>No history yet. Targets use the library default until you log a session.</div>
          )}
          {lastWeek.map((s, i) => <SetCard key={"lw" + i} s={s} label={setLabels(lastWeek)[i]} ghost unit={unit} actions={<button onClick={() => openWizard(s)} style={smallBtn}>Copy</button>} />)}
          <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, margin: "16px 0 8px" }}>Today</div>
          {sets.length === 0 && <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "16px 20px", border: `1px dashed ${T.line}`, borderRadius: 12 }}>No sets logged yet.</div>}
          {sets.map((s, i) => <SetCard key={i} s={s} label={setLabels(sets)[i]} comparison={lastWeek[i]} unit={unit} onToggleWarmup={() => toggleSetWarmup(exIdx, i)} actions={<button onClick={() => openWizard(s, i)} style={smallBtn}>Edit</button>} />)}
        </div>
        )}

        <div style={wizardOpen ? { borderTop: `1px solid ${T.line}`, background: T.surface, padding: 16, flex: 1, overflowY: "auto", minHeight: 0 } : { borderTop: `1px solid ${T.line}`, background: T.surface, padding: 16 }}>
          {!wizardOpen ? (
            <>
              {!exDone ? (
                <button onClick={() => openWizard()} data-tutorial="log-next-set" style={{ width: "100%", padding: "16px 0", borderRadius: 14, border: "none", background: T.accent, color: "#fff", fontSize: 17, fontWeight: 700, letterSpacing: 0.3 }}>Log next set</button>
              ) : (
                <>
                  {workoutDone ? (
                    <button onClick={() => setShowMenu(true)} style={{ width: "100%", padding: "16px 0", borderRadius: 14, border: "none", background: T.green, color: "#fff", fontSize: 17, fontWeight: 700, letterSpacing: 0.3 }}>Finish workout</button>
                  ) : (
                    <button onClick={() => goTo(workout.findIndex((w, i) => allSets[i].length < w.planned))} style={{ width: "100%", padding: "16px 0", borderRadius: 14, border: "none", background: T.green, color: "#fff", fontSize: 17, fontWeight: 700, letterSpacing: 0.3 }}>
                      Next exercise: {workout[workout.findIndex((w, i) => allSets[i].length < w.planned)].short} →
                    </button>
                  )}
                  <button onClick={() => openWizard()} style={{ width: "100%", marginTop: 8, padding: "12px 0", borderRadius: 12, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 14, fontWeight: 600 }}>Add another set</button>
                </>
              )}
              {bestE1RM > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 13 }}>
                  <span style={{ color: T.dim }}>Best e1RM today: <b style={{ color: T.text }}>{Math.round(bestE1RM)} {unit}</b></span>
                  <span style={{ color: T.dim }}>Percentile: <span style={{ filter: "blur(4px)" }}>94th</span> — calibrating</span>
                </div>
              )}
            </>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{editIndex !== null ? `Editing set ${editIndex + 1}` : `Set ${setNum}`}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {editIndex === null && lastLogged && <button onClick={() => fillFrom(lastLogged)} style={smallBtn}>Same as previous set</button>}
                  {editIndex === null && lastWeek[sets.length] && <button onClick={() => fillFrom(lastWeek[sets.length])} style={smallBtn}>Same as last session</button>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Weight ({unit})</div>
                  <input
                    ref={weightRef}
                    inputMode="decimal"
                    value={weight}
                    onChange={(e) => { setWeight(e.target.value.replace(/[^0-9.]/g, "")); setLoaded([]); }}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); repsRef.current && repsRef.current.focus(); } }}
                    style={{ ...inputStyle, borderColor: highlightMissing.weight ? T.accent : T.line, boxShadow: highlightMissing.weight ? `0 0 0 2px rgba(232,68,46,0.3)` : "none" }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Reps</div>
                  <input
                    ref={repsRef}
                    inputMode="numeric"
                    value={reps}
                    onChange={(e) => setReps(e.target.value.replace(/[^0-9]/g, ""))}
                    onFocus={(e) => e.target.select()}
                    style={{ ...inputStyle, borderColor: highlightMissing.reps ? T.accent : T.line, boxShadow: highlightMissing.reps ? `0 0 0 2px rgba(232,68,46,0.3)` : "none" }}
                  />
                </div>
              </div>
              <button onClick={() => setShowCalc(!showCalc)} data-tutorial="plate-calc-toggle" style={{ marginTop: 12, width: "100%", padding: "12px 0", borderRadius: 12, border: `1px solid ${showCalc ? T.accent : T.line}`, background: showCalc ? "rgba(232,68,46,0.1)" : T.surface2, color: T.text, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <IconBarbell size={15} /> {showCalc ? "Hide plate calculator" : "Plate calculator"}
              </button>
              {showCalc && (
                <div style={{ marginTop: 10, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 12, color: T.dim, lineHeight: 1.5, marginBottom: 10 }}>
                    Type your target weight above, then tap <b style={{ color: T.text }}>Optimize loading</b> below to see exactly what to put on the bar.
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ fontSize: 12, color: T.dim }}>Starting weight</div>
                      <button onClick={() => setShowBarInfo(!showBarInfo)} aria-label="What's starting weight?" style={{ width: 16, height: 16, borderRadius: 999, border: `1px solid ${T.dim}`, background: "none", color: T.dim, fontSize: 10, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }}>i</button>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {BAR_PRESETS[unit].map((b) => (
                        <button key={b} onClick={() => { setBarMode(b); setWeight(String(b + 2 * stackSum)); saveStartingWeight(b); }} style={{ padding: "4px 12px", borderRadius: 8, fontSize: 12, border: `1px solid ${barMode === b ? T.accent : T.line}`, background: barMode === b ? "rgba(232,68,46,0.12)" : "none", color: barMode === b ? T.text : T.dim }}>{b} {unit}</button>
                      ))}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input inputMode="decimal" placeholder="Custom" value={customBar}
                          onFocus={() => { setBarMode("custom"); const nb = parseFloat(customBar) || 0; setWeight(String(nb + 2 * stackSum)); }}
                          onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); setCustomBar(v); setBarMode("custom"); const nb = parseFloat(v) || 0; setWeight(String(nb + 2 * stackSum)); }}
                          onBlur={() => saveStartingWeight(parseFloat(customBar) || 0)}
                          style={{ width: 62, padding: "4px 8px", borderRadius: 8, fontSize: 12, border: `1px solid ${barMode === "custom" ? T.accent : T.line}`, background: barMode === "custom" ? "rgba(232,68,46,0.12)" : "none", color: T.text, outline: "none", textAlign: "center", boxSizing: "border-box" }} />
                        {customBar && <span style={{ fontSize: 11, color: T.dim }}>{unit}</span>}
                      </div>
                    </div>
                  </div>
                  {showBarInfo && (
                    <div style={{ fontSize: 12, color: T.dim, lineHeight: 1.5, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
                      Starting weight is the empty weight of whatever you're loading: the bar, both machine arms combined, a trap bar, or an EZ curl bar. Use 0 for plate-loaded machines with no bar weight of their own. Plates you add below count once per side, and the diagram mirrors them on both ends. Or type a target weight above and tap Optimize loading to fill the bar with the fewest plates.
                    </div>
                  )}
                  <button
                    onClick={autoLoad}
                    data-tutorial="optimize-loading-btn"
                    style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 15, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  >
                    <IconBolt size={14} /> Optimize loading
                  </button>
                  <div style={{ display: "flex", alignItems: "center", height: 104, marginBottom: 8 }}>
                    {/* Left half — mirrors the right, outermost plate furthest from center */}
                    <div style={{ display: "flex", alignItems: "center", flex: 1, justifyContent: "flex-end" }}>
                      <div style={{ height: 8, width: 24, background: "#565C68", borderRadius: 2 }} />
                      {[...loaded].reverse().map((v, i) => { const p = plateByValue(unit, v); return <div key={i} onClick={() => removePlate(loaded.length - 1 - i)} title={`${v} ${unit} — tap to remove`} style={{ height: p.h, width: p.w, background: p.color, borderRadius: 3, marginRight: 2, border: p.dark ? "1px solid #3A404B" : "none", cursor: "pointer" }} />; })}
                      <div style={{ height: 26, width: 8, background: "#565C68", borderRadius: 2, marginRight: 2 }} />
                    </div>
                    {/* Center grip */}
                    <div style={{ height: 10, width: 46, background: "#3A404B", borderRadius: 2, flexShrink: 0 }} />
                    {/* Right half */}
                    <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
                      <div style={{ height: 26, width: 8, background: "#565C68", borderRadius: 2, marginLeft: 2 }} />
                      {loaded.map((v, i) => { const p = plateByValue(unit, v); return <div key={i} onClick={() => removePlate(i)} title={`${v} ${unit} — tap to remove`} style={{ height: p.h, width: p.w, background: p.color, borderRadius: 3, marginLeft: 2, border: p.dark ? "1px solid #3A404B" : "none", cursor: "pointer" }} />; })}
                      <div style={{ height: 8, width: 24, background: "#565C68", borderRadius: 2, marginLeft: 2 }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: T.text, minHeight: 18, textAlign: "center" }}>
                    {loaded.length > 0 ? <>Per side: {loaded.join(" + ")} · Total <b>{barWeight + 2 * stackSum} {unit}</b> <span style={{ color: T.dim, fontSize: 11 }}>(tap a plate to remove)</span></> : <span style={{ color: T.dim }}>No plates loaded · starting weight {barWeight > 0 ? `${barWeight} ${unit}` : "not set"}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", justifyContent: "center" }}>
                    {availablePlates(unit, ex && ex.muscle).map((p) => (
                      <button key={p.value} onClick={() => addPlate(p.value)} style={{ padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: p.dark ? "1px solid #3A404B" : "none", background: p.color, color: (unit === "lb" && p.value === 35) || (unit === "kg" && p.value === 15) ? "#1A1D23" : "#fff" }}>+{p.value}</button>
                    ))}
                    <button onClick={clearPlates} style={smallBtn}>Clear</button>
                  </div>
                </div>
              )}
              <div style={{ marginTop: 14, ...(highlightMissing.rir ? { background: "rgba(232,68,46,0.1)", borderRadius: 12, padding: 8, margin: "14px -8px 0" } : {}) }}>
                <div style={{ fontSize: 11, color: highlightMissing.rir ? T.accent : T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontWeight: highlightMissing.rir ? 700 : 400 }}>
                  Reps in reserve{highlightMissing.rir ? " — pick one" : ""}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[0, 1, 2, 3, 4].map((v) => (
                    <button key={v} onClick={() => { setRir(v); setHighlightMissing((h) => ({ ...h, rir: false })); }} style={{ flex: 1, padding: "12px 0", borderRadius: 10, fontSize: 17, fontWeight: 700, border: `1px solid ${rir === v ? T.accent : (highlightMissing.rir ? T.accent : T.line)}`, background: rir === v ? "rgba(232,68,46,0.15)" : T.surface2, color: rir === v ? T.text : T.dim }}>{v === 4 ? "4+" : v}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button onClick={() => { setWizardOpen(false); setShowCalc(false); setEditIndex(null); }} style={{ flex: 1, padding: "14px 0", borderRadius: 12, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 15 }}>Cancel</button>
                <button onClick={saveSet} data-tutorial="log-set-submit" style={{ flex: 2, padding: "14px 0", borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 16, fontWeight: 700 }}>
                  {editIndex !== null ? "Save changes" : "Log set"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
