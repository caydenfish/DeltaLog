import { useEffect, useMemo, useRef, useState } from "react";
import BodyMap from "./BodyMap";
import { InlineLoading } from "./LoadingSpinner";
import { getMuscleGroupOptions } from "./lib/muscleTaxonomy";
import { computeRollingWeeklyTotals, computeAverageWeeklyTotals, formatSets } from "./lib/volume";
import { fetchMuscleGroupRanges, saveMuscleGroupRange } from "./lib/queries";
import { getPrefs } from "./lib/prefs";
import { PLAN_NEUTRAL, PLAN_ORANGE, PLAN_GREEN, PLAN_BLUE } from "./lib/planStatus";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

// Default weekly ranges (fractional sets per muscle) by training focus.
// Hypertrophy 10-20 is the widely used evidence-based range; Strength
// and Endurance are practical defaults. Any muscle can be overridden.
export const FOCUS_RANGES = {
  Strength: { min: 6, max: 12 },
  Hypertrophy: { min: 10, max: 20 },
  Endurance: { min: 8, max: 16 },
};

function focusDefault() {
  return FOCUS_RANGES[getPrefs().trainingIdeology] || FOCUS_RANGES.Hypertrophy;
}

// Saved row -> effective range. min 0 means "not tracked". A row saved
// before ranges existed (max null) gets max = 2x min.
function resolveRange(saved, fallback) {
  if (!saved) return { ...fallback, tracked: true };
  const min = saved.min ?? fallback.min;
  if (!min) return { min: 0, max: 0, tracked: false };
  const max = saved.max != null && saved.max >= min ? saved.max : min * 2;
  return { min, max, tracked: true };
}

function statusOf(total, r) {
  if (!r.tracked) return { key: "untracked", color: T.dim, label: "Not tracked" };
  if (total <= 0) return { key: "none", color: PLAN_NEUTRAL, label: "None yet" };
  if (total < r.min) return { key: "under", color: PLAN_ORANGE, label: "Under" };
  if (total > r.max) return { key: "over", color: PLAN_BLUE, label: "Over" };
  return { key: "on", color: PLAN_GREEN, label: "On track" };
}

function RangeBar({ total, range, color }) {
  const scaleMax = Math.max(range.max * 1.25, total, 1);
  const pct = (v) => `${Math.min(100, (v / scaleMax) * 100)}%`;
  return (
    <div style={{ position: "relative", height: 7, background: T.surface2, borderRadius: 4, marginTop: 5 }}>
      {range.tracked && (
        <div style={{ position: "absolute", top: -2, bottom: -2, left: pct(range.min), width: `calc(${pct(range.max)} - ${pct(range.min)})`, border: "1px dashed #565C68", borderRadius: 4 }} />
      )}
      {total > 0 && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: pct(total), background: color, borderRadius: 4 }} />}
    </div>
  );
}

// Weekly volume (v1.14.0): replaces both Muscle breakdown and Weekly Set
// Goals. Fractional weekly sets per muscle (direct 1, indirect 0.5)
// against a target range, colored none / under / on track / over, over
// the last 7 days or as a 4-week average. Tapping a muscle opens its
// direct and indirect sets (onSelectMuscle).
//
// settings: { showMap, rows, window: "7d" | "4w" } from Customize Home.
export default function WeeklyVolumeCard({ userId, history, nameMode, settings, onSettingsChange, onSelectMuscle }) {
  const resolvedNameMode = nameMode || getPrefs().muscleNameMode;
  const options = useMemo(() => getMuscleGroupOptions(resolvedNameMode), [resolvedNameMode]);
  const [saved, setSaved] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const windowKey = settings.window === "4w" ? "4w" : "7d";

  useEffect(() => {
    let cancelled = false;
    fetchMuscleGroupRanges(userId)
      .then((m) => { if (!cancelled) setSaved(m); })
      .catch(() => { if (!cancelled) setSaved({}); });
    return () => { cancelled = true; };
  }, [userId, refreshKey]);

  const totals = useMemo(
    () => (windowKey === "4w" ? computeAverageWeeklyTotals(history, resolvedNameMode, 4) : computeRollingWeeklyTotals(history, resolvedNameMode)),
    [history, resolvedNameMode, windowKey]
  );

  if (saved === null) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <InlineLoading label="Loading weekly volume…" padding="24px 0" />
      </div>
    );
  }

  const fallback = focusDefault();
  const rows = options.map((o) => {
    const range = resolveRange(saved[o.key], fallback);
    const total = totals[o.key] || 0;
    return { muscle: o.key, total, range, status: statusOf(total, range) };
  });
  const tracked = rows.filter((r) => r.range.tracked);
  const onTrack = tracked.filter((r) => r.status.key === "on" || r.status.key === "over").length;
  // Furthest behind first: share of the minimum reached, ascending.
  const ordered = [...tracked].sort((a, b) => a.total / a.range.min - b.total / b.range.min || a.muscle.localeCompare(b.muscle));
  const untracked = rows.filter((r) => !r.range.tracked);
  const limit = Math.max(1, settings.rows || 4);
  const visible = showAll ? [...ordered, ...untracked] : ordered.slice(0, limit);

  const targets = {};
  const targetMax = {};
  for (const r of rows) { targets[r.muscle] = r.range.min; targetMax[r.muscle] = r.range.max; }

  const seg = (key, label) => (
    <button
      key={key}
      onClick={() => onSettingsChange({ ...settings, window: key })}
      style={{ flex: 1, padding: "6px 0", borderRadius: 7, border: "none", background: windowKey === key ? T.line : "none", color: windowKey === key ? T.text : T.dim, fontSize: 12.5, fontWeight: windowKey === key ? 600 : 500 }}
    >{label}</button>
  );

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Weekly volume</div>
        <div style={{ fontSize: 12.5, color: T.dim, whiteSpace: "nowrap" }}>{onTrack} of {tracked.length} on track</div>
      </div>
      <div style={{ display: "flex", background: T.bg, borderRadius: 9, padding: 3, marginTop: 10 }}>
        {seg("7d", "Last 7 days")}
        {seg("4w", "4-week avg")}
      </div>

      {settings.showMap !== false && (
        <div style={{ marginTop: 12 }}>
          <BodyMap mode="plan" targets={targets} targetMax={targetMax} rollingTotals={totals} planNameMode={resolvedNameMode} />
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        {visible.map((r) => (
          <button
            key={r.muscle}
            onClick={() => r.total > 0 && onSelectMuscle({ muscle: r.muscle, windowDays: windowKey === "4w" ? 28 : 7, nameMode: resolvedNameMode })}
            disabled={r.total <= 0}
            style={{ width: "100%", display: "block", background: "none", border: "none", padding: "8px 0", textAlign: "left", cursor: r.total > 0 ? "pointer" : "default" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13.5 }}>
              <span style={{ color: r.range.tracked ? T.text : T.dim }}>{r.muscle}</span>
              <span style={{ color: T.dim, whiteSpace: "nowrap" }}>
                <b style={{ color: r.status.color === PLAN_NEUTRAL ? T.dim : r.status.color, fontWeight: 700 }}>{formatSets(r.total)}</b>
                {r.range.tracked ? ` / ${r.range.min}–${r.range.max}` : " · not tracked"}
              </span>
            </div>
            <RangeBar total={r.total} range={r.range} color={r.status.color} />
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        {(ordered.length > limit || untracked.length > 0) && (
          <button onClick={() => setShowAll(!showAll)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 13, fontWeight: 600 }}>
            {showAll ? "Show less" : `All muscles (${rows.length})`}
          </button>
        )}
        <button onClick={() => setShowEditor(true)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 13, fontWeight: 600 }}>
          Edit targets
        </button>
      </div>
      <div style={{ fontSize: 11.5, color: T.dim, marginTop: 8, lineHeight: 1.45 }}>
        Sets count fully toward muscles an exercise trains directly and half toward muscles it works indirectly.
      </div>

      {showEditor && (
        <WeeklyTargetsEditor
          userId={userId}
          options={options}
          saved={saved}
          onClose={() => { setShowEditor(false); setRefreshKey((k) => k + 1); }}
        />
      )}
    </div>
  );
}

// Full-screen editor for weekly target ranges. Focus presets apply a
// range to every tracked muscle; each muscle can then be tuned (min and
// max separately) or switched off ("not tracked").
export function WeeklyTargetsEditor({ userId, options, saved, onClose }) {
  const fallback = focusDefault();
  const [ranges, setRanges] = useState(() => {
    const out = {};
    for (const o of options) out[o.key] = resolveRange(saved[o.key], fallback);
    return out;
  });
  const [open, setOpen] = useState(null);
  const timers = useRef({});

  function persist(muscle, r) {
    clearTimeout(timers.current[muscle]);
    timers.current[muscle] = setTimeout(() => {
      saveMuscleGroupRange(userId, muscle, r.tracked ? r.min : 0, r.tracked ? r.max : null).catch(() => {});
    }, 400);
  }
  function update(muscle, next) {
    setRanges((prev) => ({ ...prev, [muscle]: next }));
    persist(muscle, next);
  }
  function applyPreset(name) {
    const p = FOCUS_RANGES[name];
    setRanges((prev) => {
      const next = { ...prev };
      for (const o of options) {
        if (!prev[o.key].tracked) continue;
        next[o.key] = { min: p.min, max: p.max, tracked: true };
        persist(o.key, next[o.key]);
      }
      return next;
    });
  }
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const stepBtn = { width: 36, height: 36, borderRadius: 9, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 17, flexShrink: 0 };
  const stepper = (label, value, onDec, onInc) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
      <span style={{ fontSize: 13, color: T.dim }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onDec} style={stepBtn} aria-label={`Decrease ${label}`}>−</button>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.text, minWidth: 28, textAlign: "center" }}>{value}</span>
        <button onClick={onInc} style={stepBtn} aria-label={`Increase ${label}`}>+</button>
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 2000, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 420, padding: "16px 16px 40px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={onClose} aria-label="Back" style={{ background: "none", border: "none", color: T.text, fontSize: 22, padding: "0 6px 0 0" }}>‹</button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: T.text, flex: 1 }}>Weekly targets</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.accent, fontSize: 14, fontWeight: 600 }}>Done</button>
        </div>
        <div style={{ fontSize: 13, color: T.dim, marginTop: 6, lineHeight: 1.5 }}>Sets per week, per muscle. Apply a focus preset to every tracked muscle, then fine-tune any one.</div>
        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          {Object.entries(FOCUS_RANGES).map(([name, r]) => (
            <button key={name} onClick={() => applyPreset(name)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface, color: T.text, fontSize: 12.5 }}>
              {name}<div style={{ fontSize: 11.5, color: T.dim, marginTop: 1 }}>{r.min}–{r.max}</div>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16, borderTop: `1px solid ${T.line}` }}>
          {options.map((o) => {
            const r = ranges[o.key];
            const isOpen = open === o.key;
            return (
              <div key={o.key} style={{ borderBottom: `1px solid ${T.line}` }}>
                <button onClick={() => setOpen(isOpen ? null : o.key)} aria-expanded={isOpen} style={{ width: "100%", minHeight: 48, display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", color: T.text, fontSize: 14.5, padding: 0 }}>
                  <span style={{ color: r.tracked ? T.text : T.dim }}>{o.key}</span>
                  <span style={{ color: T.dim, fontSize: 13.5 }}>{r.tracked ? `${r.min}–${r.max}` : "Not tracked"} {isOpen ? "▴" : "▾"}</span>
                </button>
                {isOpen && (
                  <div style={{ paddingBottom: 12 }}>
                    {r.tracked && (
                      <>
                        {stepper("Minimum", r.min, () => update(o.key, { ...r, min: Math.max(1, r.min - 1) }), () => update(o.key, { ...r, min: r.min + 1, max: Math.max(r.max, r.min + 1) }))}
                        {stepper("Maximum", r.max, () => update(o.key, { ...r, max: Math.max(r.min, r.max - 1) }), () => update(o.key, { ...r, max: r.max + 1 }))}
                      </>
                    )}
                    <button
                      onClick={() => update(o.key, r.tracked ? { min: 0, max: 0, tracked: false } : { ...fallback, tracked: true })}
                      style={{ marginTop: 6, background: "none", border: `1px solid ${T.line}`, borderRadius: 999, color: T.dim, fontSize: 12.5, padding: "6px 12px" }}
                    >
                      {r.tracked ? "Stop tracking this muscle" : "Track this muscle"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
