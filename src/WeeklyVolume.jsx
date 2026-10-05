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

// Default weekly ranges (fractional hard sets per muscle) by training
// focus (v1.14.2), each tied to what the research actually supports:
//  - Hypertrophy 10-20: Schoenfeld et al. 2017 (J Sports Sci) found more
//    growth at 10+ weekly sets; Baz-Valle et al. 2022 (J Hum Kinet) and
//    Pelland et al. 2025 (Sports Med) show gains keep rising with volume
//    but with diminishing returns beyond roughly 12-20 sets.
//  - Strength 6-12: strength gains plateau at much lower volumes
//    (Pelland 2025: "strong diminishing returns and a functional
//    plateau"; median strength-study volume 6 sets/week; Ralston et al.
//    2017, Sports Med: >5 weekly sets beat <=5). Strength research
//    counts sets of the tested lift, so per muscle this is a proxy.
//  - Endurance: there's no comparable dose-response research on weekly
//    volume for muscular endurance, so it uses the general hypertrophy
//    guideline rather than an invented number.
// The top of each range marks where returns diminish, not a cap.
export const FOCUS_RANGES = {
  Strength: { min: 6, max: 12 },
  Hypertrophy: { min: 10, max: 20 },
  Endurance: { min: 10, max: 20 },
};
const FOCUS_NOTES = {
  Strength: "Strength gains level off at low weekly volumes. Research counts sets of the lift itself, so treat per-muscle numbers as a rough guide.",
  Hypertrophy: "Growth keeps increasing with more sets, but each extra set adds less beyond roughly 12–20 per week.",
  Endurance: "There's little research on weekly volume for muscular endurance, so this uses the general hypertrophy guideline.",
};

// The "how is this counted" explainer behind the card's info button.
export function VolumeInfo() {
  const p = { fontSize: 12.5, color: T.dim, lineHeight: 1.55, margin: "0 0 8px" };
  const b = { color: T.text, fontWeight: 600 };
  return (
    <div style={{ marginTop: 10, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 12px 4px" }}>
      <p style={p}><span style={b}>What counts.</span> Working sets logged at RIR 4 or less (sets with no RIR logged count too). Warmups and easier sets don't, because the research these ranges come from used sets taken close to failure.</p>
      <p style={p}><span style={b}>Direct and indirect.</span> A set counts as 1 for each muscle the exercise trains directly and 0.5 for each muscle it works indirectly, the method that best predicted results in the largest volume analysis to date.</p>
      <p style={p}><span style={b}>The range.</span> The bottom is the minimum associated with meaningful progress. The top is where each extra set starts adding less, not a limit. Going over isn't harmful on its own.</p>
      <p style={p}><span style={b}>Defaults by focus.</span> Hypertrophy 10–20, Strength 6–12. Endurance uses 10–20, since weekly-volume research for muscular endurance is thin.</p>
      <p style={{ ...p, fontSize: 11.5 }}>Sources: Pelland et al., Sports Medicine 2025 · Schoenfeld et al., J Sports Sci 2017 · Baz-Valle et al., J Hum Kinet 2022 · Robinson et al., Sports Medicine 2024 · Ralston et al., Sports Medicine 2017. Individual responses vary; these are population averages.</p>
    </div>
  );
}

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
  const [showInfo, setShowInfo] = useState(false);
  const windowKey = settings.window === "4w" ? "4w" : "7d";

  useEffect(() => {
    let cancelled = false;
    fetchMuscleGroupRanges(userId)
      .then((m) => { if (!cancelled) setSaved(m); })
      .catch(() => { if (!cancelled) setSaved({}); });
    return () => { cancelled = true; };
  }, [userId, refreshKey]);

  const totals = useMemo(
    () => (windowKey === "4w" ? computeAverageWeeklyTotals(history, resolvedNameMode, 4, { hardOnly: true }) : computeRollingWeeklyTotals(history, resolvedNameMode, { hardOnly: true })),
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
  // Most sets first (v1.14.2). How many show before "All muscles" comes
  // from Customize Home: 0 hides the list, "all" shows every muscle.
  const ordered = [...rows].sort((a, b) => b.total - a.total || a.muscle.localeCompare(b.muscle));
  const limit = settings.rows === "all" ? ordered.length : Math.max(0, Number(settings.rows ?? 4));
  const visible = showAll ? ordered : ordered.slice(0, limit);

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Weekly volume</span>
          <button onClick={() => setShowInfo(!showInfo)} aria-label="How weekly volume is counted" aria-expanded={showInfo} style={{ width: 28, height: 28, borderRadius: 999, border: `1px solid ${showInfo ? T.text : T.line}`, background: "none", color: showInfo ? T.text : T.dim, fontSize: 13, fontWeight: 700, padding: 0 }}>i</button>
        </div>
        <div style={{ fontSize: 12.5, color: T.dim, whiteSpace: "nowrap" }}>{onTrack} of {tracked.length} on track</div>
      </div>
      {showInfo && <VolumeInfo />}
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
            onClick={() => r.total > 0 && onSelectMuscle({ muscle: r.muscle, windowDays: windowKey === "4w" ? 28 : 7, nameMode: resolvedNameMode, hardOnly: true })}
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
        {ordered.length > limit && (
          <button onClick={() => setShowAll(!showAll)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 13, fontWeight: 600 }}>
            {showAll ? "Show less" : `All muscles (${rows.length})`}
          </button>
        )}
        <button onClick={() => setShowEditor(true)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 13, fontWeight: 600 }}>
          Edit targets
        </button>
      </div>
      <div style={{ fontSize: 11.5, color: T.dim, marginTop: 8, lineHeight: 1.45 }}>
        Hard sets only (RIR 4 or less). Direct sets count 1, indirect 0.5. Tap the i for details and sources.
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
  const [saveNote, setSaveNote] = useState(null);
  // Changes save after a short pause, and any still waiting are flushed
  // on Done/back/unmount -- previously closing the editor right after a
  // change cancelled the pending save, so the change didn't stick.
  const timers = useRef({});
  const pending = useRef({});

  function saveNow(muscle) {
    const r = pending.current[muscle];
    if (!r) return Promise.resolve();
    delete pending.current[muscle];
    clearTimeout(timers.current[muscle]);
    return saveMuscleGroupRange(userId, muscle, r.tracked ? r.min : 0, r.tracked ? r.max : null)
      .then((res) => { if (res && res.maxSaved === false) setSaveNote("Minimums saved. To save the upper numbers too, run the 1.14 database update (migration_075) in Supabase."); })
      .catch(() => setSaveNote("Couldn't save some changes. Check your connection and try again."));
  }
  function persist(muscle, r) {
    pending.current[muscle] = r;
    clearTimeout(timers.current[muscle]);
    timers.current[muscle] = setTimeout(() => saveNow(muscle), 400);
  }
  async function close() {
    await Promise.all(Object.keys(pending.current).map(saveNow));
    onClose();
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
  useEffect(() => () => { Object.keys(pending.current).forEach(saveNow); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          <button onClick={close} aria-label="Back" style={{ background: "none", border: "none", color: T.text, fontSize: 22, padding: "0 6px 0 0" }}>‹</button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: T.text, flex: 1 }}>Weekly targets</div>
          <button onClick={close} style={{ background: "none", border: "none", color: T.accent, fontSize: 14, fontWeight: 600 }}>Done</button>
        </div>
        <div style={{ fontSize: 13, color: T.dim, marginTop: 6, lineHeight: 1.5 }}>Hard sets per week, per muscle. Apply a focus preset to every tracked muscle, then fine-tune any one. The upper number is where extra sets start adding less, not a limit.</div>
        {saveNote && <div style={{ marginTop: 10, fontSize: 12.5, color: "#E8A82E", background: "rgba(232,168,46,0.1)", border: "1px solid rgba(232,168,46,0.4)", borderRadius: 10, padding: "8px 10px", lineHeight: 1.45 }}>{saveNote}</div>}
        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          {Object.entries(FOCUS_RANGES).map(([name, r]) => (
            <button key={name} onClick={() => applyPreset(name)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface, color: T.text, fontSize: 12.5 }}>
              {name}<div style={{ fontSize: 11.5, color: T.dim, marginTop: 1 }}>{r.min}–{r.max}</div>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: T.dim, marginTop: 8, lineHeight: 1.5 }}>{FOCUS_NOTES[getPrefs().trainingIdeology] || FOCUS_NOTES.Hypertrophy}</div>
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 12.5, color: T.dim, cursor: "pointer" }}>How these ranges were chosen</summary>
          <VolumeInfo />
        </details>

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
                        {stepper("Diminishing returns", r.max, () => update(o.key, { ...r, max: Math.max(r.min, r.max - 1) }), () => update(o.key, { ...r, max: r.max + 1 }))}
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
