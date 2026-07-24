import { useState, useEffect, useMemo } from "react";
import { fetchMuscleGroupTargets, saveMuscleGroupTarget } from "./lib/queries";
import { fetchActiveProgram } from "./lib/programQueries";
import { dayLabelsForSplit } from "./lib/programEngine";
import { computeRollingWeeklyTotals } from "./lib/volume";
import { getMuscleGroupOptions } from "./lib/muscleNomenclature";
import { statusColorFor } from "./lib/planStatus";
import { getPrefs } from "./lib/prefs";
import { InlineLoading } from "./LoadingSpinner";
import { IconChevronUp, IconChevronDown } from "./Icons";
import BodyMap from "./BodyMap";
import { WeeklySetGoalsEditor } from "./WeeklySetGoals";

const T = {
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

const DEFAULT_TARGET = 10;

// Goals breakdown: same disclosure pattern as BodyHeatmap.jsx's Coverage
// breakdown (a toggle button showing a count, expanding to one row per
// muscle) -- lists every tracked muscle's exact current/target numbers,
// including ones sitting at 0, so it's obvious what's lacking without
// needing to hover every region on the silhouette above it.
function GoalsBreakdown({ options, targets, rollingTotals }) {
  const [open, setOpen] = useState(false);

  const rows = options
    .map((o) => ({ muscle: o.key, color: o.color, target: targets[o.key] ?? DEFAULT_TARGET, total: rollingTotals[o.key] || 0 }))
    .sort((a, b) => b.total - a.total || a.muscle.localeCompare(b.muscle));
  const metCount = rows.filter((r) => r.target > 0 && r.total >= r.target).length;

  return (
    <div style={{ marginTop: 10 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", color: T.dim, fontSize: 11.5, fontWeight: 600, padding: "6px 0", textTransform: "uppercase", letterSpacing: 0.5 }}
      >
        <span>Goals breakdown ({metCount}/{rows.length} met)</span>
        {open ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
          {rows.map((r) => {
            const color = statusColorFor(r.total, r.target);
            return (
              <div
                key={r.muscle}
                style={{
                  width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                  background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: r.color, display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: T.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.muscle}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>
                  {r.total} <span style={{ color: T.dim, fontWeight: 500 }}>/ {r.target} sets</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// A standalone Home dashboard module -- the sole home for Weekly Set
// Goals now: the body silhouette colored by this rolling week's progress
// (gray/orange/green, see lib/planStatus.js), a Goals breakdown
// disclosure listing every muscle's exact numbers (mirroring Muscle
// breakdown's Coverage breakdown), a one-tap program suggestion banner,
// and the Edit Goals entry point -- all in one place. Replaces the old
// three-way split (a separate "myPlan" bars widget, this body map as its
// own module, and a standalone Settings menu entry for the editor):
// rolled into this one module so Weekly Set Goals has exactly one home,
// same as Muscle breakdown has exactly one.
//
// `nameMode`, same tier concept as BodyMap.jsx's planNameMode -- Category
// tracks the 8 broad buckets; Region and Anatomy both track the same
// Region-tier list of real muscles (Lats, Traps, Quads, ...), each with
// its own independent target, rather than Category's shared buckets.
// Falls back to the live Muscle Names preference if a caller doesn't
// pass one.
//
// No longer fully hides itself when nothing's been saved (the old
// self-gating relied on a separate always-available Settings entry to
// ever get someone to their first goal, which no longer exists) --
// instead shows a plain setup prompt in place of the map/breakdown until
// at least one goal exists, so the module (once enabled in Customize
// Home) is always the one way in.
export default function WeeklyGoalsBodyMap({ userId, history, nameMode }) {
  const resolvedNameMode = nameMode || getPrefs().muscleNameMode;
  const options = useMemo(() => getMuscleGroupOptions(resolvedNameMode), [resolvedNameMode]);

  const [rawTargets, setRawTargets] = useState(null); // null = loading; {} = no goals saved yet
  const [suggestion, setSuggestion] = useState(null); // { programId, byMuscle } | null
  const [dismissed, setDismissed] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchMuscleGroupTargets(userId)
      .then((map) => { if (!cancelled) setRawTargets(map); })
      .catch(() => { if (!cancelled) setRawTargets({}); });
    return () => { cancelled = true; };
  }, [userId, resolvedNameMode, refreshKey]);

  // One-time suggestion when a program exists -- ported from the old
  // bars widget unchanged: program_exercises only carries the
  // Category-tier muscle bucket, so this stays generic-only, same as
  // before.
  useEffect(() => {
    let cancelled = false;
    if (resolvedNameMode !== "generic") { setSuggestion(null); return; }
    fetchActiveProgram(userId)
      .then((program) => {
        if (cancelled || !program) return;
        const dismissKey = `weeklySetGoalsSuggestionDismissed:${program.id}`;
        if (localStorage.getItem(dismissKey)) return;
        const dayLabels = dayLabelsForSplit(program.splitName);
        const weeklyMultiplier = program.daysPerWeek / Math.max(1, dayLabels.length);
        const byMuscle = {};
        for (const pe of program.exercises) {
          const m = pe.exercise.muscle;
          if (!m) continue;
          byMuscle[m] = (byMuscle[m] || 0) + pe.plannedSets * weeklyMultiplier;
        }
        for (const m of Object.keys(byMuscle)) byMuscle[m] = Math.round(byMuscle[m]);
        if (Object.keys(byMuscle).length > 0) setSuggestion({ programId: program.id, byMuscle });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userId, refreshKey, resolvedNameMode]);

  function applySuggestion() {
    if (!suggestion) return;
    setRawTargets((prev) => ({ ...prev, ...suggestion.byMuscle }));
    Object.entries(suggestion.byMuscle).forEach(([muscle, value]) => {
      saveMuscleGroupTarget(userId, muscle, value).catch(() => {});
    });
    localStorage.setItem(`weeklySetGoalsSuggestionDismissed:${suggestion.programId}`, "1");
    setDismissed(true);
  }

  function dismissSuggestion() {
    if (suggestion) localStorage.setItem(`weeklySetGoalsSuggestionDismissed:${suggestion.programId}`, "1");
    setDismissed(true);
  }

  const rollingTotals = useMemo(() => computeRollingWeeklyTotals(history, resolvedNameMode), [history, resolvedNameMode]);

  if (rawTargets === null) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <InlineLoading label="Loading your goals…" padding="24px 0" />
      </div>
    );
  }

  const hasAnyGoals = Object.keys(rawTargets).length > 0;

  const filledTargets = {};
  for (const { key } of options) filledTargets[key] = rawTargets[key] ?? DEFAULT_TARGET;

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Weekly Set Goals</div>

      {hasAnyGoals ? (
        <>
          <div style={{ fontSize: 11.5, color: T.dim, marginBottom: 12, lineHeight: 1.4 }}>
            This week (rolling 7 days) against your goal per muscle group: gray until you've started, orange while under goal, green once you've hit it.
          </div>

          {suggestion && !dismissed && (
            <div style={{ background: T.surface2, border: `1px solid ${T.accent}`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <div style={{ color: T.text, fontSize: 12.5, marginBottom: 8, lineHeight: 1.4 }}>
                Your active program suggests weekly set goals for {Object.keys(suggestion.byMuscle).length} muscle group{Object.keys(suggestion.byMuscle).length === 1 ? "" : "s"}. Applying won't change anything else here — you can still adjust any goal afterward.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={applySuggestion} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: T.accent, color: "#fff", fontSize: 12.5, fontWeight: 700 }}>Apply suggestion</button>
                <button onClick={dismissSuggestion} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 12.5 }}>Dismiss</button>
              </div>
            </div>
          )}

          <BodyMap mode="plan" targets={filledTargets} rollingTotals={rollingTotals} planNameMode={resolvedNameMode} />

          <GoalsBreakdown options={options} targets={filledTargets} rollingTotals={rollingTotals} />
        </>
      ) : (
        <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "20px 0" }}>
          Set a weekly set goal per muscle group to see your progress here.
        </div>
      )}

      <button
        onClick={() => setShowEditor(true)}
        style={{ width: "100%", marginTop: 14, padding: 12, borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 13, fontWeight: 600 }}
      >
        {hasAnyGoals ? "Edit Goals" : "Set Goals"}
      </button>

      {showEditor && (
        <WeeklySetGoalsEditor userId={userId} nameMode={resolvedNameMode} onClose={() => { setShowEditor(false); setRefreshKey((k) => k + 1); }} />
      )}
    </div>
  );
}
