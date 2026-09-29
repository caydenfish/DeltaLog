import { useEffect, useState } from "react";
import { T } from "./lib/theme";
import { SCHEME_PRESETS, resizeScheme, cleanRange, formatRange } from "./lib/repScheme";

// Per-set rep targets for one exercise. Used by the template builder and
// the in-workout target menu, so both edit schemes the same way.
//
// `scheme` null = follow the training focus (`fallback`) for every set.
// onChange receives the new scheme array, or null for "follow focus".
export default function RepSchemeEditor({ planned, scheme, fallback, focusLabel, onChange }) {
  const custom = Array.isArray(scheme) && scheme.length > 0;
  const sized = custom ? resizeScheme(scheme, planned, fallback) : null;

  // String drafts so a field can be briefly empty or mid-typing without
  // snapping back; committed to the parent whenever the pair is valid.
  const [drafts, setDrafts] = useState(() => (sized || []).map((r) => ({ low: String(r.low), high: String(r.high) })));
  const sizedKey = sized ? sized.map(formatRange).join("|") : "";
  useEffect(() => {
    setDrafts((sized || []).map((r) => ({ low: String(r.low), high: String(r.high) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizedKey]);

  function commit(nextDrafts) {
    const next = nextDrafts.map((d, i) => {
      const lo = parseInt(d.low, 10);
      const hi = parseInt(d.high, 10);
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) return sized[i];
      return cleanRange({ low: Math.min(lo, hi), high: Math.max(lo, hi) });
    });
    onChange(next);
  }

  function edit(i, field, value) {
    const v = value.replace(/[^0-9]/g, "").slice(0, 3);
    const next = drafts.map((d, k) => (k === i ? { ...d, [field]: v } : d));
    setDrafts(next);
    const lo = parseInt(next[i].low, 10);
    const hi = parseInt(next[i].high, 10);
    if (Number.isFinite(lo) && Number.isFinite(hi) && lo >= 1 && lo <= hi) commit(next);
  }

  const seg = (active) => ({
    flex: 1, minWidth: 0, padding: "8px 6px", borderRadius: 7, border: "none", fontSize: 12.5, fontWeight: 700,
    background: active ? T.accent : "transparent", color: active ? "#fff" : T.dim,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  });
  const numInput = { width: 46, textAlign: "center", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 15, fontWeight: 700, padding: "7px 0", outline: "none", fontFamily: "'Barlow Condensed', sans-serif" };

  return (
    <div>
      <div style={{ display: "flex", gap: 4, background: T.surface2, borderRadius: 10, padding: 3 }}>
        <button type="button" onClick={() => onChange(null)} style={seg(!custom)}>
          {focusLabel} {formatRange(fallback)}
        </button>
        <button
          type="button"
          onClick={() => !custom && onChange(Array.from({ length: planned }, () => ({ ...fallback })))}
          style={seg(custom)}
        >
          Custom per set
        </button>
      </div>

      {custom && (
        <>
          <div style={{ display: "flex", gap: 6, marginTop: 10, overflowX: "auto" }} className="no-scrollbar">
            {SCHEME_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => onChange(p.build(planned, fallback))}
                style={{ flexShrink: 0, whiteSpace: "nowrap", padding: "5px 11px", borderRadius: 999, border: `1px solid ${T.line}`, background: T.surface, color: T.text, fontSize: 12, fontWeight: 600 }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            {drafts.map((d, i) => {
              const changed = i > 0 && (sized[i].low !== sized[i - 1].low || sized[i].high !== sized[i - 1].high);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 48, flexShrink: 0, fontSize: 12, color: changed ? T.accent : T.dim, fontWeight: 700, whiteSpace: "nowrap" }}>Set {i + 1}</div>
                  <input
                    inputMode="numeric"
                    aria-label={`Set ${i + 1} minimum reps`}
                    value={d.low}
                    onChange={(e) => edit(i, "low", e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onBlur={() => setDrafts(sized.map((r) => ({ low: String(r.low), high: String(r.high) })))}
                    style={numInput}
                  />
                  <span style={{ color: T.dim, fontSize: 13 }}>to</span>
                  <input
                    inputMode="numeric"
                    aria-label={`Set ${i + 1} maximum reps`}
                    value={d.high}
                    onChange={(e) => edit(i, "high", e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onBlur={() => setDrafts(sized.map((r) => ({ low: String(r.low), high: String(r.high) })))}
                    style={numInput}
                  />
                  <span style={{ color: T.dim, fontSize: 12 }}>reps</span>
                  {changed && <span style={{ marginLeft: "auto", fontSize: 10.5, color: T.accent, fontWeight: 700, whiteSpace: "nowrap" }}>Auto-adjusts</span>}
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: T.dim, marginTop: 8, lineHeight: 1.45 }}>
            When a set's range changes from the one before it, its suggested weight is checked against how today's previous set actually went, and lowered if you're having an off day.
          </div>
        </>
      )}
    </div>
  );
}
