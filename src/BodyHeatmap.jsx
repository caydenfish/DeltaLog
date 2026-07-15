import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const T = {
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

// Muted slate for the secondary-muscle bar segment — visually distinct
// from the accent (primary) segment without competing with it.
const SECONDARY_COLOR = "#545C68";

// How many muscles the chart shows before collapsing the rest into the
// "Full breakdown" dropdown — keeps the chart a quick glance rather than
// a wall of bars once Detailed/Scientific naming mode is in play (dozens
// of possible labels). The dropdown list always shows everything.
const CHART_ROW_LIMIT = 8;

function MuscleRow({ muscle, count, role, onSelect }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
      <span style={{ fontSize: 13, color: T.text }}>{muscle}</span>
      <button
        onClick={() => onSelect && onSelect(muscle, role)}
        style={{ fontSize: 12, color: T.dim, fontWeight: 600, background: "none", border: "none", padding: 0, textDecoration: "underline", textDecorationColor: "transparent", cursor: onSelect ? "pointer" : "default" }}
      >
        {count} set{count === 1 ? "" : "s"}
      </button>
    </div>
  );
}

function truncateLabel(v) {
  return v.length > 13 ? `${v.slice(0, 12)}…` : v;
}

// Reports which muscles were trained: a stacked horizontal bar chart
// (Primary vs Secondary sets per muscle) as the default visual, with the
// original plain-language two-list breakdown tucked behind a "Full
// breakdown" dropdown for anyone who wants the exact list. `primary`/
// `secondary` are maps of muscle name -> set count, already grouped and
// labeled at the caller's selected naming granularity (generic/detailed/
// scientific) by computeMuscleSetCounts — no further labeling needed here.
// `fullBodySets`, if present, is shown separately since "Full Body"
// exercises (carries, complexes) don't map to one muscle group.
export default function BodyHeatmap({ primary = {}, secondary = {}, fullBodySets = 0, onSelectMuscle }) {
  const [showList, setShowList] = useState(false);

  const primaryEntries = Object.entries(primary).sort((a, b) => b[1] - a[1]);
  const secondaryEntries = Object.entries(secondary).sort((a, b) => b[1] - a[1]);

  if (primaryEntries.length === 0 && secondaryEntries.length === 0 && fullBodySets === 0) {
    return <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "12px 0" }}>Nothing logged yet.</div>;
  }

  const names = new Set([...Object.keys(primary), ...Object.keys(secondary)]);
  const combined = [...names]
    .map((m) => ({ muscle: m, primary: primary[m] || 0, secondary: secondary[m] || 0, total: (primary[m] || 0) + (secondary[m] || 0) }))
    .sort((a, b) => b.total - a.total);
  const chartRows = combined.slice(0, CHART_ROW_LIMIT);
  const chartHeight = chartRows.length * 32 + 8;

  function handleBarClick(role) {
    return (data) => {
      if (!onSelectMuscle || !data?.payload) return;
      const count = role === "primary" ? data.payload.primary : data.payload.secondary;
      if (count > 0) onSelectMuscle(data.payload.muscle, role);
    };
  }

  return (
    <div>
      {combined.length > 0 && (
        <>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={chartRows} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="muscle" width={96} tickFormatter={truncateLabel} tick={{ fill: T.dim, fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8 }}
            labelStyle={{ color: T.text, fontWeight: 700, marginBottom: 2 }}
            itemStyle={{ color: T.dim, fontSize: 12 }}
            formatter={(value, key) => [`${value} set${value === 1 ? "" : "s"}`, key === "primary" ? "Primary" : "Secondary"]}
          />
          <Bar dataKey="primary" stackId="muscle" fill={T.accent} radius={[4, 0, 0, 4]} onClick={handleBarClick("primary")} cursor={onSelectMuscle ? "pointer" : "default"} />
          <Bar dataKey="secondary" stackId="muscle" fill={SECONDARY_COLOR} radius={[0, 4, 4, 0]} onClick={handleBarClick("secondary")} cursor={onSelectMuscle ? "pointer" : "default"} />
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: T.accent, display: "inline-block" }} />
          <span style={{ fontSize: 11, color: T.dim }}>Primary</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: SECONDARY_COLOR, display: "inline-block" }} />
          <span style={{ fontSize: 11, color: T.dim }}>Secondary</span>
        </div>
      </div>

      <button
        onClick={() => setShowList(!showList)}
        style={{ width: "100%", background: "none", border: "none", color: T.dim, fontSize: 12, fontWeight: 600, padding: "10px 0 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
      >
        Full breakdown ({combined.length}) {showList ? "▲" : "▼"}
      </button>

      {showList && (
        <div style={{ marginTop: 6, paddingTop: 8, borderTop: `1px solid ${T.line}` }}>
          {primaryEntries.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Primary muscles</div>
              {primaryEntries.map(([m, c]) => <MuscleRow key={m} muscle={m} count={c} role="primary" onSelect={onSelectMuscle} />)}
            </>
          )}
          {secondaryEntries.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, margin: primaryEntries.length ? "10px 0 4px" : "0 0 4px" }}>Secondary muscles</div>
              {secondaryEntries.map(([m, c]) => <MuscleRow key={m} muscle={m} count={c} role="secondary" onSelect={onSelectMuscle} />)}
            </>
          )}
        </div>
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
