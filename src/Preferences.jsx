import { useState } from "react";
import { getPrefs, setPref } from "./lib/prefs";
import { IDEOLOGIES } from "./lib/ideologies";
import { PROGRESSION_MODELS, PROGRESSION_MODEL_DESCRIPTIONS } from "./lib/programEngine";
import { defaultWarmupPercents, getWarmupPercents } from "./lib/warmup";
import { REST_TIMER_SOUNDS, REST_TIMER_VIBRATIONS, playRestTimerSound, triggerRestTimerVibration, notificationsSupported, getNotificationPermission, requestNotificationPermission, showRestTimerNotification } from "./lib/restTimerCues";
import { IconChevronUp, IconChevronDown } from "./Icons";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

const navRowBtn = { width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" };

// Simple sliding on/off switch, used by the Rest Timers subsection.
// No existing toggle-switch component in the app (other booleans use
// segmented PillRow-style buttons), so this is a small, self-contained
// one rather than a two-option pill row -- a literal on/off slider reads
// clearer for "is this feature on" than two buttons labeled On/Off.
function ToggleSwitch({ checked, onChange, ariaLabel }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      aria-label={ariaLabel}
      aria-pressed={checked}
      style={{
        width: 44, height: 26, borderRadius: 999, border: `1px solid ${checked ? T.accent : T.line}`,
        background: checked ? T.accent : T.surface2, position: "relative", flexShrink: 0, padding: 0,
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      <div style={{
        position: "absolute", top: 2, left: checked ? 20 : 2, width: 20, height: 20, borderRadius: 999,
        background: "#fff", transition: "left 0.15s",
      }} />
    </button>
  );
}

// Collapsible group used to break the Training Preferences sub-screen
// into digestible chunks instead of one long scroll of every field at
// once -- collapsed by default, so opening Training Preferences shows
// two clearly-labeled groups to choose between rather than everything
// jammed onto one screen simultaneously.
function Section({ title, subtitle, open, onToggle, children }) {
  return (
    <div style={{ marginBottom: 12, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, overflow: "hidden" }}>
      <button
        onClick={onToggle}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: "none", border: "none", padding: 14, textAlign: "left" }}
      >
        <div>
          <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>{title}</div>
          {subtitle && <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>{subtitle}</div>}
        </div>
        <div style={{ color: T.dim, flexShrink: 0, display: "flex", alignItems: "center" }}>{open ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}</div>
      </button>
      {open && <div style={{ padding: "0 14px 16px" }}>{children}</div>}
    </div>
  );
}

// Full-screen sub-page shell, matching the same pattern used by
// ProfileEditor/ExerciseLibraryView (fixed inset, back chevron, centered
// title) — used so "Units" and "Training Preferences" behave as real
// navigable screens like every other settings destination, instead of an
// inline accordion that expanded in place.
function SubScreen({ title, onBack, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 40, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 420, minHeight: "100vh", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8, position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
          <button onClick={onBack} aria-label="Back" style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 13 }}>&#8249;</button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.text, textAlign: "center" }}>{title.toUpperCase()}</div>
          <div style={{ width: 26 }} />
        </div>
        <div style={{ padding: 16, flex: 1, boxSizing: "border-box" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// Renders the preferences UI against either:
//  - controlled state (pass `value` + `onChange`) — used in Home/Settings,
//    which already caches these prefs in its own state for the dashboard
//    (weight chart, muscle labels, units) and must stay the source of
//    truth so those stay in sync.
//  - self-managed state (omit both) — used in the in-workout menu, which
//    has no equivalent cached copies and can just read/write lib/prefs.js
//    directly.
export default function Preferences({ value, onChange, fields, onApplyRestToAll, filterQuery }) {
  const show = (key) => !fields || fields.includes(key);
  const controlled = value !== undefined && onChange !== undefined;
  const [confirmApplyAll, setConfirmApplyAll] = useState(false);
  const [applyingAll, setApplyingAll] = useState(false);
  const [local, setLocal] = useState(() => ({
    units: getPrefs().units,
    muscleNameMode: getPrefs().muscleNameMode,
    bodyModelSex: getPrefs().bodyModelSex,
    scoreDisplay: getPrefs().scoreDisplay,
    weightEntryMode: getPrefs().weightEntryMode,
    restSeconds: getPrefs().restSeconds,
    warmupRestSeconds: getPrefs().warmupRestSeconds,
    warmupRestEnabled: getPrefs().warmupRestEnabled,
    restTimerSoundEnabled: getPrefs().restTimerSoundEnabled,
    restTimerSound: getPrefs().restTimerSound,
    restTimerVibrationEnabled: getPrefs().restTimerVibrationEnabled,
    restTimerVibration: getPrefs().restTimerVibration,
    restTimerNotificationEnabled: getPrefs().restTimerNotificationEnabled,
    plate55Scope: getPrefs().plate55Scope,
    trainingIdeology: getPrefs().trainingIdeology,
    targetCalcMethod: getPrefs().targetCalcMethod,
    timeFormat: getPrefs().timeFormat,
    warmupPercentSchemes: getPrefs().warmupPercentSchemes,
  }));
  const [showScoreInfo, setShowScoreInfo] = useState(false);
  const [showIdeologyInfo, setShowIdeologyInfo] = useState(false);
  const [showTargetCalcInfo, setShowTargetCalcInfo] = useState(false);
  // Which grouped sub-screen (if any) is open. Replaces the old
  // showTrainingPrefs/showUnitsGroup accordion-toggle booleans now that
  // "Units" and "Training Preferences" are real full-screen destinations
  // (SubScreen) rather than inline-expanding sections.
  const [screen, setScreen] = useState(null); // null | "units" | "training"
  const [openTrainingSection, setOpenTrainingSection] = useState(null); // null | "focus" | "restTimer" | "warmupWeights"
  const [warmupSchemeCount, setWarmupSchemeCount] = useState(2); // which warmup-count's percentages are shown in the editor
  const [notifPermission, setNotifPermission] = useState(() => getNotificationPermission());

  async function handleToggleRestTimerNotification(v) {
    if (v) {
      const result = await requestNotificationPermission();
      setNotifPermission(result);
      if (result === "granted") update("restTimerNotificationEnabled", true);
      // Denied or unsupported: leave it off, nothing to actually enable.
    } else {
      update("restTimerNotificationEnabled", false);
    }
  }
  const state = controlled ? value : local;

  // Search keywords per row, used only when `filterQuery` is passed in
  // (currently just the Settings screen search box). A row with no match
  // gets hidden rather than the component rendering "no results" chrome —
  // Settings stays a normal scrollable page, just a shorter one.
  const KEYWORDS = {
    units: "units weight display lb kg pounds kilograms",
    timeFormat: "time format 12h 24h clock hour am pm",
    scientificNames: "muscle names generic detailed scientific anatomy nomenclature",
    bodyModelSex: "body map model male female heatmap silhouette",
    trainingIdeology: "training focus rep range hypertrophy strength endurance ideology methodology default",
    scoreDisplay: "strength score dots percentile deltalog",
    targetCalcMethod: "target calculation method progression double progression percent e1rm rir autoregulation",
    weightEntryMode: "default set entry manual plate calculator logging type",
    plateSizes: "big plates 55 lb 25 kg bumpers squats deadlifts",
    restSeconds: "rest timer default seconds",
    warmupRestSeconds: "warmup rest timer default seconds",
    warmupRestEnabled: "rest timers separate warmup working sets toggle enable disable",
    restTimerSoundEnabled: "rest timer sound audio chime bell beep digital end alert cue",
    restTimerVibrationEnabled: "rest timer vibration vibrate haptic pulse buzz end alert cue",
    restTimerNotificationEnabled: "rest timer notification push alert end cue",
    warmupPercentSchemes: "warmup set weight percent percentage top set ramp science",
  };
  const matches = (key) => !filterQuery || KEYWORDS[key].includes(filterQuery.trim().toLowerCase());
  const searchActive = !!filterQuery;
  // A row inside "Units" or "Training Preferences" should still be
  // findable by search without requiring a tap into that sub-screen —
  // shown inline, right in the settings list, while a search is active.
  const unitsSearchMatch = searchActive && ["units", "timeFormat"].some(matches);
  const trainingSearchMatch = searchActive && ["trainingIdeology", "scoreDisplay", "targetCalcMethod", "weightEntryMode", "plateSizes", "scientificNames", "restSeconds", "warmupRestSeconds", "warmupRestEnabled", "restTimerSoundEnabled", "restTimerVibrationEnabled", "restTimerNotificationEnabled", "warmupPercentSchemes"].some(matches);

  function update(key, val) {
    if (controlled) {
      onChange(key, val);
    } else {
      setPref(key, val);
      setLocal((prev) => ({ ...prev, [key]: val }));
    }
  }

  const { units, muscleNameMode, bodyModelSex, scoreDisplay, weightEntryMode, restSeconds, warmupRestSeconds, warmupRestEnabled, restTimerSoundEnabled, restTimerSound, restTimerVibrationEnabled, restTimerVibration, restTimerNotificationEnabled, trainingIdeology, targetCalcMethod, warmupPercentSchemes } = state;
  // Grouping into "Units" / "Training Preferences" sub-screens only
  // applies to the full/unrestricted Settings usage (no `fields` prop).
  // The in-workout menu passes an explicit fields subset and keeps its
  // current flat layout — those need to stay one tap away mid-workout,
  // not buried behind sub-screen navigation.
  const grouped = !fields;

  // ---- Shared field content for the grouped ("Units" / "Training
  // Preferences") sub-screens, reused for both the full-screen view and
  // the inline-during-search view. ----

  function renderUnitsFields() {
    return (
      <>
        {matches("units") && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ color: T.text, fontSize: 14 }}>Weight Units</div>
            <div style={{ color: T.dim, fontSize: 11 }}>Weight display and input across the app</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {["lb", "kg"].map((u) => (
              <button key={u} onClick={() => update("units", u)} style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: `1px solid ${units === u ? T.accent : T.line}`,
                background: units === u ? "rgba(232,68,46,0.12)" : T.surface2,
                color: units === u ? T.text : T.dim,
              }}>{u}</button>
            ))}
          </div>
        </div>
        )}

        {matches("timeFormat") && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: T.text, fontSize: 14 }}>Time format</div>
            <div style={{ color: T.dim, fontSize: 11 }}>How clock times are shown, e.g. workout start time in History</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[{ key: "12h", label: "12h" }, { key: "24h", label: "24h" }].map((opt) => (
              <button key={opt.key} onClick={() => update("timeFormat", opt.key)} style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: `1px solid ${state.timeFormat === opt.key ? T.accent : T.line}`,
                background: state.timeFormat === opt.key ? "rgba(232,68,46,0.12)" : T.surface2,
                color: state.timeFormat === opt.key ? T.text : T.dim,
              }}>{opt.label}</button>
            ))}
          </div>
        </div>
        )}
      </>
    );
  }

  function renderTrainingFields() {
    return (
      <>
        {matches("trainingIdeology") && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ color: T.text, fontSize: 14 }}>Training focus</div>
              <button onClick={() => setShowIdeologyInfo(!showIdeologyInfo)} aria-label="What's the difference?" style={{ width: 16, height: 16, borderRadius: 999, border: `1px solid ${T.dim}`, background: "none", color: T.dim, fontSize: 10, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }}>i</button>
            </div>
          </div>
          {showIdeologyInfo && (
            <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: 10, marginBottom: 8, fontSize: 12, color: T.dim, lineHeight: 1.5 }}>
              {Object.entries(IDEOLOGIES).map(([name, v]) => (
                <div key={name} style={{ marginBottom: name === "Endurance" ? 0 : 8 }}>
                  <b style={{ color: T.text }}>{name}</b> ({v.low}-{v.high} reps) — {v.desc}
                </div>
              ))}
            </div>
          )}
          <div style={{ color: T.dim, fontSize: 11, marginBottom: 8 }}>Default rep range target for new workouts — override any exercise on the fly</div>
          <div style={{ display: "flex", background: T.surface2, borderRadius: 10, padding: 3, gap: 3 }}>
            {Object.keys(IDEOLOGIES).map((name) => (
              <button
                key={name}
                onClick={() => update("trainingIdeology", name)}
                aria-pressed={trainingIdeology === name}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, border: "none",
                  background: trainingIdeology === name ? T.accent : "transparent",
                  color: trainingIdeology === name ? "#fff" : T.dim,
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
        )}

        {matches("scoreDisplay") && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ color: T.text, fontSize: 14 }}>Strength score</div>
              <button onClick={() => setShowScoreInfo(!showScoreInfo)} aria-label="What's the difference?" style={{ width: 16, height: 16, borderRadius: 999, border: `1px solid ${T.dim}`, background: "none", color: T.dim, fontSize: 10, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }}>i</button>
            </div>
          </div>
          {showScoreInfo && (
            <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: 10, marginBottom: 8, fontSize: 12, color: T.dim, lineHeight: 1.5 }}>
              <b style={{ color: T.text }}>DeltaLog Percentile</b> ranks your all-time best lift against other real DeltaLog users — it reflects how you actually compare to people using this app.
              <br /><br />
              <b style={{ color: T.text }}>DOTS</b> is a formula built around elite/competitive powerlifting standards. If you're not training at that level, it will score you low — that's a limitation of the formula, not a reflection of your training. It's here for advanced lifters who specifically want a bodyweight-normalized competition-style score, not as the default measuring stick.
            </div>
          )}
          <div style={{ color: T.dim, fontSize: 11, marginBottom: 8 }}>Shown on your workout summary</div>
          <div style={{ display: "flex", background: T.surface2, borderRadius: 10, padding: 3, gap: 3 }}>
            {[{ key: "percentile", label: "DeltaLog Percentile" }, { key: "dots", label: "DOTS (Advanced)" }, { key: "none", label: "None" }].map((opt) => (
              <button
                key={opt.key}
                onClick={() => update("scoreDisplay", opt.key)}
                aria-pressed={scoreDisplay === opt.key}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, border: "none",
                  background: scoreDisplay === opt.key ? T.accent : "transparent",
                  color: scoreDisplay === opt.key ? "#fff" : T.dim,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {scoreDisplay === "none" && (
            <div style={{ color: T.dim, fontSize: 11, marginTop: 6, lineHeight: 1.4 }}>
              No strength score shown. Nothing is compared against other users.
            </div>
          )}
        </div>
        )}

        {matches("targetCalcMethod") && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <div style={{ color: T.text, fontSize: 14 }}>Target calculation method</div>
            <button onClick={() => setShowTargetCalcInfo(!showTargetCalcInfo)} aria-label="What's the difference?" style={{ width: 16, height: 16, borderRadius: 999, border: `1px solid ${T.dim}`, background: "none", color: T.dim, fontSize: 10, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }}>i</button>
          </div>
          {showTargetCalcInfo && (
            <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: 10, marginBottom: 8, fontSize: 12, color: T.dim, lineHeight: 1.5 }}>
              {Object.entries(PROGRESSION_MODELS).map(([key, label]) => (
                <div key={key} style={{ marginBottom: key === "rir_autoregulation" ? 0 : 8 }}>
                  <b style={{ color: T.text }}>{label}</b> — {PROGRESSION_MODEL_DESCRIPTIONS[key]}
                </div>
              ))}
            </div>
          )}
          <div style={{ color: T.dim, fontSize: 11, marginBottom: 8 }}>How the weight/reps suggested for your next set is worked out</div>
          <div style={{ display: "flex", flexDirection: "column", background: T.surface2, borderRadius: 10, padding: 3, gap: 3 }}>
            {Object.entries(PROGRESSION_MODELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => update("targetCalcMethod", key)}
                aria-pressed={targetCalcMethod === key}
                style={{
                  padding: "8px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, border: "none",
                  background: targetCalcMethod === key ? T.accent : "transparent",
                  color: targetCalcMethod === key ? "#fff" : T.dim,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        )}

        {matches("weightEntryMode") && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div>
              <div style={{ color: T.text, fontSize: 14 }}>Default set entry</div>
              <div style={{ color: T.dim, fontSize: 11 }}>How weight opens when logging a set. RIR stays at the bottom either way.</div>
            </div>
          </div>
          <div style={{ display: "flex", background: T.surface2, borderRadius: 10, padding: 3, gap: 3 }}>
            {[{ key: "manual", label: "Manual entry" }, { key: "plate", label: "Plate calculator" }].map((opt) => (
              <button
                key={opt.key}
                onClick={() => update("weightEntryMode", opt.key)}
                aria-pressed={weightEntryMode === opt.key}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, border: "none",
                  background: weightEntryMode === opt.key ? T.accent : "transparent",
                  color: weightEntryMode === opt.key ? "#fff" : T.dim,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        )}

        {matches("plateSizes") && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ color: T.text, fontSize: 14 }}>Big plates ({units === "kg" ? "25 kg" : "55 lb"})</div>
            <div style={{ color: T.dim, fontSize: 11 }}>Some gyms only stock these as bumpers for squats and deadlifts, not bench</div>
          </div>
          <div style={{ display: "flex", background: T.surface2, borderRadius: 10, padding: 3, gap: 3 }}>
            {[{ key: "off", label: "Off" }, { key: "lower", label: "Squats & deadlifts" }, { key: "all", label: "All lifts" }].map((opt) => (
              <button
                key={opt.key}
                onClick={() => update("plate55Scope", opt.key)}
                aria-pressed={state.plate55Scope === opt.key}
                style={{
                  flex: 1, padding: "8px 4px", borderRadius: 7, fontSize: 11.5, fontWeight: 600, border: "none",
                  background: state.plate55Scope === opt.key ? T.accent : "transparent",
                  color: state.plate55Scope === opt.key ? "#fff" : T.dim,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        )}

        {matches("scientificNames") && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ color: T.text, fontSize: 14 }}>Muscle names</div>
              <div style={{ color: T.dim, fontSize: 11 }}>e.g. Chest (Category) vs Upper Chest (Region) vs Pectoralis Major, Clavicular Head (Anatomy)</div>
            </div>
          </div>
          <div style={{ display: "flex", background: T.surface2, borderRadius: 10, padding: 3, gap: 3 }}>
            {[{ key: "generic", label: "Category" }, { key: "detailed", label: "Region" }, { key: "scientific", label: "Anatomy" }].map((opt) => (
              <button
                key={opt.key}
                onClick={() => update("muscleNameMode", opt.key)}
                aria-pressed={muscleNameMode === opt.key}
                style={{ flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, border: "none", background: muscleNameMode === opt.key ? T.accent : "transparent", color: muscleNameMode === opt.key ? "#fff" : T.dim }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        )}

        {matches("bodyModelSex") && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ color: T.text, fontSize: 14 }}>Body map model</div>
              <div style={{ color: T.dim, fontSize: 11 }}>Which body shows on your muscle heatmap</div>
            </div>
          </div>
          <div style={{ display: "flex", background: T.surface2, borderRadius: 10, padding: 3, gap: 3 }}>
            {[{ key: "male", label: "Male" }, { key: "female", label: "Female" }].map((opt) => (
              <button
                key={opt.key}
                onClick={() => update("bodyModelSex", opt.key)}
                aria-pressed={bodyModelSex === opt.key}
                style={{ flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, border: "none", background: bodyModelSex === opt.key ? T.accent : "transparent", color: bodyModelSex === opt.key ? "#fff" : T.dim }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        )}

      </>
    );
  }

  function renderRestTimerFields() {
    return (
      <>
        {(matches("restSeconds") || matches("warmupRestSeconds") || matches("warmupRestEnabled")) && (
        <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ paddingRight: 12 }}>
            <div style={{ color: T.text, fontSize: 14 }}>Separate warmup rest timer</div>
            <div style={{ color: T.dim, fontSize: 11 }}>Use a shorter rest after warmup sets than working sets</div>
          </div>
          <ToggleSwitch checked={warmupRestEnabled} onChange={(v) => update("warmupRestEnabled", v)} ariaLabel="Separate warmup rest timer" />
        </div>

        <div style={{ marginBottom: warmupRestEnabled ? 14 : 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: T.text, fontSize: 14 }}>{warmupRestEnabled ? "Default working set rest timer" : "Default rest timer"}</div>
              <div style={{ color: T.dim, fontSize: 11 }}>{warmupRestEnabled ? "Starts a new workout's rest countdown for working sets" : "Starts a new workout's rest countdown for every set"}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => update("restSeconds", Math.max(15, restSeconds - 15))} style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 15, fontWeight: 700 }}>−</button>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, color: T.text, minWidth: 44, textAlign: "center" }}>
                {Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, "0")}
              </div>
              <button onClick={() => update("restSeconds", Math.min(600, restSeconds + 15))} style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 15, fontWeight: 700 }}>+</button>
            </div>
          </div>
          <div style={{ color: T.dim, fontSize: 11, marginTop: 6, lineHeight: 1.4 }}>
            Applies to any exercise using the default. Exercises with their own custom rest time keep it.
          </div>
        </div>

        {warmupRestEnabled && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: T.text, fontSize: 14 }}>Default warmup rest timer</div>
              <div style={{ color: T.dim, fontSize: 11 }}>Used after a set marked as warmup</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => update("warmupRestSeconds", Math.max(15, warmupRestSeconds - 15))} style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 15, fontWeight: 700 }}>−</button>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, color: T.text, minWidth: 44, textAlign: "center" }}>
                {Math.floor(warmupRestSeconds / 60)}:{String(warmupRestSeconds % 60).padStart(2, "0")}
              </div>
              <button onClick={() => update("warmupRestSeconds", Math.min(600, warmupRestSeconds + 15))} style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 15, fontWeight: 700 }}>+</button>
            </div>
          </div>
          <div style={{ color: T.dim, fontSize: 11, marginTop: 6, lineHeight: 1.4 }}>
            Only shown for exercises with planned warmup sets. Exercises with their own custom warmup rest time keep it.
          </div>
        </div>
        )}
        </>
        )}

        {(matches("restTimerSoundEnabled") || matches("restTimerVibrationEnabled") || matches("restTimerNotificationEnabled")) && (
        <>
        <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>When a rest timer ends</div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: restTimerSoundEnabled ? 10 : 14 }}>
          <div>
            <div style={{ color: T.text, fontSize: 14 }}>Sound</div>
            <div style={{ color: T.dim, fontSize: 11 }}>Plays once the countdown reaches zero</div>
          </div>
          <ToggleSwitch checked={restTimerSoundEnabled} onChange={(v) => update("restTimerSoundEnabled", v)} ariaLabel="Rest timer sound" />
        </div>
        {restTimerSoundEnabled && (
        <div style={{ display: "flex", background: T.surface2, borderRadius: 10, padding: 3, gap: 3, marginBottom: 14 }}>
          {REST_TIMER_SOUNDS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => { update("restTimerSound", opt.key); playRestTimerSound(opt.key); }}
              aria-pressed={restTimerSound === opt.key}
              style={{ flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, border: "none", background: restTimerSound === opt.key ? T.accent : "transparent", color: restTimerSound === opt.key ? "#fff" : T.dim }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: restTimerVibrationEnabled ? 10 : 20 }}>
          <div>
            <div style={{ color: T.text, fontSize: 14 }}>Vibration</div>
            <div style={{ color: T.dim, fontSize: 11 }}>Not available on every device/browser</div>
          </div>
          <ToggleSwitch checked={restTimerVibrationEnabled} onChange={(v) => update("restTimerVibrationEnabled", v)} ariaLabel="Rest timer vibration" />
        </div>
        {restTimerVibrationEnabled && (
        <div style={{ display: "flex", background: T.surface2, borderRadius: 10, padding: 3, gap: 3, marginBottom: 20 }}>
          {REST_TIMER_VIBRATIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => { update("restTimerVibration", opt.key); triggerRestTimerVibration(opt.key); }}
              aria-pressed={restTimerVibration === opt.key}
              style={{ flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 11, fontWeight: 600, border: "none", background: restTimerVibration === opt.key ? T.accent : "transparent", color: restTimerVibration === opt.key ? "#fff" : T.dim }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        )}

        {notificationsSupported() && (
        <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ paddingRight: 12 }}>
            <div style={{ color: T.text, fontSize: 14 }}>Notification</div>
            <div style={{ color: T.dim, fontSize: 11 }}>
              {notifPermission === "denied"
                ? "Blocked in your browser's site settings — re-enable there to use this"
                : "\"Rest Timer Complete\" while the app's in the background"}
            </div>
          </div>
          <ToggleSwitch
            checked={restTimerNotificationEnabled && notifPermission === "granted"}
            onChange={handleToggleRestTimerNotification}
            ariaLabel="Rest timer notification"
          />
        </div>
        {restTimerNotificationEnabled && notifPermission === "granted" && (
          <button
            onClick={() => showRestTimerNotification()}
            style={{ marginTop: 10, padding: "8px 0", width: "100%", borderRadius: 8, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 12, fontWeight: 600 }}
          >
            Send a test notification
          </button>
        )}
        </>
        )}
        </>
        )}
      </>
    );
  }

  // Warmup set weight percentages -- what % of the upcoming top set
  // each warmup set loads, scaled to however many warmup sets are
  // planned for that exercise (see lib/warmup.js for the recommended
  // ramps and the science note behind them). Only one count's row of
  // percentages is shown/edited at a time via the stepper below; every
  // count keeps its own saved scheme independently.
  function renderWarmupWeightFields() {
    if (!matches("warmupPercentSchemes")) return null;
    const percents = getWarmupPercents(warmupSchemeCount, warmupPercentSchemes);
    const isCustomized = Array.isArray(warmupPercentSchemes && warmupPercentSchemes[warmupSchemeCount]);

    function updatePercent(idx, val) {
      const clamped = Math.max(10, Math.min(100, val));
      const current = getWarmupPercents(warmupSchemeCount, warmupPercentSchemes);
      const next = current.map((p, i) => (i === idx ? clamped : p));
      update("warmupPercentSchemes", { ...(warmupPercentSchemes || {}), [warmupSchemeCount]: next });
    }
    function resetToRecommended() {
      const next = { ...(warmupPercentSchemes || {}) };
      delete next[warmupSchemeCount];
      update("warmupPercentSchemes", next);
    }

    return (
      <>
        <div style={{ color: T.dim, fontSize: 11, lineHeight: 1.4, marginBottom: 14 }}>
          Each warmup set is loaded as a percentage of the upcoming top set, ramping up so the last warmup lands close to working weight. The recommended percentages follow standard progressive-warmup ramps used in strength coaching -- adjust any of them to fit how you like to warm up.
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ color: T.text, fontSize: 14 }}>Number of warmup sets</div>
            <div style={{ color: T.dim, fontSize: 11 }}>Edit percentages for this count</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setWarmupSchemeCount((c) => Math.max(1, c - 1))} style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 15, fontWeight: 700 }}>−</button>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, color: T.text, minWidth: 20, textAlign: "center" }}>{warmupSchemeCount}</div>
            <button onClick={() => setWarmupSchemeCount((c) => Math.min(6, c + 1))} style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 15, fontWeight: 700 }}>+</button>
          </div>
        </div>

        {percents.map((p, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ color: T.text, fontSize: 14 }}>Warmup {i + 1}{i === percents.length - 1 ? " (last before top set)" : ""}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => updatePercent(i, p - 5)} style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 15, fontWeight: 700 }}>−</button>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, color: T.text, minWidth: 44, textAlign: "center" }}>{p}%</div>
              <button onClick={() => updatePercent(i, p + 5)} style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 15, fontWeight: 700 }}>+</button>
            </div>
          </div>
        ))}

        {isCustomized && (
          <button
            onClick={resetToRecommended}
            style={{ marginTop: 8, padding: "8px 0", width: "100%", borderRadius: 8, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 12, fontWeight: 600 }}
          >
            Reset to recommended ({defaultWarmupPercents(warmupSchemeCount).join("/")}%)
          </button>
        )}
      </>
    );
  }

  // ---- Ungrouped (in-workout quick menu): unchanged flat layout, gated
  // only by which `fields` were requested — no sub-screen navigation. ----
  if (!grouped) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14 }}>
        {show("units") && matches("units") && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ color: T.text, fontSize: 14 }}>Units</div>
            <div style={{ color: T.dim, fontSize: 11 }}>Weight display and input across the app</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {["lb", "kg"].map((u) => (
              <button key={u} onClick={() => update("units", u)} style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: `1px solid ${units === u ? T.accent : T.line}`,
                background: units === u ? "rgba(232,68,46,0.12)" : T.surface2,
                color: units === u ? T.text : T.dim,
              }}>{u}</button>
            ))}
          </div>
        </div>
        )}

        {show("timeFormat") && matches("timeFormat") && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ color: T.text, fontSize: 14 }}>Time format</div>
            <div style={{ color: T.dim, fontSize: 11 }}>How clock times are shown, e.g. workout start time in History</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[{ key: "12h", label: "12h" }, { key: "24h", label: "24h" }].map((opt) => (
              <button key={opt.key} onClick={() => update("timeFormat", opt.key)} style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: `1px solid ${state.timeFormat === opt.key ? T.accent : T.line}`,
                background: state.timeFormat === opt.key ? "rgba(232,68,46,0.12)" : T.surface2,
                color: state.timeFormat === opt.key ? T.text : T.dim,
              }}>{opt.label}</button>
            ))}
          </div>
        </div>
        )}

        {show("scientificNames") && matches("scientificNames") && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ color: T.text, fontSize: 14 }}>Muscle names</div>
              <div style={{ color: T.dim, fontSize: 11 }}>e.g. Chest (Category) vs Upper Chest (Region) vs Pectoralis Major, Clavicular Head (Anatomy)</div>
            </div>
          </div>
          <div style={{ display: "flex", background: T.surface2, borderRadius: 10, padding: 3, gap: 3 }}>
            {[{ key: "generic", label: "Category" }, { key: "detailed", label: "Region" }, { key: "scientific", label: "Anatomy" }].map((opt) => (
              <button
                key={opt.key}
                onClick={() => update("muscleNameMode", opt.key)}
                aria-pressed={muscleNameMode === opt.key}
                style={{ flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, border: "none", background: muscleNameMode === opt.key ? T.accent : "transparent", color: muscleNameMode === opt.key ? "#fff" : T.dim }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        )}

        {show("scoreDisplay") && matches("scoreDisplay") && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ color: T.text, fontSize: 14 }}>Strength score</div>
              <button onClick={() => setShowScoreInfo(!showScoreInfo)} aria-label="What's the difference?" style={{ width: 16, height: 16, borderRadius: 999, border: `1px solid ${T.dim}`, background: "none", color: T.dim, fontSize: 10, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }}>i</button>
            </div>
          </div>
          {showScoreInfo && (
            <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: 10, marginBottom: 8, fontSize: 12, color: T.dim, lineHeight: 1.5 }}>
              <b style={{ color: T.text }}>DeltaLog Percentile</b> ranks your all-time best lift against other real DeltaLog users — it reflects how you actually compare to people using this app.
              <br /><br />
              <b style={{ color: T.text }}>DOTS</b> is a formula built around elite/competitive powerlifting standards. If you're not training at that level, it will score you low — that's a limitation of the formula, not a reflection of your training. It's here for advanced lifters who specifically want a bodyweight-normalized competition-style score, not as the default measuring stick.
            </div>
          )}
          <div style={{ color: T.dim, fontSize: 11, marginBottom: 8 }}>Shown on your workout summary</div>
          <div style={{ display: "flex", background: T.surface2, borderRadius: 10, padding: 3, gap: 3 }}>
            {[{ key: "percentile", label: "DeltaLog Percentile" }, { key: "dots", label: "DOTS (Advanced)" }, { key: "none", label: "None" }].map((opt) => (
              <button
                key={opt.key}
                onClick={() => update("scoreDisplay", opt.key)}
                aria-pressed={scoreDisplay === opt.key}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, border: "none",
                  background: scoreDisplay === opt.key ? T.accent : "transparent",
                  color: scoreDisplay === opt.key ? "#fff" : T.dim,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {scoreDisplay === "none" && (
            <div style={{ color: T.dim, fontSize: 11, marginTop: 6, lineHeight: 1.4 }}>
              No strength score shown. Nothing is compared against other users.
            </div>
          )}
        </div>
        )}

        {show("trainingIdeology") && matches("trainingIdeology") && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ color: T.text, fontSize: 14 }}>Training focus</div>
              <button onClick={() => setShowIdeologyInfo(!showIdeologyInfo)} aria-label="What's the difference?" style={{ width: 16, height: 16, borderRadius: 999, border: `1px solid ${T.dim}`, background: "none", color: T.dim, fontSize: 10, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }}>i</button>
            </div>
          </div>
          {showIdeologyInfo && (
            <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: 10, marginBottom: 8, fontSize: 12, color: T.dim, lineHeight: 1.5 }}>
              {Object.entries(IDEOLOGIES).map(([name, v]) => (
                <div key={name} style={{ marginBottom: name === "Endurance" ? 0 : 8 }}>
                  <b style={{ color: T.text }}>{name}</b> ({v.low}-{v.high} reps) — {v.desc}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", background: T.surface2, borderRadius: 10, padding: 3, gap: 3 }}>
            {Object.keys(IDEOLOGIES).map((name) => (
              <button
                key={name}
                onClick={() => update("trainingIdeology", name)}
                aria-pressed={trainingIdeology === name}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, border: "none",
                  background: trainingIdeology === name ? T.accent : "transparent",
                  color: trainingIdeology === name ? "#fff" : T.dim,
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
        )}

        {show("weightEntryMode") && matches("weightEntryMode") && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div>
              <div style={{ color: T.text, fontSize: 14 }}>Default set entry</div>
              <div style={{ color: T.dim, fontSize: 11 }}>How weight opens when logging a set. RIR stays at the bottom either way.</div>
            </div>
          </div>
          <div style={{ display: "flex", background: T.surface2, borderRadius: 10, padding: 3, gap: 3 }}>
            {[{ key: "manual", label: "Manual entry" }, { key: "plate", label: "Plate calculator" }].map((opt) => (
              <button
                key={opt.key}
                onClick={() => update("weightEntryMode", opt.key)}
                aria-pressed={weightEntryMode === opt.key}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, border: "none",
                  background: weightEntryMode === opt.key ? T.accent : "transparent",
                  color: weightEntryMode === opt.key ? "#fff" : T.dim,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        )}

        {show("plateSizes") && matches("plateSizes") && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ color: T.text, fontSize: 14 }}>Big plates ({units === "kg" ? "25 kg" : "55 lb"})</div>
            <div style={{ color: T.dim, fontSize: 11 }}>Some gyms only stock these as bumpers for squats and deadlifts, not bench</div>
          </div>
          <div style={{ display: "flex", background: T.surface2, borderRadius: 10, padding: 3, gap: 3 }}>
            {[{ key: "off", label: "Off" }, { key: "lower", label: "Squats & deadlifts" }, { key: "all", label: "All lifts" }].map((opt) => (
              <button
                key={opt.key}
                onClick={() => update("plate55Scope", opt.key)}
                aria-pressed={state.plate55Scope === opt.key}
                style={{
                  flex: 1, padding: "8px 4px", borderRadius: 7, fontSize: 11.5, fontWeight: 600, border: "none",
                  background: state.plate55Scope === opt.key ? T.accent : "transparent",
                  color: state.plate55Scope === opt.key ? "#fff" : T.dim,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        )}

        {(show("restSeconds") && matches("restSeconds") || show("warmupRestSeconds") && matches("warmupRestSeconds") || show("warmupRestEnabled") && matches("warmupRestEnabled")) && (
        <div>
          <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Rest Timers</div>

          {show("warmupRestEnabled") && matches("warmupRestEnabled") && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ paddingRight: 12 }}>
              <div style={{ color: T.text, fontSize: 14 }}>Separate warmup rest timer</div>
              <div style={{ color: T.dim, fontSize: 11 }}>Use a shorter rest after warmup sets than working sets</div>
            </div>
            <ToggleSwitch checked={warmupRestEnabled} onChange={(v) => update("warmupRestEnabled", v)} ariaLabel="Separate warmup rest timer" />
          </div>
          )}

          {show("restSeconds") && matches("restSeconds") && (
          <div style={{ marginBottom: warmupRestEnabled ? 14 : 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: T.text, fontSize: 14 }}>{warmupRestEnabled ? "Default working set rest timer" : "Default rest timer"}</div>
                <div style={{ color: T.dim, fontSize: 11 }}>{warmupRestEnabled ? "Starts a new workout's rest countdown for working sets" : "Starts a new workout's rest countdown"}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => update("restSeconds", Math.max(15, restSeconds - 15))} style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 15, fontWeight: 700 }}>−</button>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, color: T.text, minWidth: 44, textAlign: "center" }}>
                  {Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, "0")}
                </div>
                <button onClick={() => update("restSeconds", Math.min(600, restSeconds + 15))} style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 15, fontWeight: 700 }}>+</button>
              </div>
            </div>
            {!controlled && (
              <div style={{ color: T.dim, fontSize: 11, marginTop: 6, lineHeight: 1.4 }}>
                Applies to any exercise using the default. Exercises with their own custom rest time keep it.
              </div>
            )}
            {onApplyRestToAll && !confirmApplyAll && (
              <button onClick={() => setConfirmApplyAll(true)} style={{ marginTop: 8, background: "none", border: "none", color: T.accent, fontSize: 12, fontWeight: 600, padding: 0 }}>
                Apply to all exercises →
              </button>
            )}
            {onApplyRestToAll && confirmApplyAll && (
              <div style={{ marginTop: 10, background: T.surface2, border: `1px solid ${T.accent}`, borderRadius: 10, padding: 10 }}>
                <div style={{ color: T.text, fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Apply {Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, "0")} to every exercise?</div>
                <div style={{ color: T.dim, fontSize: 11.5, marginBottom: 10, lineHeight: 1.4 }}>This overwrites any exercise-specific rest times you've set in this workout, including warmup rest. Can't be undone.</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setConfirmApplyAll(false)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 12.5 }}>Cancel</button>
                  <button
                    onClick={async () => { setApplyingAll(true); await onApplyRestToAll(restSeconds); setApplyingAll(false); setConfirmApplyAll(false); }}
                    disabled={applyingAll}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: T.accent, color: "#fff", fontSize: 12.5, fontWeight: 700 }}
                  >
                    {applyingAll ? "Applying…" : "Apply to all"}
                  </button>
                </div>
              </div>
            )}
          </div>
          )}

          {warmupRestEnabled && show("warmupRestSeconds") && matches("warmupRestSeconds") && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: T.text, fontSize: 14 }}>Default warmup rest timer</div>
                <div style={{ color: T.dim, fontSize: 11 }}>Used after a set marked as warmup</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => update("warmupRestSeconds", Math.max(15, warmupRestSeconds - 15))} style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 15, fontWeight: 700 }}>−</button>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, color: T.text, minWidth: 44, textAlign: "center" }}>
                  {Math.floor(warmupRestSeconds / 60)}:{String(warmupRestSeconds % 60).padStart(2, "0")}
                </div>
                <button onClick={() => update("warmupRestSeconds", Math.min(600, warmupRestSeconds + 15))} style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 15, fontWeight: 700 }}>+</button>
              </div>
            </div>
            {!controlled && (
              <div style={{ color: T.dim, fontSize: 11, marginTop: 6, lineHeight: 1.4 }}>
                Only shown for exercises with planned warmup sets. Exercises with their own custom warmup rest time keep it.
              </div>
            )}
          </div>
          )}
        </div>
        )}
      </div>
    );
  }

  // ---- Grouped (Settings screen): "Units" and "Training Preferences"
  // are real navigable destinations, matching every other settings row
  // (tap in, back chevron out) instead of an inline accordion. While a
  // search is active, matching fields render inline instead, so search
  // results stay visible in the normal scrollable settings list without
  // requiring a tap into the sub-screen. ----
  return (
    <>
      {screen === null && (
        <>
          {!searchActive && (
            <button onClick={() => setScreen("units")} style={navRowBtn}>
              <div>
                <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>Units</div>
                <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>Weight units and clock format</div>
              </div>
              <div style={{ color: T.dim, fontSize: 16 }}>›</div>
            </button>
          )}
          {searchActive && unitsSearchMatch && (
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              {renderUnitsFields()}
            </div>
          )}

          {!searchActive && (
            <button onClick={() => setScreen("training")} style={navRowBtn}>
              <div>
                <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>Training Preferences</div>
                <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>Training focus, strength score, set entry, big plates, muscle names, rest timer</div>
              </div>
              <div style={{ color: T.dim, fontSize: 16 }}>›</div>
            </button>
          )}
          {searchActive && trainingSearchMatch && (
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              {renderTrainingFields()}
              {(matches("restSeconds") || matches("warmupRestSeconds") || matches("warmupRestEnabled") || matches("restTimerSoundEnabled") || matches("restTimerVibrationEnabled") || matches("restTimerNotificationEnabled")) && (
                <>
                  <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, margin: "4px 0 10px" }}>Rest Timer</div>
                  {renderRestTimerFields()}
                </>
              )}
            </div>
          )}
        </>
      )}

      {screen === "units" && (
        <SubScreen title="Units" onBack={() => setScreen(null)}>
          {renderUnitsFields()}
        </SubScreen>
      )}

      {screen === "training" && (
        <SubScreen title="Training Preferences" onBack={() => setScreen(null)}>
          <Section
            title="Training Focus & Logging"
            subtitle="Rep range, strength score, set entry, big plates, muscle names"
            open={openTrainingSection === "focus"}
            onToggle={() => setOpenTrainingSection((s) => (s === "focus" ? null : "focus"))}
          >
            {renderTrainingFields()}
          </Section>
          <Section
            title="Rest Timer"
            subtitle="Default durations, warmup rest, and end-of-timer alerts"
            open={openTrainingSection === "restTimer"}
            onToggle={() => setOpenTrainingSection((s) => (s === "restTimer" ? null : "restTimer"))}
          >
            {renderRestTimerFields()}
          </Section>
        </SubScreen>
      )}
    </>
  );
}
