import { useState, useEffect, useMemo, useRef } from "react";
import { fetchMuscleGroupTargets, saveMuscleGroupTarget } from "./lib/queries";
import { fetchActiveProgram } from "./lib/programQueries";
import { dayLabelsForSplit } from "./lib/programEngine";
import { computeRollingWeeklyTotals } from "./lib/volume";
import { MUSCLE_COLORS } from "./lib/muscleColors";
import { statusColorFor } from "./lib/planStatus";
import { getPrefs, setPref } from "./lib/prefs";
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
  green: "#3BA55D",
};

const DEFAULT_TARGET = 10;
const MIN_TARGET = 0;
const MAX_TARGET = 30;

// Every muscle group gets a weekly set target here (including Full
// Body), matching Cayden's "eight sliders" call -- even though Full
// Body doesn't map onto a body-map region (see BodyMap.jsx/
// bodyMapRegions.js), it still gets tracked and shown in this list.
const MUSCLES = Object.keys(MUSCLE_COLORS);

// A +/- stepper with a typeable number field in the middle, used
// instead of a drag slider anywhere a target is actually edited. Sliders
// on Home were getting bumped by accident mid-scroll -- a stepper only
// changes on a deliberate tap or a deliberate typed value, never as a
// side effect of scrolling past it.
function Stepper({ value, onChange, min = MIN_TARGET, max = MAX_TARGET }) {
  const step = (delta) => onChange(Math.min(max, Math.max(min, value + delta)));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button
        onClick={() => step(-1)}
        disabled={value <= min}
        aria-label="Decrease"
        style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.line}`, background: T.surface2, color: value <= min ? "#3A404B" : T.text, fontSize: 16, flexShrink: 0 }}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        style={{ width: 44, textAlign: "center", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 14, fontWeight: 600, padding: "6px 2px" }}
      />
      <button
        onClick={() => step(1)}
        disabled={value >= max}
        aria-label="Increase"
        style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.line}`, background: T.surface2, color: value >= max ? "#3A404B" : T.text, fontSize: 16, flexShrink: 0 }}
      >
        +
      </button>
    </div>
  );
}

// The single place these targets are actually viewed and edited --
// reachable two ways (the Home dashboard widget's "Edit" button, and a
// standalone entry in Settings), both of which open this exact
// component. It's fully self-sufficient (fetches its own targets on
// mount) rather than depending on a parent's already-loaded state, so
// the Settings entry point works even if someone has removed the Home
// widget entirely via Customize Home.
//
// Two edit modes: Individual (a stepper per muscle group) and "One for
// all" (a single number applied to every muscle group at once) --
// last-used mode remembered via prefs so reopening doesn't reset
// whichever workflow someone prefers.
export function WeeklySetGoalsEditor({ userId, onClose }) {
  const [targets, setTargets] = useState(null); // null = loading
  const [mode, setMode] = useState(() => getPrefs().weeklySetGoalsMode || "individual");
  const [uniformValue, setUniformValue] = useState(DEFAULT_TARGET);
  const saveTimers = useRef({});

  useEffect(() => {
    let cancelled = false;
    fetchMuscleGroupTargets(userId)
      .then((map) => {
        if (cancelled) return;
        const filled = {};
        for (const m of MUSCLES) filled[m] = map[m] ?? DEFAULT_TARGET;
        setTargets(filled);
        const vals = Object.values(filled);
        setUniformValue(Math.round(vals.reduce((a, b) => a + b, 0) / vals.length));
      })
      .catch(() => {
        if (cancelled) return;
        const filled = {};
        for (const m of MUSCLES) filled[m] = DEFAULT_TARGET;
        setTargets(filled);
        setUniformValue(DEFAULT_TARGET);
      });
    return () => { cancelled = true; };
  }, [userId]);

  function switchMode(next) {
    setMode(next);
    setPref("weeklySetGoalsMode", next);
  }

  function updateIndividual(muscle, value) {
    setTargets((prev) => ({ ...prev, [muscle]: value }));
    clearTimeout(saveTimers.current[muscle]);
    saveTimers.current[muscle] = setTimeout(() => {
      saveMuscleGroupTarget(userId, muscle, value).catch(() => {});
    }, 500);
  }

  function updateUniform(value) {
    setUniformValue(value);
    setTargets((prev) => {
      const next = { ...prev };
      for (const m of MUSCLES) next[m] = value;
      return next;
    });
    clearTimeout(saveTimers.current.__uniform);
    saveTimers.current.__uniform = setTimeout(() => {
      MUSCLES.forEach((m) => saveMuscleGroupTarget(userId, m, value).catch(() => {}));
    }, 500);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 2000, display: "flex", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26 }} />
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: T.text, textAlign: "center" }}>WEEKLY SET GOALS</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: T.dim, justifySelf: "end" }}><IconX size={20} /></button>
        </div>

        {targets === null ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><InlineLoading /></div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            <div style={{ color: T.dim, fontSize: 11.5, marginBottom: 16, lineHeight: 1.4 }}>
              Set a weekly set goal per muscle group, or one number applied everywhere. This is the one place these get adjusted — the Home dashboard's Weekly Set Goals card, the Body map's matching view, and Coverage all read from what's set here.
            </div>

            <div style={{ display: "flex", background: T.surface2, borderRadius: 10, padding: 3, gap: 3, marginBottom: 18 }}>
              {[
                { key: "individual", label: "Individual" },
                { key: "uniform", label: "One for all" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => switchMode(opt.key)}
                  aria-pressed={mode === opt.key}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 12.5, fontWeight: 600, border: "none", background: mode === opt.key ? T.accent : "transparent", color: mode === opt.key ? "#fff" : T.dim }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {mode === "uniform" ? (
              <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, textAlign: "center" }}>
                <div style={{ color: T.dim, fontSize: 12, marginBottom: 12 }}>Applies to all {MUSCLES.length} muscle groups</div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <Stepper value={uniformValue} onChange={updateUniform} />
                </div>
                <div style={{ color: T.dim, fontSize: 11, marginTop: 12 }}>sets / week, every muscle group</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {MUSCLES.map((m) => (
                  <div key={m} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: MUSCLE_COLORS[m], display: "inline-block", flexShrink: 0 }} />
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>{m}</span>
                    </div>
                    <Stepper value={targets[m]} onChange={(v) => updateIndividual(m, v)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// "Weekly Set Goals" (formerly "My Plan"): the Home dashboard widget --
// shows this rolling week's set count per muscle group against its goal
// (gray/orange/green), read-only. All editing happens in
// WeeklySetGoalsEditor above, opened either from this widget's "Edit"
// button or from its standalone Settings entry -- nothing here can be
// nudged by accident while scrolling past it, which is what a slider
// sitting directly on Home used to allow. `history` is the same raw
// workout-history array Home.jsx already has loaded (all-time, not
// range-filtered) -- this component does its own 7-day filtering
// rather than depending on the Home dashboard's Training Range selector.
export default function WeeklySetGoals({ userId, history }) {
  const [targets, setTargets] = useState(null); // null = loading
  const [suggestion, setSuggestion] = useState(null); // { programId, byMuscle: {muscle: sets} } | null
  const [dismissed, setDismissed] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchMuscleGroupTargets(userId)
      .then((map) => {
        if (cancelled) return;
        const filled = {};
        for (const m of MUSCLES) filled[m] = map[m] ?? DEFAULT_TARGET;
        setTargets(filled);
      })
      .catch(() => {
        if (cancelled) return;
        const filled = {};
        for (const m of MUSCLES) filled[m] = DEFAULT_TARGET;
        setTargets(filled);
      });
    return () => { cancelled = true; };
  }, [userId, refreshKey]);

  // One-time suggestion when a program exists: the program suggests
  // weekly set goals, but never writes them automatically -- goals stay
  // user-editable, this is a single tap to accept, not a live sync.
  useEffect(() => {
    let cancelled = false;
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
  }, [userId, refreshKey]);

  function applySuggestion() {
    if (!suggestion) return;
    setTargets((prev) => ({ ...prev, ...suggestion.byMuscle }));
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

  const rollingTotals = useMemo(() => computeRollingWeeklyTotals(history), [history]);

  if (targets === null) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <InlineLoading label="Loading your goals…" padding="24px 0" />
      </div>
    );
  }

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>Weekly Set Goals</div>
        <div style={{ fontSize: 10.5, color: T.dim }}>This week (rolling 7 days)</div>
      </div>
      <div style={{ fontSize: 11.5, color: T.dim, marginBottom: 14, lineHeight: 1.4 }}>
        Your weekly set goal per muscle group. The Body map's matching view colors each region the same way: gray until you've started, orange while under goal, green once you've hit it.
      </div>

      {suggestion && !dismissed && (
        <div style={{ background: T.surface2, border: `1px solid ${T.accent}`, borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <div style={{ color: T.text, fontSize: 12.5, marginBottom: 8, lineHeight: 1.4 }}>
            Your active program suggests weekly set goals for {Object.keys(suggestion.byMuscle).length} muscle group{Object.keys(suggestion.byMuscle).length === 1 ? "" : "s"}. Applying won't change anything else here — you can still adjust any goal afterward.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={applySuggestion} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: T.accent, color: "#fff", fontSize: 12.5, fontWeight: 700 }}>Apply suggestion</button>
            <button onClick={dismissSuggestion} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 12.5 }}>Dismiss</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {MUSCLES.map((m) => {
          const target = targets[m];
          const total = rollingTotals[m] || 0;
          const color = statusColorFor(total, target);
          const pct = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;
          return (
            <div key={m}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: MUSCLE_COLORS[m], display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{m}</span>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color }}>
                  {total} <span style={{ color: T.dim, fontWeight: 500 }}>/ {target} sets</span>
                </div>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: T.surface2, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.2s" }} />
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setShowEditor(true)}
        style={{ width: "100%", marginTop: 16, padding: 12, borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 13, fontWeight: 600 }}
      >
        Edit Goals
      </button>

      {showEditor && (
        <WeeklySetGoalsEditor userId={userId} onClose={() => { setShowEditor(false); setRefreshKey((k) => k + 1); }} />
      )}
    </div>
  );
}
