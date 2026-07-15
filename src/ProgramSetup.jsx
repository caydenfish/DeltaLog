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
import Logo from "./Logo";

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

// Same PillRow/InfoBox pattern as SetupWizard.jsx (the new-user onboarding
// flow) -- this wizard is meant to feel like an extension of that one
// rather than a different, more form-like UI bolted on next to it.
function PillRow({ options, value, onChange, columns }) {
  return (
    <div style={{ display: "flex", flexWrap: columns ? "wrap" : "nowrap", background: T.surface2, borderRadius: 12, padding: 4, gap: 4 }}>
      {options.map((opt) => (
        <button
          key={String(opt.key)}
          onClick={() => onChange(opt.key)}
          style={{
            flex: columns ? `1 1 calc(${100 / columns}% - 4px)` : 1,
            padding: "14px 6px", borderRadius: 9, fontSize: 14, fontWeight: 700, border: "none",
            background: value === opt.key ? T.accent : "transparent",
            color: value === opt.key ? "#fff" : T.dim,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function InfoBox({ children }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginTop: 18, fontSize: 13, color: T.dim, lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

export default function ProgramSetup({ user, onClose, onCreated }) {
  const [step, setStep] = useState(0);
  const [trainingFocus, setTrainingFocus] = useState("Hypertrophy");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [experienceLevel, setExperienceLevel] = useState(null);
  const [suggestedExperience, setSuggestedExperience] = useState(null);
  const [customize, setCustomize] = useState(false);
  const [durationWeeks, setDurationWeeks] = useState(6);
  const [splitName, setSplitName] = useState(null);
  const [progressionOverride, setProgressionOverride] = useState(null); // null = recommended per Training Focus

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

  // Keeps the default split in sync with days/week whenever someone
  // hasn't opted into Customize (which lets them pick a split by hand).
  useEffect(() => {
    if (!customize && splitOptions.length) setSplitName(defaultSplitForDays(daysPerWeek, splitOptions));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysPerWeek, customize]);

  // Regenerates the auto-picked exercise list whenever the inputs that
  // determine it change.
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
        durationWeeks: customize ? durationWeeks : 6,
        daysPerWeek,
        splitName,
      });
      const rows = [];
      let position = 0;
      dayLabels.forEach((_, dayIndex) => {
        (picksByDay[dayIndex] || []).forEach((ex) => {
          rows.push({ exerciseId: ex.id, position: position++, dayIndex, plannedSets: 3, progressionModel: customize ? progressionOverride : null });
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

  const exercisesBody = (
    <div>
      {dayLabels.map((label, dayIndex) => {
        const picks = picksByDay[dayIndex] || [];
        const buckets = getSplits()[label] || [];
        const q = (addSearch[dayIndex] || "").toLowerCase();
        const searchResults = q
          ? rawLibrary.filter((r) => buckets.includes(r.muscle_group) && r.name.toLowerCase().includes(q) && !picks.some((p) => p.id === r.id)).slice(0, 6)
          : [];
        return (
          <div key={dayIndex} style={{ marginBottom: 16 }}>
            <div style={{ color: T.text, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Day {dayIndex + 1}: {label}</div>
            {picks.length === 0 && <div style={{ color: T.dim, fontSize: 12, marginBottom: 6 }}>No exercises picked yet.</div>}
            {picks.map((ex) => (
              <div key={ex.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", marginBottom: 6 }}>
                <span style={{ color: T.text, fontSize: 13 }}>{ex.short || ex.name}</span>
                <button onClick={() => removePick(dayIndex, ex.id)} aria-label={`Remove ${ex.name}`} style={{ background: "none", border: "none", color: T.dim, fontSize: 16 }}>×</button>
              </div>
            ))}
            <input
              value={addSearch[dayIndex] || ""}
              onChange={(e) => setAddSearch((prev) => ({ ...prev, [dayIndex]: e.target.value }))}
              placeholder={`Add another ${label} exercise…`}
              style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 9, color: T.text, fontSize: 13, padding: "10px 12px", boxSizing: "border-box" }}
            />
            {searchResults.map((r) => (
              <button key={r.id} onClick={() => addPick(dayIndex, r)} style={{ display: "block", width: "100%", textAlign: "left", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 9, padding: "10px 12px", marginTop: 6, color: T.text, fontSize: 13 }}>
                + {r.short || r.name}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );

  const steps = [
    {
      title: "Training Focus",
      subtitle: "Sets your rep ranges and default progression style for the whole program.",
      body: (
        <>
          <PillRow options={Object.keys(IDEOLOGIES).map((k) => ({ key: k, label: k }))} value={trainingFocus} onChange={setTrainingFocus} />
          <InfoBox>{IDEOLOGIES[trainingFocus].desc}</InfoBox>
        </>
      ),
    },
    {
      title: "Days per week",
      subtitle: "How many days can you train?",
      body: <PillRow options={[2, 3, 4, 5, 6].map((n) => ({ key: n, label: String(n) }))} value={daysPerWeek} onChange={setDaysPerWeek} columns={5} />,
    },
    {
      title: "Experience level",
      subtitle: suggestedExperience
        ? `Based on your logging history, we'd guess ${suggestedExperience} — tap to change it.`
        : "How experienced are you with lifting?",
      body: <PillRow options={EXPERIENCE_LEVELS.map((l) => ({ key: l, label: l }))} value={experienceLevel} onChange={setExperienceLevel} />,
    },
    {
      title: "Customize the details?",
      subtitle: "Quick Start uses sensible defaults for length, split, and progression style.",
      body: <PillRow options={[{ key: false, label: "Quick Start" }, { key: true, label: "Customize" }]} value={customize} onChange={setCustomize} />,
    },
    ...(customize
      ? [
          {
            title: "Program length",
            subtitle: "Last week of the block is a built-in deload.",
            body: <PillRow options={DURATIONS.map((w) => ({ key: w, label: `${w}wk` }))} value={durationWeeks} onChange={setDurationWeeks} columns={4} />,
          },
          {
            title: "Split",
            subtitle: "Which days train which muscle groups.",
            body: <PillRow options={splitOptions.map((s) => ({ key: s, label: s }))} value={splitName} onChange={setSplitName} />,
          },
          {
            title: "Progression model",
            subtitle: "How your weight and reps advance week to week.",
            body: (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={() => setProgressionOverride(null)}
                  style={{ textAlign: "left", padding: "14px 14px", borderRadius: 12, border: `1px solid ${progressionOverride === null ? T.accent : T.line}`, background: progressionOverride === null ? "rgba(232,68,46,0.1)" : T.surface, color: T.text, fontSize: 14, fontWeight: 600 }}
                >
                  Recommended (per Training Focus)
                </button>
                {Object.entries(PROGRESSION_MODELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setProgressionOverride(key)}
                    style={{ textAlign: "left", padding: "14px 14px", borderRadius: 12, border: `1px solid ${progressionOverride === key ? T.accent : T.line}`, background: progressionOverride === key ? "rgba(232,68,46,0.1)" : T.surface, color: T.text, fontSize: 14, fontWeight: 600 }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ),
          },
        ]
      : []),
    {
      title: "Your exercises",
      subtitle: `${totalPicked} auto-picked per muscle group — add or remove anything below.`,
      body: exercisesBody,
      wide: true,
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  function handleNext() {
    if (isLast) handleCreate();
    else setStep(step + 1);
  }

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <InlineLoading />
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, overflowY: "auto", background: T.bg, display: "flex", flexDirection: "column", padding: 24, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <button
          onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
          aria-label={step === 0 ? "Close" : "Back"}
          style={{ width: 32, height: 32, borderRadius: 999, border: `1px solid ${T.line}`, background: T.surface, color: T.dim, fontSize: 14 }}
        >
          {step === 0 ? "×" : "‹"}
        </button>
        <Logo size={36} />
        <div style={{ width: 32 }} />
      </div>

      <div style={{ display: "flex", gap: 5, marginBottom: 28 }}>
        {steps.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? T.accent : T.line }} />
        ))}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: current.wide ? "flex-start" : "center", maxWidth: 380, width: "100%", margin: "0 auto" }}>
        <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, textAlign: "center" }}>
          Step {step + 1} of {steps.length}
        </div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: T.text, textAlign: "center", marginBottom: 6 }}>
          {current.title}
        </div>
        <div style={{ color: T.dim, fontSize: 13, textAlign: "center", marginBottom: 24, lineHeight: 1.5 }}>
          {current.subtitle}
        </div>
        {current.body}
      </div>

      <div style={{ width: "100%", maxWidth: 380, margin: "0 auto", paddingTop: 16 }}>
        <button
          onClick={handleNext}
          disabled={saving || (isLast && totalPicked === 0)}
          style={{ width: "100%", padding: "16px 0", borderRadius: 14, border: "none", background: T.accent, color: "#fff", fontSize: 16, fontWeight: 700, opacity: saving || (isLast && totalPicked === 0) ? 0.6 : 1 }}
        >
          {saving ? "Building…" : isLast ? "Create Program" : "Continue"}
        </button>
      </div>
    </div>
  );
}
