import { useState, useEffect, useMemo } from "react";
import { fetchMuscleGroupTargets } from "./lib/queries";
import { computeRollingWeeklyTotals } from "./lib/volume";
import { MUSCLE_COLORS } from "./lib/muscleColors";
import { InlineLoading } from "./LoadingSpinner";
import BodyMap from "./BodyMap";

const T = {
  surface: "#1A1D23",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
};

const DEFAULT_TARGET = 10;

// A standalone Home dashboard module: the body silhouette colored by
// this rolling week's progress against each muscle group's weekly set
// goal (gray/orange/green — see lib/planStatus.js), split out from the
// bar-list Weekly Set Goals module ("myPlan") and from the Muscle
// breakdown intensity map ("muscleBreakdown") rather than living as a
// third tab buried inside either one. Split intentionally: this reads
// the same underlying targets/rollingTotals as the "myPlan" module, but
// as its own card so both can be independently shown/hidden/reordered
// via Customize Home.
//
// Deliberately self-gating on real data, not just the module on/off
// toggle: fetchMuscleGroupTargets returns an empty map for anyone who's
// never saved a goal (WeeklySetGoals' own steppers all just show the
// DEFAULT_TARGET fallback until something's actually saved), and a
// silhouette colored entirely by defaults nobody chose isn't a
// meaningful "weekly set goals" read — it'd just be noise ahead of
// someone actually setting goals. Returns null in that case so the
// module effectively stays invisible until they do, even if left
// enabled in Customize Home.
export default function WeeklyGoalsBodyMap({ userId, history }) {
  const [rawTargets, setRawTargets] = useState(null); // null = loading; {} = no goals saved yet

  useEffect(() => {
    let cancelled = false;
    fetchMuscleGroupTargets(userId)
      .then((map) => { if (!cancelled) setRawTargets(map); })
      .catch(() => { if (!cancelled) setRawTargets({}); });
    return () => { cancelled = true; };
  }, [userId]);

  const rollingTotals = useMemo(() => computeRollingWeeklyTotals(history), [history]);

  if (rawTargets === null) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <InlineLoading label="Loading your goals…" padding="24px 0" />
      </div>
    );
  }

  if (Object.keys(rawTargets).length === 0) return null;

  const filledTargets = {};
  for (const m of Object.keys(MUSCLE_COLORS)) filledTargets[m] = rawTargets[m] ?? DEFAULT_TARGET;

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Weekly Set Goals — Body Map</div>
      <BodyMap mode="plan" targets={filledTargets} rollingTotals={rollingTotals} />
    </div>
  );
}
