import { useMemo, useState } from "react";
import { T } from "./lib/theme";
import { computeTrainingLoad, LOAD_ZONES, GAUGE_MAX_RATIO } from "./lib/trainingLoad";
import { IconInfo } from "./Icons";

const display = "'Barlow Condensed', sans-serif";

// Semicircle gauge: 180 degrees = ratio 0 to GAUGE_MAX_RATIO, split into
// the four load zones. The needle is the only moving part.
function Gauge({ ratio, zone }) {
  const cx = 100, cy = 100, r = 78, stroke = 12;
  const toXY = (value) => {
    const t = Math.min(1, Math.max(0, value / GAUGE_MAX_RATIO));
    const a = Math.PI * (1 - t);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const arc = (from, to) => {
    const [x1, y1] = toXY(from);
    const [x2, y2] = toXY(to);
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };
  let prev = 0;
  const segments = LOAD_ZONES.map((z) => {
    const end = Math.min(z.max, GAUGE_MAX_RATIO);
    const seg = { z, d: arc(prev + 0.012, end - 0.012) };
    prev = end;
    return seg;
  });
  const needle = ratio == null ? null : toXY(Math.min(ratio, GAUGE_MAX_RATIO));
  return (
    <svg viewBox="0 0 200 112" width="100%" style={{ maxWidth: 240, display: "block", margin: "0 auto" }} aria-hidden="true">
      {segments.map(({ z, d }) => (
        <path key={z.key} d={d} fill="none" stroke={z.color} strokeWidth={stroke} strokeLinecap="butt" opacity={zone && zone.key === z.key ? 1 : 0.28} />
      ))}
      {needle && (
        <>
          <line x1={cx} y1={cy} x2={needle[0]} y2={needle[1]} stroke={T.text} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r="5" fill={T.text} />
        </>
      )}
    </svg>
  );
}

export default function TrainingLoadCard({ history }) {
  const data = useMemo(() => computeTrainingLoad(history), [history]);
  const [showInfo, setShowInfo] = useState(false);
  const maxDay = Math.max(1, ...data.last7.map((d) => d.load));
  const vsBase = data.ratio != null ? Math.round((data.ratio - 1) * 100) : null;

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 14px 14px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: T.text }}>Training load</div>
        <button onClick={() => setShowInfo(!showInfo)} aria-label="How training load works" style={{ background: "none", border: "none", color: showInfo ? T.text : T.dim, padding: 4, display: "flex" }}>
          <IconInfo size={15} />
        </button>
      </div>

      <div style={{ position: "relative" }}>
        <Gauge ratio={data.ratio} zone={data.zone} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, textAlign: "center" }}>
          <div style={{ fontFamily: display, fontSize: 34, fontWeight: 700, color: T.text, lineHeight: 1 }}>{data.acute.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>last 7 days</div>
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: 10 }}>
        {data.baselineReady ? (
          <>
            <div style={{ fontFamily: display, fontSize: 19, fontWeight: 700, color: data.zone.color }}>{data.zone.label}</div>
            <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>
              {vsBase === 0 ? "Right at" : `${Math.abs(vsBase)}% ${vsBase > 0 ? "above" : "below"}`} your 4-week base of {data.base.toLocaleString()}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: T.dim, lineHeight: 1.5 }}>
            Building your base. {data.daysUntilBaseline > 0 ? `${data.daysUntilBaseline} more day${data.daysUntilBaseline === 1 ? "" : "s"} of history` : "A few more sessions"} and this compares each week to what you're used to.
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 54, marginTop: 14 }}>
        {data.last7.map((d) => (
          <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
            <div
              title={`${d.load}`}
              style={{ width: "100%", maxWidth: 22, height: d.load > 0 ? Math.max(4, (d.load / maxDay) * 36) : 3, borderRadius: 3, background: d.load > 0 ? (data.zone ? data.zone.color : T.accent) : T.line, opacity: d.load > 0 ? (d.isToday ? 1 : 0.75) : 1 }}
            />
            <div style={{ fontSize: 10, color: d.isToday ? T.text : T.dim, fontWeight: d.isToday ? 700 : 400 }}>{d.weekday}</div>
          </div>
        ))}
      </div>

      {showInfo && (
        <div style={{ marginTop: 12, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 12, color: T.dim, lineHeight: 1.55 }}>
          {data.zone && <div style={{ color: T.text, marginBottom: 6 }}>{data.zone.copy}</div>}
          Every working set scores up to 10 based on how close to failure you went (your RIR) and how heavy it was relative to your best on that lift. Your 7-day total is compared to your average week over the last 4 weeks. Logging RIR honestly makes this a lot more accurate.
        </div>
      )}
    </div>
  );
}
