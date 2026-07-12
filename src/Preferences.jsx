import { useState } from "react";
import { getPrefs, setPref } from "./lib/prefs";
import { IDEOLOGIES } from "./lib/ideologies";

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

// Full-screen sub-page shell, matching the same pattern used by
// ProfileEditor/ExerciseLibraryView (fixed inset, back chevron, centered
// title) — used so "Units" and "Training Preferences" behave as real
// navigable screens like every other settings destination, instead of an
// inline accordion that expanded in place.
function SubScreen({ title, onBack, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 40, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 420, minHeight: "100vh", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}>
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
    scoreDisplay: getPrefs().scoreDisplay,
    weightEntryMode: getPrefs().weightEntryMode,
    restSeconds: getPrefs().restSeconds,
    warmupRestSeconds: getPrefs().warmupRestSeconds,
    plate55Scope: getPrefs().plate55Scope,
    trainingIdeology: getPrefs().trainingIdeology,
    timeFormat: getPrefs().timeFormat,
  }));
  const [showScoreInfo, setShowScoreInfo] = useState(false);
  const [showIdeologyInfo, setShowIdeologyInfo] = useState(false);
  // Which grouped sub-screen (if any) is open. Replaces the old
  // showTrainingPrefs/showUnitsGroup accordion-toggle booleans now that
  // "Units" and "Training Preferences" are real full-screen destinations
  // (SubScreen) rather than inline-expanding sections.
  const [screen, setScreen] = useState(null); // null | "units" | "training"
  const state = controlled ? value : local;

  // Search keywords per row, used only when `filterQuery` is passed in
  // (currently just the Settings screen search box). A row with no match
  // gets hidden rather than the component rendering "no results" chrome —
  // Settings stays a normal scrollable page, just a shorter one.
  const KEYWORDS = {
    units: "units weight display lb kg pounds kilograms",
    timeFormat: "time format 12h 24h clock hour am pm",
    scientificNames: "muscle names generic detailed scientific anatomy nomenclature",
    trainingIdeology: "training focus rep range hypertrophy strength endurance ideology methodology default",
    scoreDisplay: "strength score dots percentile deltalog",
    weightEntryMode: "default set entry manual plate calculator logging type",
    plateSizes: "big plates 55 lb 25 kg bumpers squats deadlifts",
    restSeconds: "rest timer default seconds",
    warmupRestSeconds: "warmup rest timer default seconds",
  };
  const matches = (key) => !filterQuery || KEYWORDS[key].includes(filterQuery.trim().toLowerCase());
  const searchActive = !!filterQuery;
  // A row inside "Units" or "Training Preferences" should still be
  // findable by search without requiring a tap into that sub-screen —
  // shown inline, right in the settings list, while a search is active.
  const unitsSearchMatch = searchActive && ["units", "timeFormat"].some(matches);
  const trainingSearchMatch = searchActive && ["trainingIdeology", "scoreDisplay", "weightEntryMode", "plateSizes", "scientificNames", "restSeconds", "warmupRestSeconds"].some(matches);

  function update(key, val) {
    if (controlled) {
      onChange(key, val);
    } else {
      setPref(key, val);
      setLocal((prev) => ({ ...prev, [key]: val }));
    }
  }

  const { units, muscleNameMode, scoreDisplay, weightEntryMode, restSeconds, warmupRestSeconds, trainingIdeology } = state;
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

        {matches("restSeconds") && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: T.text, fontSize: 14 }}>Default rest timer</div>
              <div style={{ color: T.dim, fontSize: 11 }}>Starts a new workout's rest countdown</div>
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
        )}

        {matches("warmupRestSeconds") && (
        <div style={{ marginTop: 14 }}>
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

        {show("restSeconds") && matches("restSeconds") && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: T.text, fontSize: 14 }}>Default rest timer</div>
              <div style={{ color: T.dim, fontSize: 11 }}>Starts a new workout's rest countdown</div>
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

        {show("warmupRestSeconds") && matches("warmupRestSeconds") && (
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
          {renderTrainingFields()}
        </SubScreen>
      )}
    </>
  );
}
