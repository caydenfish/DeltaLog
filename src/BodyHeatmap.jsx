import { useState } from "react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, ResponsiveContainer } from "recharts";
import { getPrefs, setPref } from "./lib/prefs";
import { computeMuscleSetCounts } from "./lib/volume";
import BodyMap from "./BodyMap";

const T = {
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

const CHART_TYPES = [
  { key: "bodymap", label: "Body map" },
  { key: "radar", label: "Radar" },
];

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
  const radarData = data.map((d) => ({ muscle: truncateLabel(d.muscle), total: d.total }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={radarData} outerRadius="72%">
        <PolarGrid stroke={T.line} />
        <PolarAngleAxis dataKey="muscle" tick={{ fill: T.dim, fontSize: 10 }} />
        <PolarRadiusAxis tick={false} axisLine={false} />
        <Radar dataKey="total" stroke={T.accent} fill={T.accent} fillOpacity={0.35} />
        <Tooltip
          contentStyle={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8 }}
          labelStyle={{ color: T.text, fontWeight: 700 }}
          itemStyle={{ color: T.dim, fontSize: 12 }}
          formatter={(value) => [`${value} set${value === 1 ? "" : "s"}`, "Total"]}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// Reports which muscles were trained, with a choice of two views that
// persists across every screen this renders on (Home, live workout,
// template builder) until changed again: an anatomical Body map (front +
// back silhouette, tap a muscle for its exact count) or a Radar shape
// (quick "is my training balanced" read). `primary`/`secondary` are maps
// of muscle name -> set count at the caller's selected naming mode
// (generic/detailed/scientific), used by Radar. `entries` is the same
// raw volume-entry array the caller fed into computeMuscleSetCounts to
// produce those — Body map needs its own pass at a fixed "detailed" tier
// regardless of the naming-mode preference, since that's the resolution
// the underlying anatomical art is actually drawn at (see BodyMap.jsx).
// `fullBodySets`, if present, is shown separately since "Full Body"
// exercises (carries, complexes) don't map to one muscle region.
export default function BodyHeatmap({ primary = {}, secondary = {}, fullBodySets = 0, entries }) {
  const [chartType, setChartType] = useState(() => {
    const saved = getPrefs().muscleBreakdownChartType;
    return CHART_TYPES.some((c) => c.key === saved) ? saved : "bodymap";
  });

  function handleChartTypeChange(type) {
    setChartType(type);
    setPref("muscleBreakdownChartType", type);
  }

  const names = new Set([...Object.keys(primary), ...Object.keys(secondary)]);
  const combined = [...names]
    .map((m) => ({ muscle: m, primary: primary[m] || 0, secondary: secondary[m] || 0, total: (primary[m] || 0) + (secondary[m] || 0) }))
    .sort((a, b) => b.total - a.total);

  if (combined.length === 0 && fullBodySets === 0) {
    return <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "12px 0" }}>Nothing logged yet.</div>;
  }

  const detailed = entries ? computeMuscleSetCounts(entries, "detailed") : { primary: {}, secondary: {} };

  return (
    <div>
      {combined.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 5, marginBottom: 8 }}>
            {CHART_TYPES.map((c) => (
              <button key={c.key} onClick={() => handleChartTypeChange(c.key)} style={toggleBtn(chartType === c.key)}>{c.label}</button>
            ))}
          </div>
          {chartType === "bodymap" ? (
            <BodyMap primary={detailed.primary} secondary={detailed.secondary} />
          ) : (
            <RadarView data={combined} />
          )}
        </>
      )}

      {fullBodySets > 0 && (
        <div style={{ textAlign: "center", marginTop: combined.length > 0 ? 8 : 0, fontSize: 12, color: T.dim }}>
          + Full-body work: <span style={{ color: T.text, fontWeight: 700 }}>{fullBodySets}</span> set{fullBodySets === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}
