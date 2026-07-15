import { useState, useEffect, useMemo } from "react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, ResponsiveContainer } from "recharts";
import { getPrefs, setPref } from "./lib/prefs";
import { computeMuscleSetCounts, computeRollingWeeklyTotals } from "./lib/volume";
import { getDetailedTaxonomyEntries } from "./lib/muscleNomenclature";
import { fetchMuscleGroupTargets } from "./lib/queries";
import { MUSCLE_COLORS } from "./lib/muscleColors";
import { IconChevronUp, IconChevronDown } from "./Icons";
import BodyMap from "./BodyMap";

const T = {
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

const BASE_CHART_TYPES = [
  { key: "bodymap", label: "Body map" },
  { key: "radar", label: "Radar" },
  { key: "myplan", label: "My Plan" },
];

const DEFAULT_TARGET = 10;

// Cap the radar to the top N muscles by volume — showing every trained
// muscle at once (sometimes 15-20 in Detailed/Scientific mode) is exactly
// what made it feel crowded and hard to read.
const RADAR_MAX_SPOKES = 8;

function toggleBtn(active) {
  return {
    background: active ? "rgba(232,68,46,0.12)" : "none",
    border: `1px solid ${active ? T.accent : T.line}`,
    color: active ? T.text : T.dim,
    borderRadius: 7,
    padding: "3px 10px",
    fontSize: 11,
    fontWeight: 600,
  };
}

function truncateLabel(v) {
  return v.length > 13 ? `${v.slice(0, 12)}…` : v;
}

function RadarView({ data }) {
  const radarData = data
    .slice(0, RADAR_MAX_SPOKES)
    .map((d) => ({ muscle: truncateLabel(d.muscle), total: d.total }));
  const maxTotal = Math.max(1, ...radarData.map((d) => d.total));
  return (
    <div style={{ position: "relative" }}>
      <ResponsiveContainer width="100%" height={250}>
        <RadarChart data={radarData} outerRadius="66%">
          <PolarGrid stroke={T.line} />
          <PolarAngleAxis dataKey="muscle" tick={{ fill: T.dim, fontSize: 10 }} />
          {/* One subtle number per grid ring, at the 12-o'clock position,
              instead of a value stamped at every muscle's spoke — a
              scale to read the shape against rather than a label at
              every point. */}
          <PolarRadiusAxis angle={90} domain={[0, maxTotal]} tickCount={4} axisLine={false} tickLine={false} tick={{ fill: T.dim, fontSize: 9 }} />
          <Radar dataKey="total" stroke={T.accent} fill={T.accent} fillOpacity={0.3} />
          <Tooltip
            contentStyle={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8 }}
            labelStyle={{ color: T.text, fontWeight: 700 }}
            itemStyle={{ color: T.dim, fontSize: 12 }}
            formatter={(value) => [`${value} set${value === 1 ? "" : "s"}`, "Total"]}
          />
        </RadarChart>
      </ResponsiveContainer>
      {data.length > RADAR_MAX_SPOKES && (
        <div style={{ textAlign: "center", fontSize: 10.5, color: T.dim, marginTop: -6 }}>
          Showing top {RADAR_MAX_SPOKES} of {data.length} muscles — see Coverage breakdown below for the rest
        </div>
      )}
    </div>
  );
}

// The old plain-language breakdown list, now living behind a disclosure
// below the chart instead of being a chart in its own right — it lists
// every muscle in the Detailed taxonomy, not just the ones with logged
// sets, specifically so a muscle group that's gotten nothing in this
// range still shows up (as "Not trained yet") instead of just silently
// not appearing anywhere. Tapping a trained row opens the same
// MuscleSetsDetail drill-in the body map used to.
function CoverageBreakdown({ primary, secondary, onSelectMuscle }) {
  const [open, setOpen] = useState(false);

  const known = new Set();
  const rows = [];
  for (const entry of getDetailedTaxonomyEntries()) {
    if (known.has(entry.detailed)) continue;
    known.add(entry.detailed);
    const p = primary[entry.detailed] || 0;
    const s = secondary[entry.detailed] || 0;
    rows.push({ muscle: entry.detailed, primary: p, secondary: s, total: p + s });
  }
  // Anything present in the counts but not in the taxonomy list (e.g. a
  // custom/legacy label) still deserves a row.
  for (const m of [...Object.keys(primary), ...Object.keys(secondary)]) {
    if (known.has(m)) continue;
    known.add(m);
    const p = primary[m] || 0;
    const s = secondary[m] || 0;
    rows.push({ muscle: m, primary: p, secondary: s, total: p + s });
  }

  rows.sort((a, b) => b.total - a.total || a.muscle.localeCompare(b.muscle));
  const trainedCount = rows.filter((r) => r.total > 0).length;

  return (
    <div style={{ marginTop: 10 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", color: T.dim, fontSize: 11.5, fontWeight: 600, padding: "6px 0", textTransform: "uppercase", letterSpacing: 0.5 }}
      >
        <span>Coverage breakdown ({trainedCount}/{rows.length})</span>
        {open ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
          {rows.map((r) => {
            const clickable = r.total > 0 && !!onSelectMuscle;
            return (
              <button
                key={r.muscle}
                onClick={() => clickable && onSelectMuscle(r.muscle)}
                disabled={!clickable}
                style={{
                  width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                  background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px",
                  textAlign: "left", cursor: clickable ? "pointer" : "default",
                }}
              >
                <span style={{ fontSize: 13, color: r.total > 0 ? T.text : T.dim, fontWeight: r.total > 0 ? 600 : 500 }}>{r.muscle}</span>
                {r.total > 0 ? (
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 12, color: T.text, fontWeight: 700 }}>{r.total} set{r.total === 1 ? "" : "s"}</div>
                    <div style={{ fontSize: 10.5, color: T.dim, marginTop: 1 }}>{r.primary} primary &middot; {r.secondary} secondary</div>
                  </div>
                ) : (
                  <span style={{ fontSize: 11.5, color: T.dim, fontStyle: "italic" }}>Not trained yet</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Reports which muscles were trained, with a choice of three views that
// persists across every screen this renders on (Home, live workout,
// template builder) until changed again: an anatomical Body map (front +
// back silhouette, purely visual — see BodyMap.jsx), a Radar shape
// (quick "is my training balanced" read), or My Plan (weekly set targets
// vs. this rolling week — only offered when `userId`+`fullHistory` are
// passed, since it needs your targets from Supabase and your all-time
// history rather than whatever range-filtered `entries` the caller built
// for the other two views). Below the chart, a Coverage breakdown
// disclosure lists every muscle with its exact primary/secondary counts,
// including muscles with zero sets so it's obvious what's lacking — this
// is also the only place tapping a muscle still opens the
// MuscleSetsDetail drill-in, now that the body map itself is view-only.
// `primary`/`secondary` are maps of muscle name -> set count at the
// caller's selected naming mode (generic/detailed/scientific), used by
// Radar and the breakdown list. `entries` is the same raw volume-entry
// array the caller fed into computeMuscleSetCounts to produce those —
// Body map needs its own pass at a fixed "detailed" tier regardless of
// the naming-mode preference, since that's the resolution the underlying
// anatomical art is actually drawn at (see BodyMap.jsx). `fullBodySets`,
// if present, is shown separately since "Full Body" exercises (carries,
// complexes) don't map to one muscle region. `onSelectMuscle(muscle)`,
// if passed, wires the Coverage breakdown's rows to a drill-in sheet.
export default function BodyHeatmap({ primary = {}, secondary = {}, fullBodySets = 0, entries, onSelectMuscle, userId, fullHistory }) {
  const myPlanAvailable = !!(userId && fullHistory);

  const [chartType, setChartType] = useState(() => {
    const saved = getPrefs().muscleBreakdownChartType;
    const types = myPlanAvailable ? BASE_CHART_TYPES : BASE_CHART_TYPES.filter((c) => c.key !== "myplan");
    return types.some((c) => c.key === saved) ? saved : "bodymap";
  });

  function handleChartTypeChange(type) {
    setChartType(type);
    setPref("muscleBreakdownChartType", type);
  }

  const [planTargets, setPlanTargets] = useState(null);
  useEffect(() => {
    if (!myPlanAvailable) return;
    let cancelled = false;
    fetchMuscleGroupTargets(userId)
      .then((map) => {
        if (cancelled) return;
        const filled = {};
        for (const m of Object.keys(MUSCLE_COLORS)) filled[m] = map[m] ?? DEFAULT_TARGET;
        setPlanTargets(filled);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userId, myPlanAvailable]);

  const planRollingTotals = useMemo(() => (myPlanAvailable ? computeRollingWeeklyTotals(fullHistory) : {}), [fullHistory, myPlanAvailable]);

  const names = new Set([...Object.keys(primary), ...Object.keys(secondary)]);
  const combined = [...names]
    .map((m) => ({ muscle: m, primary: primary[m] || 0, secondary: secondary[m] || 0, total: (primary[m] || 0) + (secondary[m] || 0) }))
    .sort((a, b) => b.total - a.total);

  const hasAnyData = combined.length > 0 || fullBodySets > 0;
  if (!hasAnyData && !myPlanAvailable) {
    return <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "12px 0" }}>Nothing logged yet.</div>;
  }

  const detailed = entries ? computeMuscleSetCounts(entries, "detailed") : { primary: {}, secondary: {} };
  const types = myPlanAvailable ? BASE_CHART_TYPES : BASE_CHART_TYPES.filter((c) => c.key !== "myplan");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 5, marginBottom: 8 }}>
        {types.map((c) => (
          <button key={c.key} onClick={() => handleChartTypeChange(c.key)} style={toggleBtn(chartType === c.key)}>{c.label}</button>
        ))}
      </div>

      {chartType === "myplan" ? (
        planTargets ? (
          <BodyMap mode="plan" targets={planTargets} rollingTotals={planRollingTotals} />
        ) : (
          <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>Loading your plan…</div>
        )
      ) : !hasAnyData ? (
        <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>Nothing logged in this range yet.</div>
      ) : chartType === "bodymap" ? (
        <BodyMap primary={detailed.primary} secondary={detailed.secondary} />
      ) : (
        <RadarView data={combined} />
      )}

      {fullBodySets > 0 && chartType !== "myplan" && (
        <div style={{ textAlign: "center", marginTop: 8, fontSize: 12, color: T.dim }}>
          + Full-body work: <span style={{ color: T.text, fontWeight: 700 }}>{fullBodySets}</span> set{fullBodySets === 1 ? "" : "s"}
        </div>
      )}

      {hasAnyData && <CoverageBreakdown primary={detailed.primary} secondary={detailed.secondary} onSelectMuscle={onSelectMuscle} />}
    </div>
  );
}
