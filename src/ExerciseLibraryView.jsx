import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { fetchExerciseLibrary, updateExercise, fetchMuscleGroups, fetchMuscleDetailed, fetchMuscleTaxonomy, createSharedExercise, uploadExerciseMedia, fetchExerciseDefaults, saveExerciseDefaults, fetchExerciseHistory } from "./lib/queries";
import { muscleLabel, genericBucket } from "./lib/muscleNomenclature";
import { MUSCLE_COLORS } from "./lib/muscleColors";
import { summarizeExerciseHistory, bucketSeries } from "./lib/volume";
import { getPrefs } from "./lib/prefs";
import { toDisplay } from "./lib/weight";
import { toLocalDateStr } from "./lib/time";
import ExerciseThumb from "./ExerciseThumb";
import { InlineLoading } from "./LoadingSpinner";
import MuscleTaxonomyManager from "./MuscleTaxonomyManager";
import CustomExerciseModal from "./CustomExerciseModal";
import MyCustomExercises from "./MyCustomExercises";
import { IconX, IconGear, IconPencil, IconCheck } from "./Icons";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

const smallBtn = { background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 11 };
const pillAddBtn = { width: 26, height: 26, borderRadius: "50%", border: `1px solid ${T.accent}`, background: "none", color: T.accent, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, cursor: "pointer", flexShrink: 0 };
const filledPill = { display: "flex", alignItems: "center", gap: 6, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 999, padding: "5px 6px 5px 12px" };
const candidatePill = { background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 999, padding: "5px 12px", fontSize: 12, cursor: "pointer" };

const MACHINE_SETUP_FIELDS = ["Seat height", "Bar height", "Cable height", "Arm setting"];

// Personal, per-user notes + machine setup for one exercise -- the same
// exercise_defaults row SetLogger reads/writes mid-workout, edited here
// standalone so it doesn't require an active workout. Fetched fresh per
// exercise since exercise_defaults isn't preloaded into the library list.
function ExerciseDefaultsEditor({ userId, exercise }) {
  const [loaded, setLoaded] = useState(false);
  const [setup, setSetupState] = useState({});
  const [notes, setNotesState] = useState("");
  const [showMachineSetup, setShowMachineSetup] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    fetchExerciseDefaults(userId, exercise.id)
      .then((d) => { if (!cancelled) { setSetupState(d.setup || {}); setNotesState(d.notes || ""); setLoaded(true); } })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [userId, exercise.id]);

  function persist(nextSetup, nextNotes) {
    saveExerciseDefaults(userId, exercise.id, nextSetup, nextNotes).catch((e) => setErr(e.message));
  }
  function updateSetup(field, val) {
    const next = { ...setup, [field]: val };
    setSetupState(next);
    persist(next, notes);
  }
  function clearMachineSetup() {
    const next = { ...setup };
    for (const f of MACHINE_SETUP_FIELDS) delete next[f];
    delete next["_machineNotes"];
    setSetupState(next);
    persist(next, notes);
  }
  function clearCustomSetup() {
    setSetupState({});
    persist({}, notes);
  }
  function saveNote() {
    const trimmed = noteDraft.trim();
    setNotesState(trimmed);
    setEditingNote(false);
    persist(setup, trimmed);
  }
  function deleteNote() {
    setNotesState("");
    setEditingNote(false);
    persist(setup, "");
  }
  function heightField(field) {
    const isText = !!setup[`${field}__text`];
    const val = setup[field] || "";
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
          title={isText ? "Switch to numeric" : 'Switch to text, e.g. "top notch"'}
          style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${T.line}`, background: isText ? "rgba(232,68,46,0.12)" : "none", color: isText ? T.text : T.dim, fontSize: 10, fontWeight: 700, padding: 0, flexShrink: 0 }}
        >{isText ? "Abc" : "#"}</button>
      </>
    );
  }

  if (!loaded) return <InlineLoading label="Loading your setup…" padding="16px 0" />;

  const setupFields = exercise.setup_fields || [];
  const setupSummary = setupFields.filter((f) => setup[f]).map((f) => `${f}: ${setup[f]}`).join(" · ");
  const machineSetupSummary = MACHINE_SETUP_FIELDS.filter((f) => setup[f]).map((f) => `${f}: ${setup[f]}`).join(" · ") || (setup["_machineNotes"] ? "Notes saved" : "");

  return (
    <div style={{ marginTop: 4, paddingTop: 16, borderTop: `1px solid ${T.line}` }}>
      <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Your notes & setup</div>
      {err && <div style={{ color: T.accent, fontSize: 12, marginBottom: 8 }}>{err}</div>}

      <div style={{ marginBottom: 8 }}>
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
            {MACHINE_SETUP_FIELDS.map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 13, color: T.text, flex: 1 }}>{f}</div>
                {heightField(f)}
              </div>
            ))}
            <textarea
              value={setup["_machineNotes"] || ""}
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

      {setupFields.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {!showSetup ? (
            <div style={{ textAlign: "center" }}>
              <button onClick={() => setShowSetup(true)} style={{ background: "none", border: "none", color: T.dim, fontSize: 12, padding: 0 }}>
                {setupSummary ? <><IconGear size={11} /> {setupSummary}</> : <><IconGear size={11} /> Set up ({setupFields.map((f) => f.toLowerCase()).join(", ")})</>}
              </button>
            </div>
          ) : (
            <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>Equipment setup</div>
                {setupSummary && <button onClick={clearCustomSetup} style={{ background: "none", border: "none", color: T.accent, fontSize: 11 }}>Clear</button>}
              </div>
              {setupFields.map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 13, color: T.text, flex: 1 }}>{f}</div>
                  <input value={setup[f] || ""} onChange={(e) => updateSetup(f, e.target.value)} placeholder="—" style={{ width: 90, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "5px 8px", outline: "none", textAlign: "center", boxSizing: "border-box" }} />
                </div>
              ))}
              <div style={{ fontSize: 10, color: T.dim, marginTop: 4 }}>Saved per exercise until you clear it.</div>
              <div style={{ textAlign: "right", marginTop: 4 }}><button onClick={() => setShowSetup(false)} aria-label="Done" style={smallBtn}><IconCheck size={12} /></button></div>
            </div>
          )}
        </div>
      )}

      {!editingNote ? (
        <div style={{ textAlign: "center", display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
          <button onClick={() => { setNoteDraft(notes); setEditingNote(true); }} style={{ background: "none", border: "none", color: T.dim, fontSize: 12, fontStyle: notes ? "italic" : "normal", padding: 0 }}>
            {notes ? <>"{notes}" <IconPencil size={11} /></> : "+ Add note"}
          </button>
          {notes && <button onClick={deleteNote} style={{ background: "none", border: "none", color: T.accent, fontSize: 11, padding: 0 }}>Delete</button>}
        </div>
      ) : (
        <div>
          <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Cues, tempo, anything worth remembering..." rows={2} style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, color: T.text, fontSize: 13, padding: 8, outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
          <div style={{ fontSize: 10, color: T.dim, marginTop: 3 }}>Saved per exercise, persists across sessions until deleted.</div>
          <div style={{ display: "flex", gap: 6, marginTop: 6, justifyContent: "flex-end" }}>
            <button onClick={() => setEditingNote(false)} style={smallBtn}>Cancel</button>
            <button onClick={saveNote} style={{ ...smallBtn, color: T.text, borderColor: T.accent }}>Save note</button>
          </div>
        </div>
      )}
    </div>
  );
}

const CHART_RANGES = [
  { key: "7d", label: "7 Days", days: 7 },
  { key: "30d", label: "30 Days", days: 30 },
  { key: "90d", label: "90 Days", days: 90 },
  { key: "365d", label: "1 Year", days: 365 },
];

function chartCutoffDate(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toLocalDateStr(d);
}

function miniChartXTick(d, rangeKey) {
  return rangeKey === "365d" ? new Date(`${d}-01T00:00:00`).toLocaleString(undefined, { month: "short" }) : d.slice(5);
}
function miniChartLabel(d, rangeKey) {
  if (rangeKey === "365d") return new Date(`${d}-01T00:00:00`).toLocaleString(undefined, { month: "long", year: "numeric" });
  if (rangeKey === "30d") return `Week of ${new Date(`${d}T00:00:00`).toLocaleString(undefined, { month: "short", day: "numeric" })}`;
  return new Date(`${d}T00:00:00`).toLocaleString(undefined, { month: "short", day: "numeric" });
}

// One mini line chart, reused for weight/reps/volume below -- same visual
// language as the Home screen's Volume/Bodyweight charts.
function MiniChart({ title, data, dataKey, color, unitLabel, rangeKey, emptyLabel }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 8px 8px", marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, padding: "0 8px" }}>{title}</div>
      {data.length === 0 ? (
        <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>{emptyLabel}</div>
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={data} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid stroke={T.line} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: T.dim, fontSize: 10 }} tickFormatter={(d) => miniChartXTick(d, rangeKey)} />
            <YAxis tick={{ fill: T.dim, fontSize: 10 }} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: T.text }}
              labelFormatter={(d) => miniChartLabel(d, rangeKey)}
              formatter={(v) => [unitLabel ? `${v.toLocaleString()} ${unitLabel}` : v.toLocaleString(), title]}
            />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// Per-exercise weight/reps/volume history, fetched once per exercise and
// re-bucketed client-side as the range toggle changes (no refetch needed
// switching between 7/30/90/365 day views).
function ExerciseCharts({ userId, exercise }) {
  const [loaded, setLoaded] = useState(false);
  const [raw, setRaw] = useState({ weight: [], reps: [], volume: [] });
  const [rangeIdx, setRangeIdx] = useState(1);
  const units = getPrefs().units;
  const rangeDef = CHART_RANGES[rangeIdx];

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    fetchExerciseHistory(userId, exercise.id)
      .then((rows) => { if (!cancelled) { setRaw(summarizeExerciseHistory(rows)); setLoaded(true); } })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [userId, exercise.id]);

  const cutoff = chartCutoffDate(rangeDef.days);

  const weightSeries = useMemo(() => {
    const points = raw.weight.filter((p) => p.date >= cutoff && p.weight > 0).map((p) => ({ date: p.date, weight: Math.round(toDisplay(p.weight, units) * 10) / 10 }));
    return bucketSeries(points, rangeDef.key, "weight", "avg");
  }, [raw.weight, rangeDef.key, cutoff, units]);

  const repsSeries = useMemo(() => {
    const points = raw.reps.filter((p) => p.date >= cutoff && p.reps > 0);
    return bucketSeries(points, rangeDef.key, "reps", "avg");
  }, [raw.reps, rangeDef.key, cutoff]);

  const volumeSeries = useMemo(() => {
    const points = raw.volume.filter((p) => p.date >= cutoff && p.volume > 0).map((p) => ({ date: p.date, volume: Math.round(toDisplay(p.volume, units)) }));
    return bucketSeries(points, rangeDef.key, "volume", "sum");
  }, [raw.volume, rangeDef.key, cutoff, units]);

  return (
    <div style={{ marginTop: 4, paddingTop: 16, borderTop: `1px solid ${T.line}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px", marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>Your history</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => setRangeIdx((i) => Math.max(0, i - 1))}
            disabled={rangeIdx === 0}
            aria-label="Shorter range"
            style={{ background: "none", border: "none", color: rangeIdx === 0 ? T.line : T.dim, fontSize: 16, padding: "0 4px" }}
          >‹</button>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, minWidth: 62, textAlign: "center" }}>{rangeDef.label}</div>
          <button
            onClick={() => setRangeIdx((i) => Math.min(CHART_RANGES.length - 1, i + 1))}
            disabled={rangeIdx === CHART_RANGES.length - 1}
            aria-label="Longer range"
            style={{ background: "none", border: "none", color: rangeIdx === CHART_RANGES.length - 1 ? T.line : T.dim, fontSize: 16, padding: "0 4px" }}
          >›</button>
        </div>
      </div>

      {!loaded ? (
        <InlineLoading label="Loading your history…" padding="24px 0" />
      ) : (
        <>
          <MiniChart title="Top set weight" data={weightSeries} dataKey="weight" color={T.accent} unitLabel={units} rangeKey={rangeDef.key} emptyLabel="No sets logged for this exercise in this range." />
          <MiniChart title="Reps" data={repsSeries} dataKey="reps" color="#3BA55D" unitLabel={null} rangeKey={rangeDef.key} emptyLabel="No sets logged for this exercise in this range." />
          <MiniChart title="Volume" data={volumeSeries} dataKey="volume" color="#5B8DEF" unitLabel={units} rangeKey={rangeDef.key} emptyLabel="No sets logged for this exercise in this range." />
        </>
      )}
    </div>
  );
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{label}</div>
      <div style={{ color: T.text, fontSize: 14 }}>{value}</div>
    </div>
  );
}

// Pill-based tagger for one muscle slot (primary or secondary). Selected
// scientific muscles render as filled removable pills; the trailing "+"
// pill toggles an inline row of outlined candidate pills (every taxonomy
// entry not already selected) -- tap one to add it. Replaces the old
// dropdown-select-plus-Add-button pattern entirely.
function MusclePillPicker({ title, selected, taxonomy, onAdd, onRemove, taxonomyLabel }) {
  const [open, setOpen] = useState(false);
  const candidates = (taxonomy || []).filter((t) => !selected.includes(t.scientific_name));
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {selected.map((m) => (
          <div key={m} style={filledPill}>
            <span style={{ color: T.text, fontSize: 12 }}>{taxonomyLabel(m)}</span>
            <button onClick={() => onRemove(m)} aria-label={`Remove ${m}`} style={{ background: "none", border: "none", color: T.dim, padding: 0, display: "flex" }}><IconX size={12} /></button>
          </div>
        ))}
        <button onClick={() => setOpen((o) => !o)} aria-label={`Add a ${title.toLowerCase()}`} style={pillAddBtn}>+</button>
      </div>
      {open && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, padding: 10, background: T.surface2, borderRadius: 10 }}>
          {candidates.length === 0 && <div style={{ color: T.dim, fontSize: 12 }}>Nothing left to add.</div>}
          {candidates.map((t) => (
            <button key={t.scientific_name} onClick={() => onAdd(t.scientific_name)} style={candidatePill}>{taxonomyLabel(t.scientific_name)}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// Single Exercise Library screen for everyone. Regular users get a
// read-only browse + detail view (no edit button, no taxonomy button).
// Admins get the same list plus an Edit button per row and a Taxonomy
// button in the header -- editing writes straight to the shared
// `exercises` table via updateExercise and is live for every user the
// moment it saves, no separate sync step. Admin only ever tags the
// Scientific muscle for primary/secondary; Detailed and Generic are
// derived through the taxonomy, and every display mode reads that
// derivation via muscleLabel -- there's nothing else to set by hand.
// Formats a raw primary/secondary muscle tag list at whatever precision
// the person has chosen in Training Preferences, collapsing duplicates
// that only arise because multiple raw tags collapse to the same label
// at that precision (e.g. three scientific-tier tags for different
// heads of the triceps, all displayed as "Triceps" in Detailed mode) --
// otherwise a case like Cable Overhead Tricep Extension would show
// "Triceps, Triceps, Triceps" instead of just "Triceps".
function formatMuscleList(muscles, mode) {
  const labels = (muscles || []).map((m) => muscleLabel(m, mode));
  return [...new Set(labels)].join(", ");
}


export default function ExerciseLibraryView({ muscleNameMode, onClose, isAdmin, userId }) {
  const [exercises, setExercises] = useState(undefined); // undefined = loading
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null); // read-only detail sheet (non-admin)
  const [browseGroup, setBrowseGroup] = useState(null); // null = tile grid; "ALL" or a generic group narrows in
  const [browseDetail, setBrowseDetail] = useState(null); // null = detail-tile grid (within a group); "ALL" or a detailed muscle narrows to the list

  const [muscleGroups, setMuscleGroups] = useState(undefined);
  const [muscleDetailed, setMuscleDetailed] = useState(undefined);
  const [taxonomy, setTaxonomy] = useState(undefined);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showTaxonomy, setShowTaxonomy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showMyCustom, setShowMyCustom] = useState(false);

  function load() {
    fetchExerciseLibrary(isAdmin).then(setExercises).catch((err) => setError(err.message));
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isAdmin) return;
    reloadTaxonomyData();
  }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Level 2 shows whichever granular level is currently selected —
  // Region or Anatomy. Category is fully represented by the level 1
  // buckets already, so anyone in Category mode still gets Region names
  // one level down rather than an undefined state.
  const level2Mode = muscleNameMode === "generic" ? "detailed" : muscleNameMode;

  const q = search.trim().toLowerCase();
  const filtered = (exercises || []).filter((ex) => {
    if (browseGroup && browseGroup !== "ALL") {
      const inGroup = ex.muscle_group === browseGroup || (ex.primary_muscles || []).some((m) => genericBucket(m) === browseGroup);
      if (!inGroup) return false;
      if (browseDetail && browseDetail !== "ALL") {
        const detailedNames = (ex.primary_muscles || []).map((m) => muscleLabel(m, level2Mode));
        if (!detailedNames.includes(browseDetail)) return false;
      }
    }
    if (!q) return true;
    if (ex.name.toLowerCase().includes(q)) return true;
    return (ex.aliases || []).some((a) => a.toLowerCase().includes(q));
  });

  // Level 2 tiles for the second browse layer -- derived straight from
  // this group's exercises rather than a separate fetch, so regular
  // (non-admin) users get real tiles without needing taxonomy access.
  const detailOptions = browseGroup && browseGroup !== "ALL"
    ? [...new Set(
        (exercises || [])
          .filter((ex) => ex.muscle_group === browseGroup || (ex.primary_muscles || []).some((m) => genericBucket(m) === browseGroup))
          .flatMap((ex) => (ex.primary_muscles || []).map((m) => muscleLabel(m, level2Mode)))
      )].sort()
    : [];

  function pickGroup(m) {
    setBrowseGroup(m);
    setBrowseDetail(null);
  }
  function backFromList() {
    if (browseGroup === "ALL") {
      setBrowseGroup(null);
    } else {
      setBrowseDetail(null);
    }
    setSearch("");
  }

  function taxonomyLabel(scientificName) {
    const entry = (taxonomy || []).find((t) => t.scientific_name === scientificName);
    if (!entry) return scientificName;
    return entry.specific_name && entry.specific_name !== entry.detailed_name
      ? `${entry.scientific_name} (${entry.specific_name})`
      : `${entry.scientific_name} (${entry.detailed_name})`;
  }

  function startEdit(ex) {
    setEditingId(ex.id);
    setDraft({
      name: ex.name,
      equipment: (ex.equipment || []).join(", "),
      primaryMuscles: [...(ex.primary_muscles || [])],
      secondaryMuscles: [...(ex.secondary_muscles || [])],
    });
    setError(null);
  }

  const editingExercise = editingId ? (exercises || []).find((e) => e.id === editingId) : null;
  const computedMuscleGroup = draft && draft.primaryMuscles.length > 0
    ? ((taxonomy || []).find((t) => t.scientific_name === draft.primaryMuscles[0])?.generic_group || editingExercise?.muscle_group || "")
    : (editingExercise?.muscle_group || "");

  async function saveDraft() {
    setSaving(true);
    setError(null);
    try {
      const equipmentList = draft.equipment.split(",").map((s) => s.trim()).filter(Boolean);
      await updateExercise(editingId, {
        name: draft.name.trim(),
        equipment: equipmentList,
        muscleGroup: computedMuscleGroup,
        primaryMuscles: draft.primaryMuscles,
        secondaryMuscles: draft.secondaryMuscles,
      });
      setExercises((prev) => prev.map((ex) => (ex.id === editingId ? {
        ...ex,
        name: draft.name.trim(),
        equipment: equipmentList,
        muscle_group: computedMuscleGroup,
        primary_muscles: draft.primaryMuscles,
        secondary_muscles: draft.secondaryMuscles,
      } : ex)));
      setEditingId(null);
      setDraft(null);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  function addPrimary(name) {
    if (draft.primaryMuscles.includes(name)) return;
    setDraft({ ...draft, primaryMuscles: [...draft.primaryMuscles, name] });
  }
  function removePrimary(name) {
    setDraft({ ...draft, primaryMuscles: draft.primaryMuscles.filter((m) => m !== name) });
  }
  function addSecondary(name) {
    if (draft.secondaryMuscles.includes(name)) return;
    setDraft({ ...draft, secondaryMuscles: [...draft.secondaryMuscles, name] });
  }
  function removeSecondary(name) {
    setDraft({ ...draft, secondaryMuscles: draft.secondaryMuscles.filter((m) => m !== name) });
  }

  function reloadTaxonomyData() {
    fetchMuscleGroups().then(setMuscleGroups).catch(() => setMuscleGroups([]));
    fetchMuscleDetailed().then(setMuscleDetailed).catch(() => setMuscleDetailed([]));
    fetchMuscleTaxonomy().then(setTaxonomy).catch(() => setTaxonomy([]));
  }

  async function handleCreateShared({ name, muscle, primaryMuscles, secondaryMuscles, equipment, photoFile }) {
    let mediaUrl = null;
    if (photoFile) mediaUrl = await uploadExerciseMedia(userId, photoFile);
    const row = await createSharedExercise({ name, muscle, primaryMuscles, secondaryMuscles, equipment, mediaUrl });
    setExercises((prev) => [row, ...(prev || [])]);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 30, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 420, minHeight: "100vh", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: isAdmin ? "auto 1fr auto auto" : "auto 1fr auto", alignItems: "center", gap: 8, position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
          <button onClick={onClose} aria-label="Close" style={smallBtn}>&#8249;</button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.text, textAlign: "center" }}>EXERCISE LIBRARY</div>
          {isAdmin && <button onClick={() => setShowTaxonomy(true)} aria-label="Manage muscle taxonomy" style={smallBtn}>Taxonomy</button>}
          {isAdmin ? (
            <button onClick={() => setShowCreate(true)} aria-label="New shared exercise" style={{ ...smallBtn, color: T.accent, borderColor: T.accent }}>+ New</button>
          ) : (
            <div style={{ width: 26 }} />
          )}
        </div>

        <div style={{ padding: 16, flex: 1, boxSizing: "border-box", minWidth: 0 }}>
          {error && <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: T.surface2, border: `1px solid ${T.accent}`, color: T.accent, fontSize: 13, boxSizing: "border-box" }}>{error}</div>}

          {browseGroup === null ? (
            <>
              <div style={{ color: T.dim, fontSize: 12, marginBottom: 12 }}>Browse by muscle group, or view everything.</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                {Object.keys(MUSCLE_COLORS).filter((m) => m !== "Full Body").map((m) => (
                  <button
                    key={m}
                    onClick={() => pickGroup(m)}
                    style={{ padding: "22px 10px", borderRadius: 14, border: `1px solid ${T.line}`, background: T.surface, color: T.text, fontSize: 15, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5 }}
                  >
                    {muscleLabel(m, "generic")}
                  </button>
                ))}
              </div>
              <button
                onClick={() => pickGroup("ALL")}
                style={{ width: "100%", padding: "16px 10px", borderRadius: 14, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 15, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5, boxSizing: "border-box" }}
              >
                View All
              </button>
              <button
                onClick={() => setShowMyCustom(true)}
                style={{ width: "100%", padding: "14px 10px", borderRadius: 14, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 13, fontWeight: 600, marginTop: 10, boxSizing: "border-box" }}
              >
                My Custom Exercises
              </button>
            </>
          ) : browseGroup !== "ALL" && browseDetail === null ? (
            <>
              <button onClick={() => setBrowseGroup(null)} style={{ ...smallBtn, marginBottom: 12 }}>&#8249; {muscleLabel(browseGroup, "generic")}</button>
              <div style={{ color: T.dim, fontSize: 12, marginBottom: 12 }}>Narrow down further, or view all {muscleLabel(browseGroup, "generic")} exercises.</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                {detailOptions.map((d) => (
                  <button
                    key={d}
                    onClick={() => setBrowseDetail(d)}
                    style={{ padding: "18px 10px", borderRadius: 14, border: `1px solid ${T.line}`, background: T.surface, color: T.text, fontSize: 14, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5 }}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setBrowseDetail("ALL")}
                style={{ width: "100%", padding: "16px 10px", borderRadius: 14, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 15, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5, boxSizing: "border-box" }}
              >
                View All {muscleLabel(browseGroup, "generic")}
              </button>
            </>
          ) : (
            <>
              <button onClick={backFromList} style={{ ...smallBtn, marginBottom: 12 }}>
                &#8249; {browseGroup === "ALL" ? "All Exercises" : (browseDetail === "ALL" ? muscleLabel(browseGroup, "generic") : browseDetail)}
              </button>
              <input
                autoComplete="off"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search exercises or nicknames..."
                style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "8px 10px", outline: "none", boxSizing: "border-box", marginBottom: 12 }}
              />

              {exercises === undefined && <InlineLoading />}
              {exercises && filtered.length === 0 && <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>No matches.</div>}

              {filtered.map((ex) => {
                const missing = isAdmin && ((ex.primary_muscles || []).length === 0 || !ex.muscle_group || (ex.secondary_muscles || []).length === 0);
                return (
                  <div
                    key={ex.id}
                    onClick={() => setSelected(ex)}
                    style={{ width: "100%", boxSizing: "border-box", textAlign: "left", background: T.surface, border: `1px solid ${missing ? T.accent : T.line}`, borderRadius: 12, padding: 12, marginBottom: 8, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                  >
                    <ExerciseThumb muscle={ex.muscle_group} mediaUrl={ex.media_url} size={26} />
                    <div style={{ flex: 1, minWidth: 0, color: T.text, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ex.name}{ex.archived ? <span style={{ color: T.dim, fontWeight: 400 }}> (archived)</span> : ""}
                    </div>
                    {isAdmin ? (
                      <button onClick={(e) => { e.stopPropagation(); startEdit(ex); }} style={{ ...smallBtn, flexShrink: 0 }}>Edit</button>
                    ) : (
                      <div style={{ color: T.dim, fontSize: 16, flexShrink: 0 }}>&rsaquo;</div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.8)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 420, maxHeight: "85vh", overflowY: "auto", background: T.bg, borderTop: `1px solid ${T.line}`, borderRadius: "20px 20px 0 0", padding: 20, boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <ExerciseThumb muscle={selected.muscle_group} mediaUrl={selected.media_url} size={36} />
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 19, fontWeight: 700, color: T.text }}>{selected.name}</div>
            </div>

            <DetailRow label="Nicknames" value={(selected.aliases || []).join(", ")} />
            <DetailRow label="Equipment" value={(selected.equipment || []).join(", ")} />
            <DetailRow label="Muscle group" value={muscleLabel(selected.muscle_group, "generic")} />
            <DetailRow label="Primary muscles" value={formatMuscleList(selected.primary_muscles, muscleNameMode)} />
            <DetailRow label="Secondary muscles" value={formatMuscleList(selected.secondary_muscles, muscleNameMode)} />

            {userId && <ExerciseDefaultsEditor userId={userId} exercise={selected} />}
            {userId && <ExerciseCharts userId={userId} exercise={selected} />}

            <button onClick={() => setSelected(null)} style={{ width: "100%", marginTop: 8, padding: "12px 0", borderRadius: 12, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 14, fontWeight: 600 }}>Close</button>
          </div>
        </div>
      )}

      {isAdmin && editingExercise && draft && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.8)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 420, maxHeight: "88vh", overflowY: "auto", background: T.bg, borderTop: `1px solid ${T.line}`, borderRadius: "20px 20px 0 0", padding: 20, boxSizing: "border-box" }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 4 }}>Edit exercise</div>
            <div style={{ color: T.dim, fontSize: 12, marginBottom: 16 }}>Changes here affect every user immediately.</div>

            <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Name</div>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 14, padding: "10px 12px", outline: "none", boxSizing: "border-box", marginBottom: 14 }}
            />

            <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Equipment (comma separated)</div>
            <input
              value={draft.equipment}
              onChange={(e) => setDraft({ ...draft, equipment: e.target.value })}
              placeholder="e.g. Barbell, Bench"
              style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 14, padding: "10px 12px", outline: "none", boxSizing: "border-box", marginBottom: 14 }}
            />

            <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Muscle group (auto, from primary)</div>
            <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: computedMuscleGroup ? T.text : T.accent, fontSize: 14, padding: "10px 12px", marginBottom: 16, boxSizing: "border-box" }}>
              {computedMuscleGroup || "No primary muscle tagged yet"}
            </div>

            <MusclePillPicker
              title="Primary muscles (scientific)"
              selected={draft.primaryMuscles}
              taxonomy={taxonomy}
              onAdd={addPrimary}
              onRemove={removePrimary}
              taxonomyLabel={taxonomyLabel}
            />

            <MusclePillPicker
              title="Secondary muscles (scientific)"
              selected={draft.secondaryMuscles}
              taxonomy={taxonomy}
              onAdd={addSecondary}
              onRemove={removeSecondary}
              taxonomyLabel={taxonomyLabel}
            />

            {error && <div style={{ color: T.accent, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setEditingId(null); setDraft(null); }} disabled={saving} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 14 }}>Cancel</button>
              <button onClick={saveDraft} disabled={saving || !draft.name.trim()} style={{ flex: 2, padding: "12px 0", borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 14, fontWeight: 700 }}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {showMyCustom && (
        <MyCustomExercises
          user={{ id: userId }}
          onClose={() => { setShowMyCustom(false); load(); }}
        />
      )}

      {isAdmin && showTaxonomy && (
        <MuscleTaxonomyManager
          muscleGroups={muscleGroups}
          muscleDetailed={muscleDetailed}
          taxonomy={taxonomy}
          onReload={reloadTaxonomyData}
          onClose={() => setShowTaxonomy(false)}
        />
      )}

      {isAdmin && showCreate && (
        <CustomExerciseModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreateShared}
          scientificMode
        />
      )}
    </div>
  );
}
