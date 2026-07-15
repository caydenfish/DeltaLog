import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { RANGES } from "./lib/ranges";

const T = {
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
};

const rangeArrowBtn = (disabled) => ({ width: 20, height: 20, borderRadius: 999, border: `1px solid ${T.line}`, background: T.surface2, color: disabled ? "#3A404B" : T.dim, fontSize: 11, cursor: disabled ? "default" : "pointer", flexShrink: 0 });

export function tickFormatter(ts, range) {
  return range === "365d"
    ? new Date(ts).toLocaleString(undefined, { month: "short" })
    : new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric" });
}

export function labelFormatter(ts, range) {
  if (range === "365d") return new Date(ts).toLocaleString(undefined, { month: "long", year: "numeric" });
  if (range === "30d") return `Week of ${new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric" })}`;
  return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric" });
}

// A compact range switcher meant to live right on each chart's own
// header, rather than one shared control up top -- lets each chart keep
// an independent Training Range (e.g. Bodyweight pinned to 90 Days
// while Volume stays at 30 Days) and stay reachable no matter where
// that chart happens to be scrolled to, without needing sticky-position
// tricks or a separate floating control.
export function RangeSwitcher({ range, onChange }) {
  const idx = RANGES.findIndex((r) => r.key === range);
  function shift(delta) {
    const next = idx + delta;
    if (next < 0 || next >= RANGES.length) return;
    onChange(RANGES[next].key);
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
      <button onClick={() => shift(-1)} disabled={idx === 0} style={rangeArrowBtn(idx === 0)} aria-label="Shorter range">‹</button>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.text, minWidth: 46, textAlign: "center" }}>{RANGES[idx]?.label}</div>
      <button onClick={() => shift(1)} disabled={idx === RANGES.length - 1} style={rangeArrowBtn(idx === RANGES.length - 1)} aria-label="Longer range">›</button>
    </div>
  );
}

// One reusable time-series card for the home dashboard's Volume,
// Bodyweight, and Workout Time charts — they were three near-identical
// copies of the same LineChart before, which meant every tweak (bucket
// widths, tick formats, and now click-to-lock and per-chart ranges) had
// to be made three times in sync. `lockedTs`/`onLock` are lifted up to
// Home so tapping a point on any one of the three highlights that same
// date across all three at once, instead of each chart tracking its own
// selection. `range`/`onRangeChange`, in contrast, are independent per
// card — each chart remembers its own Training Range now rather than
// sharing one.
export default function HomeChartCard({ title, data, dataKey, color, range, onRangeChange, unitLabel, tooltipLabel, valueFormatter, emptyMessage, lockedTs, onLock }) {
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, padding: "0 8px", gap: 8 }}>
        <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, flexShrink: 0 }}>{title}</div>
        <RangeSwitcher range={range} onChange={onRangeChange} />
      </div>
      {lockedPoint && (
        <div style={{ fontSize: 12, color: T.text, fontWeight: 700, padding: "0 8px", marginBottom: 4 }}>
          {valueFormatter(lockedPoint[dataKey])} <span style={{ color: T.dim, fontWeight: 500 }}>on {new Date(lockedPoint.ts).toLocaleString(undefined, { month: "short", day: "numeric" })}</span>
        </div>
      )}
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
