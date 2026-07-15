import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";

const T = {
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
};

function tickFormatter(ts, range) {
  return range === "365d"
    ? new Date(ts).toLocaleString(undefined, { month: "short" })
    : new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric" });
}

function labelFormatter(ts, range) {
  if (range === "365d") return new Date(ts).toLocaleString(undefined, { month: "long", year: "numeric" });
  if (range === "30d") return `Week of ${new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric" })}`;
  return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric" });
}

// One reusable time-series card for the home dashboard's Volume,
// Bodyweight, and Workout Time charts — they were three near-identical
// copies of the same LineChart before, which meant every tweak (bucket
// widths, tick formats, and now click-to-lock) had to be made three
// times in sync. `lockedTs`/`onLock` are lifted up to Home so tapping a
// point on any one of the three highlights that same date across all
// three at once, instead of each chart tracking its own selection.
export default function HomeChartCard({ title, data, dataKey, color, range, unitLabel, tooltipLabel, valueFormatter, emptyMessage, lockedTs, onLock }) {
  const lockedPoint = lockedTs != null ? data.find((d) => d.ts === lockedTs) : null;

  function handleClick(state, event) {
    // Without this, the click bubbles up to the scroll container's own
    // onClick (which clears the lock on any tap outside a chart) and
    // would immediately undo the selection this same tap just made.
    event?.stopPropagation?.();
    if (state && state.activeLabel != null) onLock(state.activeLabel);
  }

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 8px 8px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, padding: "0 8px" }}>
        <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>{title}</div>
        {lockedPoint && (
          <div style={{ fontSize: 12, color: T.text, fontWeight: 700 }}>
            {valueFormatter(lockedPoint[dataKey])} <span style={{ color: T.dim, fontWeight: 500 }}>on {new Date(lockedPoint.ts).toLocaleString(undefined, { month: "short", day: "numeric" })}</span>
          </div>
        )}
      </div>
      {data.length === 0 ? (
        <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>{emptyMessage}</div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 4, right: 12, left: -20, bottom: 0 }} onClick={handleClick}>
            <CartesianGrid stroke={T.line} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="ts"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tick={{ fill: T.dim, fontSize: 10 }}
              tickFormatter={(ts) => tickFormatter(ts, range)}
            />
            <YAxis tick={{ fill: T.dim, fontSize: 10 }} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: T.text }}
              labelFormatter={(ts) => labelFormatter(ts, range)}
              formatter={(v) => [`${valueFormatter(v)}`, tooltipLabel]}
            />
            {lockedTs != null && <ReferenceLine x={lockedTs} stroke={T.text} strokeDasharray="4 4" strokeWidth={1.5} />}
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
