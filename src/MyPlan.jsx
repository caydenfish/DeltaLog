import { useState, useEffect, useMemo, useRef } from "react";
import { fetchMuscleGroupTargets, saveMuscleGroupTarget } from "./lib/queries";
import { computeRollingWeeklyTotals } from "./lib/volume";
import { MUSCLE_COLORS } from "./lib/muscleColors";
import { statusColorFor } from "./lib/planStatus";
import { InlineLoading } from "./LoadingSpinner";

const T = {
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

// "My Plan": lets someone set a weekly set-target per muscle group and
// see, at a glance, how this rolling week stacks up against it --
// gray (nothing logged yet), orange (some sets in, short of target),
// green (target met or beat). Targets are stored in Supabase
// (muscle_group_targets, migration_062) rather than local prefs, since
// this is real programming data worth syncing across devices. `history`
// is the same raw workout-history array Home.jsx already has loaded
// (all-time, not range-filtered) -- this component does its own
// 7-day filtering rather than depending on the Home dashboard's
// Training Range selector.
export default function MyPlan({ userId, history }) {
  const [targets, setTargets] = useState(null); // null = loading
  const saveTimers = useRef({});

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
  }, [userId]);

  const rollingTotals = useMemo(() => computeRollingWeeklyTotals(history), [history]);

  function updateTarget(muscle, value) {
    setTargets((prev) => ({ ...prev, [muscle]: value }));
    clearTimeout(saveTimers.current[muscle]);
    saveTimers.current[muscle] = setTimeout(() => {
      saveMuscleGroupTarget(userId, muscle, value).catch(() => {});
    }, 600);
  }

  if (targets === null) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <InlineLoading label="Loading your plan…" padding="24px 0" />
      </div>
    );
  }

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
      <style>{`
        input[type="range"].dl-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 20px; background: transparent; margin: 0; }
        input[type="range"].dl-slider::-webkit-slider-runnable-track { height: 6px; border-radius: 3px; background: ${T.surface2}; }
        input[type="range"].dl-slider::-moz-range-track { height: 6px; border-radius: 3px; background: ${T.surface2}; }
        input[type="range"].dl-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 999px; background: ${T.accent}; margin-top: -6px; border: 2px solid #fff; }
        input[type="range"].dl-slider::-moz-range-thumb { width: 18px; height: 18px; border-radius: 999px; background: ${T.accent}; border: 2px solid #fff; }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>My Plan</div>
        <div style={{ fontSize: 10.5, color: T.dim }}>This week (rolling 7 days)</div>
      </div>
      <div style={{ fontSize: 11.5, color: T.dim, marginBottom: 14, lineHeight: 1.4 }}>
        Set a weekly set target per muscle group. The Body map's "My Plan" view colors each region the same way: gray until you've started, orange while under target, green once you've hit it.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
              <div style={{ height: 5, borderRadius: 3, background: T.surface2, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.2s" }} />
              </div>
              <input
                className="dl-slider"
                type="range"
                min={MIN_TARGET}
                max={MAX_TARGET}
                step={1}
                value={target}
                onChange={(e) => updateTarget(m, Number(e.target.value))}
                aria-label={`${m} weekly set target`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
