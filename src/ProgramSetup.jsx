import { useState, useEffect } from "react";
import { fetchExerciseLibrary, fetchPerformedExerciseIds } from "./lib/queries";
import { getSplits } from "./lib/splits";
import { IDEOLOGIES } from "./lib/ideologies";
import { createProgram, addProgramExercises, fetchTotalSessionCount } from "./lib/programQueries";
import {
  dayLabelsForSplit,
  defaultSplitForDays,
  SPLIT_ROTATIONS,
  autoPickExercisesForDay,
  perBucketForExperience,
  suggestExperienceLevel,
  PROGRESSION_MODELS,
} from "./lib/programEngine";
import { InlineLoading } from "./LoadingSpinner";
import { IconX } from "./Icons";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

const EXPERIENCE_LEVELS = ["Beginner", "Intermediate", "Advanced"];
const DURATIONS = [4, 6, 8, 12];

function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginTop: 18 }}>{children}</div>;
}

function PillRow({ options, value, onChange, renderLabel }) {
  return (
    <div style={{ display: "flex", background: T.surface2, borderRadius: 10, padding: 3, gap: 3 }}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          style={{
            flex: 1, padding: "8px 4px", borderRadius: 7, fontSize: 12, fontWeight: 600, border: "none",
            background: value === opt ? T.accent : "transparent",
            color: value === opt ? "#fff" : T.dim,
          }}
        >
          {renderLabel ? renderLabel(opt) : opt}
        </button>
      ))}
    </div>
  );
}

export default function ProgramSetup({ user, onClose, onCreated }) {
  const [mode, setMode] = useState("quick"); // quick | custom
  const [trainingFocus, setTrainingFocus] = useState("Hypertrophy");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [durationWeeks, setDurationWeeks] = useState(6);
  const [splitName, setSplitName] = useState(null); // null until library loads and a default is derived
  const [progressionOverride, setProgressionOverride] = useState(null); // null = use the training-focus default
  const [experienceLevel, setExperienceLevel] = useState(null);
  const [suggestedExperience, setSuggestedExperience] = useState(null);

  const [loading, setLoading] = useState(true);
  const [rawLibrary, setRawLibrary] = useState([]);
  const [performedIds, setPerformedIds] = useState(new Set());
  const [picksByDay, setPicksByDay] = useState({}); // { dayIndex: [rawExerciseRow, ...] }
  const [addSearch, setAddSearch] = useState({}); // { dayIndex: "search text" }
  const [saving, setSaving] = useState(false);

  const splitOptions = Object.keys(SPLIT_ROTATIONS).filter((name) => dayLabelsForSplit(name).every((label) => getSplits()[label]));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [lib, performed, totalSessions] = await Promise.all([
          fetchExerciseLibrary(false),
          fetchPerformedExerciseIds(user.id),
          fetchTotalSessionCount(user.id),
        ]);
        if (cancelled) return;
        setRawLibrary(lib);
        setPerformedIds(performed);
        const suggestion = suggestExperienceLevel(totalSessions);
        setSuggestedExperience(suggestion);
        setExperienceLevel(suggestion || "Beginner");
        setSplitName(defaultSplitForDays(3, splitOptions));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // Re-derives the default split whenever days/week changes in Quick Start
  // (Custom leaves whatever the person picked alone).
  useEffect(() => {
    if (mode === "quick" && splitOptions.length) setSplitName(defaultSplitForDays(daysPerWeek, splitOptions));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysPerWeek, mode]);

  // Regenerates the auto-picked exercise list whenever the inputs that
  // determine it change. Manual add/remove edits are intentionally not
  // preserved across a regeneration -- changing split/experience/focus is
  // rare enough mid-setup that reflowing cleanly beats partial staleness.
  useEffect(() => {
    if (!splitName || rawLibrary.length === 0) return;
    const labels = dayLabelsForSplit(splitName);
    const perBucket = perBucketForExperience(experienceLevel || "Beginner");
    const next = {};
    labels.forEach((label, i) => {
      const buckets = getSplits()[label] || [];
      next[i] = autoPickExercisesForDay(rawLibrary, buckets, performedIds, perBucket);
    });
    setPicksByDay(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitName, experienceLevel, rawLibrary]);

  function removePick(dayIndex, exerciseId) {
    setPicksByDay((prev) => ({ ...prev, [dayIndex]: (prev[dayIndex] || []).filter((e) => e.id !== exerciseId) }));
  }

  function addPick(dayIndex, ex) {
    setPicksByDay((prev) => ({ ...prev, [dayIndex]: [...(prev[dayIndex] || []), ex] }));
    setAddSearch((prev) => ({ ...prev, [dayIndex]: "" }));
  }

  async function handleCreate() {
    setSaving(true);
    try {
      const dayLabels = dayLabelsForSplit(splitName);
      const programId = await createProgram(user.id, {
        trainingFocus,
        experienceLevel: experienceLevel || "Beginner",
        durationWeeks: mode === "quick" ? 6 : durationWeeks,
        daysPerWeek,
        splitName,
      });
      const rows = [];
      let position = 0;
      dayLabels.forEach((_, dayIndex) => {
        (picksByDay[dayIndex] || []).forEach((ex) => {
          rows.push({ exerciseId: ex.id, position: position++, dayIndex, plannedSets: 3, progressionModel: progressionOverride });
        });
      });
      if (rows.length > 0) await addProgramExercises(programId, rows);
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  const dayLabels = splitName ? dayLabelsForSplit(splitName) : [];
  const totalPicked = Object.values(picksByDay).reduce((sum, arr) => sum + (arr?.length || 0), 0);

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 2000, display: "flex", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26 }} />
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, color: T.text, textAlign: "center" }}>BUILD A PROGRAM</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: T.dim, justifySelf: "end" }}><IconX size={20} /></button>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><InlineLoading /></div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
              <div style={{ marginTop: 16 }}>
                <PillRow options={["quick", "custom"]} value={mode} onChange={setMode} renderLabel={(o) => (o === "quick" ? "Quick Start" : "Custom")} />
              </div>

              <SectionLabel>Training Focus</SectionLabel>
              <PillRow options={Object.keys(IDEOLOGIES)} value={trainingFocus} onChange={setTrainingFocus} />
              <div style={{ color: T.dim, fontSize: 11, marginTop: 6 }}>{IDEOLOGIES[trainingFocus].desc}</div>

              <SectionLabel>Days per week</SectionLabel>
              <PillRow options={[2, 3, 4, 5, 6]} value={daysPerWeek} onChange={setDaysPerWeek} />

              <SectionLabel>Experience level</SectionLabel>
              <PillRow options={EXPERIENCE_LEVELS} value={experienceLevel} onChange={setExperienceLevel} />
              {suggestedExperience && (
                <div style={{ color: T.dim, fontSize: 11, marginTop: 6 }}>
                  Based on your logging history, we'd guess <b style={{ color: T.text }}>{suggestedExperience}</b>. Tap to change it.
                </div>
              )}

              {mode === "custom" && (
                <>
                  <SectionLabel>Program length</SectionLabel>
                  <PillRow options={DURATIONS} value={durationWeeks} onChange={setDurationWeeks} renderLabel={(w) => `${w}wk`} />
                  <div style={{ color: T.dim, fontSize: 11, marginTop: 6 }}>Last week of the block is a built-in deload.</div>

                  <SectionLabel>Split</SectionLabel>
                  <PillRow options={splitOptions} value={splitName} onChange={setSplitName} />

                  <SectionLabel>Progression model</SectionLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <button
                      onClick={() => setProgressionOverride(null)}
                      aria-pressed={progressionOverride === null}
                      style={{ textAlign: "left", padding: "10px 12px", borderRadius: 10, border: `1px solid ${progressionOverride === null ? T.accent : T.line}`, background: progressionOverride === null ? "rgba(232,68,46,0.1)" : T.surface, color: T.text, fontSize: 13 }}
                    >
                      Recommended (per Training Focus)
                    </button>
                    {Object.entries(PROGRESSION_MODELS).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setProgressionOverride(key)}
                        aria-pressed={progressionOverride === key}
                        style={{ textAlign: "left", padding: "10px 12px", borderRadius: 10, border: `1px solid ${progressionOverride === key ? T.accent : T.line}`, background: progressionOverride === key ? "rgba(232,68,46,0.1)" : T.surface, color: T.text, fontSize: 13 }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <SectionLabel>Exercises ({totalPicked} auto-picked, adjust below)</SectionLabel>
              {dayLabels.map((label, dayIndex) => {
                const picks = picksByDay[dayIndex] || [];
                const buckets = getSplits()[label] || [];
                const q = (addSearch[dayIndex] || "").toLowerCase();
                const searchResults = q
                  ? rawLibrary.filter((r) => buckets.includes(r.muscle_group) && r.name.toLowerCase().includes(q) && !picks.some((p) => p.id === r.id)).slice(0, 6)
                  : [];
                return (
                  <div key={dayIndex} style={{ marginBottom: 14 }}>
                    <div style={{ color: T.text, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Day {dayIndex + 1}: {label}</div>
                    {picks.length === 0 && <div style={{ color: T.dim, fontSize: 12, marginBottom: 6 }}>No exercises picked yet.</div>}
                    {picks.map((ex) => (
                      <div key={ex.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px", marginBottom: 6 }}>
                        <span style={{ color: T.text, fontSize: 13 }}>{ex.short || ex.name}</span>
                        <button onClick={() => removePick(dayIndex, ex.id)} aria-label={`Remove ${ex.name}`} style={{ background: "none", border: "none", color: T.dim, fontSize: 16 }}>×</button>
                      </div>
                    ))}
                    <input
                      value={addSearch[dayIndex] || ""}
                      onChange={(e) => setAddSearch((prev) => ({ ...prev, [dayIndex]: e.target.value }))}
                      placeholder={`Add another ${label} exercise…`}
                      style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "8px 10px", boxSizing: "border-box" }}
                    />
                    {searchResults.map((r) => (
                      <button key={r.id} onClick={() => addPick(dayIndex, r)} style={{ display: "block", width: "100%", textAlign: "left", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px", marginTop: 6, color: T.text, fontSize: 13 }}>
                        + {r.short || r.name}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>

            <div style={{ padding: 16, borderTop: `1px solid ${T.line}` }}>
              <button
                onClick={handleCreate}
                disabled={saving || totalPicked === 0}
                style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontWeight: 700, fontSize: 15, opacity: saving || totalPicked === 0 ? 0.6 : 1 }}
              >
                {saving ? "Building…" : "Create Program"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
