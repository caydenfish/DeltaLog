import { useState, useEffect } from "react";
import { fetchExercises, fetchPerformedExerciseIds, fetchFavoriteExerciseIds, setFavoriteExercise } from "./lib/queries";
import { getPrefs } from "./lib/prefs";
import ExercisePicker, { filterLibrary, splitGroupFor } from "./ExercisePicker";
import { useDragReorder, InsertionLine } from "./DragReorder";
import { IconX, IconDragHandle } from "./Icons";
import { getSplits, getSplitExclusions } from "./lib/splits";
import { IDEOLOGIES } from "./lib/ideologies";
import { createProgram, addProgramExercises, fetchTotalSessionCount } from "./lib/programQueries";
import {
  dayLabelsForSplit,
  expandDayLabelsForWeek,
  defaultSplitForDays,
  SPLIT_ROTATIONS,
  SPLIT_DESCRIPTIONS,
  EXPERIENCE_LEVEL_DESCRIPTIONS,
  autoPickExercisesForDay,
  perBucketForDay,
  suggestExperienceLevel,
  defaultModelForFocus,
  PROGRESSION_MODELS,
  PROGRESSION_MODEL_DESCRIPTIONS,
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

const smallBtn = { background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 11 };

const EXPERIENCE_LEVELS = ["Beginner", "Intermediate", "Advanced"];
const DURATIONS = [4, 6, 8, 12];

const EMPTY_DAY_FILTERS = { search: "", muscleFilter: [], equipFilter: [], performedFilter: "all", sourceFilter: "all", showFilters: false };

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

// One collapsible-free section per training day on the "Your exercises"
// step -- same visual language as Templates.jsx's template builder
// ("edit workout" page): a drag-reorderable pick list (drag handle,
// name, Replace, Remove) with a planned-sets stepper under each row,
// then a full ExercisePicker (search, Filters panel with split/muscle/
// equipment/history chips, Favorites/Previously performed/Unperformed
// sections) to add more. Each day gets its own picker filter state --
// unlike Templates (which only ever builds one list and so shares one
// filter state between its single Add panel and Replace sheet), three
// simultaneous day sections filtering independently is the more useful
// default here; a Push-day muscle filter carrying over to the Pull-day
// picker would be surprising.
function DaySection({ dayIndex, label, picks, onReorder, onRemove, onAdjustSets, onOpenReplace, filters, onFiltersChange, candidates, onPick, onToggleFavorite }) {
  const drag = useDragReorder(onReorder);
  const applySplit = (splitName) => {
    const mode = getPrefs().muscleNameMode;
    const group = splitGroupFor(splitName, mode);
    const isActive = group.length > 0 && group.length === filters.muscleFilter.length && group.every((m) => filters.muscleFilter.includes(m));
    onFiltersChange({ muscleFilter: isActive ? [] : group });
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
        {picks.length} exercise{picks.length === 1 ? "" : "s"}
      </div>

      {picks.length === 0 && <div style={{ color: T.dim, fontSize: 12, marginBottom: 8 }}>No exercises picked yet -- add some below.</div>}

      <div style={{ marginBottom: 10 }}>
        {picks.map((p, i) => (
          <div
            key={p.id}
            ref={(el) => (drag.rowRefs.current[i] = el)}
            style={{ position: "relative", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 10, marginBottom: 6, opacity: drag.dragIndex === i ? 0.5 : 1 }}
          >
            <InsertionLine drag={drag} i={i} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                <div
                  onPointerDown={(e) => drag.startRowDrag(i, e)}
                  aria-label="Drag to reorder"
                  title="Drag to reorder"
                  style={{ cursor: "grab", color: T.dim, fontSize: 16, padding: "2px", touchAction: "none", flexShrink: 0, display: "flex", alignItems: "center" }}
                ><IconDragHandle size={14} /></div>
                <div style={{ color: T.text, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.short || p.name}</div>
              </div>
              <button onClick={() => onOpenReplace(p.id)} aria-label={`Replace ${p.name}`} title="Replace" style={{ ...smallBtn, marginRight: 6, flexShrink: 0 }}>&#8644;</button>
              <button onClick={() => onRemove(p.id)} aria-label={`Remove ${p.name}`} title="Remove" style={{ ...smallBtn, color: T.accent, borderColor: T.accent, fontSize: 15, padding: "3px 10px", flexShrink: 0 }}>&minus;</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <button onClick={() => onAdjustSets(p.id, Math.max(1, (p.plannedSets ?? getPrefs().defaultPlannedSets) - 1))} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 14, fontWeight: 700 }}>&minus;</button>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: T.text, minWidth: 16, textAlign: "center" }}>{p.plannedSets ?? getPrefs().defaultPlannedSets}</div>
              <button onClick={() => onAdjustSets(p.id, Math.min(12, (p.plannedSets ?? getPrefs().defaultPlannedSets) + 1))} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 14, fontWeight: 700 }}>+</button>
              <div style={{ fontSize: 11, color: T.dim, marginLeft: 2 }}>sets</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Add to {label.toLowerCase()}</div>
      <ExercisePicker
        list={candidates}
        search={filters.search} onSearchChange={(v) => onFiltersChange({ search: v })}
        muscleFilter={filters.muscleFilter} onToggleMuscle={(m) => onFiltersChange({ muscleFilter: filters.muscleFilter.includes(m) ? filters.muscleFilter.filter((x) => x !== m) : [...filters.muscleFilter, m] })}
        onApplySplit={applySplit}
        equipFilter={filters.equipFilter} onToggleEquip={(eq) => onFiltersChange({ equipFilter: filters.equipFilter.includes(eq) ? filters.equipFilter.filter((x) => x !== eq) : [...filters.equipFilter, eq] })}
        performedFilter={filters.performedFilter} onSetPerformed={(v) => onFiltersChange({ performedFilter: v })}
        sourceFilter={filters.sourceFilter} onSetSource={(v) => onFiltersChange({ sourceFilter: v })}
        showFilters={filters.showFilters} onToggleFilters={() => onFiltersChange({ showFilters: !filters.showFilters })}
        onPick={onPick}
        onToggleFavorite={onToggleFavorite}
      />
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
  const [library, setLibrary] = useState([]); // normalized exercises (normalizeExercise), + sessions/isFavorite like Templates.jsx
  const [performedIds, setPerformedIds] = useState(new Set());
  const [picksByDay, setPicksByDay] = useState({}); // { dayIndex: [{...normalizedExercise, plannedSets}, ...] }
  const [dayFilters, setDayFilters] = useState({}); // { dayIndex: {search, muscleFilter, equipFilter, performedFilter, sourceFilter, showFilters} }
  const [replacing, setReplacing] = useState(null); // { dayIndex, exerciseId } | null
  const [saving, setSaving] = useState(false);
  const [activeDayTab, setActiveDayTab] = useState(0);

  const splitOptions = Object.keys(SPLIT_ROTATIONS).filter((name) => dayLabelsForSplit(name).every((label) => getSplits()[label]));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [lib, performed, favIds, totalSessions] = await Promise.all([
          fetchExercises(),
          fetchPerformedExerciseIds(user.id),
          fetchFavoriteExerciseIds(user.id),
          fetchTotalSessionCount(user.id),
        ]);
        if (cancelled) return;
        setLibrary(lib.map((l) => ({ ...l, sessions: performed.has(l.id) ? 1 : 0, isFavorite: favIds.has(l.id) })));
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

  // A different split can mean a different number of days -- land back
  // on the first tab rather than pointing at a day index that may no
  // longer exist.
  useEffect(() => {
    setActiveDayTab(0);
  }, [splitName]);

  // Regenerates the auto-picked exercise list whenever the inputs that
  // determine it change. Uses the *expanded* per-week day list (see
  // expandDayLabelsForWeek), not the split's bare 3/2-day rotation, so a
  // 6-day PPL week gets 6 real day-sections instead of 3 that then get
  // silently duplicated at scheduling time. usedIds accumulates across
  // the loop (in day order) so a later day -- especially a repeat cycle,
  // e.g. the second Legs day -- prefers exercises the earlier days in
  // the same week didn't already use, on top of the cycle-based pattern
  // bias autoPickExercisesForDay applies for Legs specifically.
  useEffect(() => {
    if (!splitName || library.length === 0) return;
    const expanded = expandDayLabelsForWeek(splitName, daysPerWeek);
    const next = {};
    const usedIds = new Set();
    expanded.forEach(({ label, cycle }, i) => {
      const buckets = getSplits()[label] || [];
      const excluded = getSplitExclusions(label);
      const perBucket = perBucketForDay(experienceLevel || "Beginner", buckets.length);
      const picks = autoPickExercisesForDay(library, buckets, performedIds, perBucket, excluded, cycle, usedIds, getPrefs().defaultPlannedSets);
      picks.forEach((p) => usedIds.add(p.id));
      next[i] = picks;
    });
    setPicksByDay(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitName, daysPerWeek, experienceLevel, library]);

  function filtersFor(dayIndex) {
    return dayFilters[dayIndex] || EMPTY_DAY_FILTERS;
  }
  function updateFilters(dayIndex, patch) {
    setDayFilters((prev) => ({ ...prev, [dayIndex]: { ...filtersFor(dayIndex), ...patch } }));
  }

  function removePick(dayIndex, exerciseId) {
    setPicksByDay((prev) => ({ ...prev, [dayIndex]: (prev[dayIndex] || []).filter((e) => e.id !== exerciseId) }));
  }

  function addPick(dayIndex, ex) {
    setPicksByDay((prev) => ({ ...prev, [dayIndex]: [...(prev[dayIndex] || []), { ...ex, plannedSets: getPrefs().defaultPlannedSets }] }));
  }

  function replacePick(dayIndex, exerciseId, ex) {
    setPicksByDay((prev) => ({
      ...prev,
      [dayIndex]: (prev[dayIndex] || []).map((p) => (p.id === exerciseId ? { ...ex, plannedSets: p.plannedSets } : p)),
    }));
    setReplacing(null);
  }

  function adjustPlannedSets(dayIndex, exerciseId, n) {
    setPicksByDay((prev) => ({ ...prev, [dayIndex]: (prev[dayIndex] || []).map((p) => (p.id === exerciseId ? { ...p, plannedSets: n } : p)) }));
  }

  function reorderDay(dayIndex, updater) {
    setPicksByDay((prev) => {
      const current = prev[dayIndex] || [];
      const nextList = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [dayIndex]: nextList };
    });
  }

  function toggleFavorite(id) {
    setLibrary((prev) => prev.map((l) => (l.id === id ? { ...l, isFavorite: !l.isFavorite } : l)));
    const target = library.find((l) => l.id === id);
    setFavoriteExercise(user.id, id, !(target && target.isFavorite)).catch(() => {});
  }

  async function handleCreate() {
    setSaving(true);
    try {
      const expanded = expandDayLabelsForWeek(splitName, daysPerWeek);
      const programId = await createProgram(user.id, {
        trainingFocus,
        experienceLevel: experienceLevel || "Beginner",
        durationWeeks: customize ? durationWeeks : 6,
        daysPerWeek,
        splitName,
      });
      const rows = [];
      let position = 0;
      expanded.forEach((_, dayIndex) => {
        (picksByDay[dayIndex] || []).forEach((ex) => {
          rows.push({ exerciseId: ex.id, position: position++, dayIndex, plannedSets: ex.plannedSets ?? getPrefs().defaultPlannedSets, plannedWarmupSets: ex.plannedWarmupSets ?? 0, progressionModel: customize ? progressionOverride : null });
        });
      });
      if (rows.length > 0) await addProgramExercises(programId, rows);
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  const dayLabels = splitName ? expandDayLabelsForWeek(splitName, daysPerWeek).map(({ label, cycle }, i, arr) => {
    // Only disambiguate a label when it actually repeats this week (e.g.
    // "Legs" and "Legs (2)" on a 6-day PPL week) -- a 3-day week's plain
    // "Push"/"Pull"/"Legs" stays exactly as it read before this feature.
    const repeatsThisWeek = arr.filter((d) => d.label === label).length > 1;
    return repeatsThisWeek ? `${label} (${cycle + 1})` : label;
  }) : [];
  const totalPicked = Object.values(picksByDay).reduce((sum, arr) => sum + (arr?.length || 0), 0);
  const replacingDay = replacing ? picksByDay[replacing.dayIndex] || [] : [];
  const replacingExercise = replacing ? replacingDay.find((p) => p.id === replacing.exerciseId) : null;

  const dayTab = Math.min(activeDayTab, Math.max(0, dayLabels.length - 1));

  const exercisesBody = (
    <div>
      {dayLabels.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <PillRow
            options={dayLabels.map((label, i) => ({ key: i, label: `${label} (${(picksByDay[i] || []).length})` }))}
            value={dayTab}
            onChange={setActiveDayTab}
            columns={dayLabels.length}
          />
        </div>
      )}
      {(() => {
        const label = dayLabels[dayTab];
        if (label === undefined) return null;
        const picks = picksByDay[dayTab] || [];
        const pickedNames = new Set(picks.map((p) => p.name));
        const filters = filtersFor(dayTab);
        const candidates = filterLibrary(library, { ...filters, exclude: pickedNames });
        return (
          <DaySection
            key={dayTab}
            dayIndex={dayTab}
            label={label}
            picks={picks}
            onReorder={(updater) => reorderDay(dayTab, updater)}
            onRemove={(id) => removePick(dayTab, id)}
            onAdjustSets={(id, n) => adjustPlannedSets(dayTab, id, n)}
            onOpenReplace={(id) => setReplacing({ dayIndex: dayTab, exerciseId: id })}
            filters={filters}
            onFiltersChange={(patch) => updateFilters(dayTab, patch)}
            candidates={candidates}
            onPick={(ex) => addPick(dayTab, ex)}
            onToggleFavorite={toggleFavorite}
          />
        );
      })()}
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
      body: (
        <>
          <PillRow options={EXPERIENCE_LEVELS.map((l) => ({ key: l, label: l }))} value={experienceLevel} onChange={setExperienceLevel} />
          {experienceLevel && <InfoBox>{EXPERIENCE_LEVEL_DESCRIPTIONS[experienceLevel]}</InfoBox>}
        </>
      ),
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
            body: (
              <>
                <PillRow options={splitOptions.map((s) => ({ key: s, label: s }))} value={splitName} onChange={setSplitName} />
                {splitName && <InfoBox>{SPLIT_DESCRIPTIONS[splitName]}</InfoBox>}
              </>
            ),
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
                <InfoBox>{PROGRESSION_MODEL_DESCRIPTIONS[progressionOverride || defaultModelForFocus(trainingFocus)]}</InfoBox>
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

      {replacing && (() => {
        const filters = filtersFor(replacing.dayIndex);
        const pickedNames = new Set(replacingDay.filter((p) => p.id !== replacing.exerciseId).map((p) => p.name));
        const replaceCandidates = filterLibrary(library, { ...filters, exclude: pickedNames });
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.75)", zIndex: 2100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div style={{ width: "100%", maxWidth: 400, maxHeight: "85vh", display: "flex", flexDirection: "column", background: T.bg, borderTop: `1px solid ${T.line}`, borderRadius: "20px 20px 0 0" }}>
              <div style={{ padding: "16px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.text }}>
                  Replace {replacingExercise?.short || replacingExercise?.name || "exercise"}
                </div>
                <button onClick={() => setReplacing(null)} aria-label="Close" style={smallBtn}><IconX size={12} /></button>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: "hidden", padding: "0 16px 16px", display: "flex", flexDirection: "column" }}>
                <ExercisePicker
                  list={replaceCandidates}
                  search={filters.search} onSearchChange={(v) => updateFilters(replacing.dayIndex, { search: v })}
                  muscleFilter={filters.muscleFilter} onToggleMuscle={(m) => updateFilters(replacing.dayIndex, { muscleFilter: filters.muscleFilter.includes(m) ? filters.muscleFilter.filter((x) => x !== m) : [...filters.muscleFilter, m] })}
                  onApplySplit={(splitName) => {
                    const mode = getPrefs().muscleNameMode;
                    const group = splitGroupFor(splitName, mode);
                    const isActive = group.length > 0 && group.length === filters.muscleFilter.length && group.every((m) => filters.muscleFilter.includes(m));
                    updateFilters(replacing.dayIndex, { muscleFilter: isActive ? [] : group });
                  }}
                  equipFilter={filters.equipFilter} onToggleEquip={(eq) => updateFilters(replacing.dayIndex, { equipFilter: filters.equipFilter.includes(eq) ? filters.equipFilter.filter((x) => x !== eq) : [...filters.equipFilter, eq] })}
                  performedFilter={filters.performedFilter} onSetPerformed={(v) => updateFilters(replacing.dayIndex, { performedFilter: v })}
                  sourceFilter={filters.sourceFilter} onSetSource={(v) => updateFilters(replacing.dayIndex, { sourceFilter: v })}
                  showFilters={filters.showFilters} onToggleFilters={() => updateFilters(replacing.dayIndex, { showFilters: !filters.showFilters })}
                  onPick={(ex) => replacePick(replacing.dayIndex, replacing.exerciseId, ex)}
                  onToggleFavorite={toggleFavorite}
                  fillHeight
                />
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
