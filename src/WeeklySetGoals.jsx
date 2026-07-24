import { useState, useEffect, useMemo, useRef } from "react";
import { fetchMuscleGroupTargets, saveMuscleGroupTarget } from "./lib/queries";
import { getMuscleGroupOptions } from "./lib/muscleNomenclature";
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
// `nameMode` ("generic" | "detailed" | "scientific") decides which
// muscle-group keys get a target -- see getMuscleGroupOptions -- so
// targets are tracked at whichever resolution the person's Muscle Names
// preference already uses everywhere else (Category's fixed 8 buckets,
// or the full Region/Anatomy taxonomy list). Falls back to reading the
// live preference directly if a caller doesn't pass one. Switching
// Muscle Names later shows a different set of rows (Region-tier targets
// are separate from Category-tier ones, not reconciled/merged) -- that's
// intentional, since "20 sets of Lats" and "20 sets of Back" are
// genuinely different goals.
//
// Two edit modes: Individual (a stepper per muscle group) and "One for
// all" (a single number applied to every muscle group at once) --
// last-used mode remembered via prefs so reopening doesn't reset
// whichever workflow someone prefers.
export function WeeklySetGoalsEditor({ userId, onClose, nameMode }) {
  const resolvedNameMode = nameMode || getPrefs().muscleNameMode;
  const options = useMemo(() => getMuscleGroupOptions(resolvedNameMode), [resolvedNameMode]);
  const muscles = useMemo(() => options.map((o) => o.key), [options]);
  const colorOf = (m) => (options.find((o) => o.key === m) || {}).color || T.dim;

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
        for (const m of muscles) filled[m] = map[m] ?? DEFAULT_TARGET;
        setTargets(filled);
        const vals = Object.values(filled);
        setUniformValue(Math.round(vals.reduce((a, b) => a + b, 0) / vals.length));
      })
      .catch(() => {
        if (cancelled) return;
        const filled = {};
        for (const m of muscles) filled[m] = DEFAULT_TARGET;
        setTargets(filled);
        setUniformValue(DEFAULT_TARGET);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, resolvedNameMode]);

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
      for (const m of muscles) next[m] = value;
      return next;
    });
    clearTimeout(saveTimers.current.__uniform);
    saveTimers.current.__uniform = setTimeout(() => {
      muscles.forEach((m) => saveMuscleGroupTarget(userId, m, value).catch(() => {}));
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
                <div style={{ color: T.dim, fontSize: 12, marginBottom: 12 }}>Applies to all {muscles.length} muscle groups</div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <Stepper value={uniformValue} onChange={updateUniform} />
                </div>
                <div style={{ color: T.dim, fontSize: 11, marginTop: 12 }}>sets / week, every muscle group</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {muscles.map((m) => (
                  <div key={m} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: colorOf(m), display: "inline-block", flexShrink: 0 }} />
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>{m}</span>
                    </div>
                    <Stepper value={targets[m] ?? DEFAULT_TARGET} onChange={(v) => updateIndividual(m, v)} />
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

