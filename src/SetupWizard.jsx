import { useState } from "react";
import { getPrefs, setPref } from "./lib/prefs";
import { IDEOLOGIES } from "./lib/ideologies";
import Logo from "./Logo";
import MuscleNameSlider from "./MuscleNameSlider";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

function PillRow({ options, value, onChange, columns }) {
  return (
    <div style={{ display: "flex", flexWrap: columns ? "wrap" : "nowrap", background: T.surface2, borderRadius: 12, padding: 4, gap: 4 }}>
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          style={{
            flex: columns ? `1 1 calc(${100 / columns}% - 4px)` : 1,
            padding: "14px 6px", borderRadius: 9, fontSize: 14, fontWeight: 700, border: "none",
            background: value === opt.key ? T.accent : "transparent",
            color: value === opt.key ? "#fff" : T.dim,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function InfoBox({ children }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginTop: 18, fontSize: 13, color: T.dim, lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

// Same looping plate-slide animation used in the tutorial's plate
// calculator step — repeated here so the "Default set entry" step in the
// wizard actually shows what each option looks like, not just names them.
function PlateCalcVisual() {
  return (
    <div style={{ width: "100%", height: 46, marginTop: 14, marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @keyframes dl-slide-left { 0% { transform: translateX(-14px); opacity: 0; } 30%, 70% { transform: translateX(0); opacity: 1; } 100% { transform: translateX(-14px); opacity: 0; } }
        @keyframes dl-slide-right { 0% { transform: translateX(14px); opacity: 0; } 30%, 70% { transform: translateX(0); opacity: 1; } 100% { transform: translateX(14px); opacity: 0; } }
      `}</style>
      <svg width="140" height="40" viewBox="0 0 140 40">
        <line x1="10" y1="20" x2="130" y2="20" stroke={T.dim} strokeWidth="3" />
        <rect x="30" y="10" width="6" height="20" rx="1" fill={T.dim} opacity="0.5" />
        <rect x="104" y="10" width="6" height="20" rx="1" fill={T.dim} opacity="0.5" />
        <g style={{ animation: "dl-slide-left 2.2s ease-in-out infinite" }}>
          <rect x="12" y="4" width="10" height="32" rx="2" fill={T.accent} />
        </g>
        <g style={{ animation: "dl-slide-left 2.2s ease-in-out infinite 0.15s" }}>
          <rect x="24" y="7" width="7" height="26" rx="2" fill={T.accent} opacity="0.75" />
        </g>
        <g style={{ animation: "dl-slide-right 2.2s ease-in-out infinite" }}>
          <rect x="118" y="4" width="10" height="32" rx="2" fill={T.accent} />
        </g>
        <g style={{ animation: "dl-slide-right 2.2s ease-in-out infinite 0.15s" }}>
          <rect x="109" y="7" width="7" height="26" rx="2" fill={T.accent} opacity="0.75" />
        </g>
      </svg>
    </div>
  );
}

export default function SetupWizard({ onComplete }) {
  const prefs = getPrefs();
  const [step, setStep] = useState(0);
  const [units, setUnits] = useState(prefs.units);
  const [trainingIdeology, setTrainingIdeology] = useState(prefs.trainingIdeology);
  const [scoreDisplay, setScoreDisplay] = useState(prefs.scoreDisplay);
  const [weightEntryMode, setWeightEntryMode] = useState(prefs.weightEntryMode);
  const [plate55Scope, setPlate55Scope] = useState(prefs.plate55Scope);
  const [muscleNameMode, setMuscleNameMode] = useState(prefs.muscleNameMode);
  const [restSeconds, setRestSeconds] = useState(prefs.restSeconds);

  const steps = [
    {
      title: "Weight units",
      subtitle: "Used everywhere you enter or see a weight.",
      body: <PillRow options={[{ key: "lb", label: "Pounds (lb)" }, { key: "kg", label: "Kilograms (kg)" }]} value={units} onChange={setUnits} />,
    },
    {
      title: "Training focus",
      subtitle: "Sets your default rep range target — change it for any exercise on the fly, anytime.",
      body: (
        <>
          <PillRow options={Object.keys(IDEOLOGIES).map((k) => ({ key: k, label: k }))} value={trainingIdeology} onChange={setTrainingIdeology} />
          <InfoBox>
            {Object.entries(IDEOLOGIES).map(([name, v]) => (
              <div key={name} style={{ marginBottom: name === "Endurance" ? 0 : 8 }}>
                <b style={{ color: T.text }}>{name}</b> ({v.low}-{v.high} reps) — {v.desc}
              </div>
            ))}
          </InfoBox>
        </>
      ),
    },
    {
      title: "Strength score",
      subtitle: "Shown on your workout summary after every session.",
      body: (
        <>
          <PillRow options={[{ key: "percentile", label: "DeltaLog Percentile" }, { key: "dots", label: "DOTS (Advanced)" }, { key: "none", label: "None" }]} value={scoreDisplay} onChange={setScoreDisplay} />
          <InfoBox>
            <b style={{ color: T.text }}>DeltaLog Percentile</b> ranks your all-time best lift against other real DeltaLog users — how you actually compare to people using this app.
            <br /><br />
            <b style={{ color: T.text }}>DOTS</b> is a competitive-powerlifting formula. Great for advanced lifters who want a bodyweight-normalized score; it'll read low if you're not training at that level, which reflects the formula, not you.
            <br /><br />
            <b style={{ color: T.text }}>None</b> turns the score off entirely — nothing is compared against other users.
          </InfoBox>
        </>
      ),
    },
    {
      title: "Default set entry",
      subtitle: "How weight opens when you log a set. Switch anytime, per set.",
      body: (
        <>
          <PillRow options={[{ key: "manual", label: "Manual entry" }, { key: "plate", label: "Plate calculator" }]} value={weightEntryMode} onChange={setWeightEntryMode} />
          <InfoBox>
            <b style={{ color: T.text }}>Manual entry</b> is a plain weight field — fastest if you already know the number, like on a machine with a weight stack.
            <br /><br />
            <b style={{ color: T.text }}>Plate calculator</b> tracks what's actually loaded on the bar. Tap plates to load it — the total updates live and mirrors both sides — or type a target weight and tap Optimize loading to fill the bar with the fewest plates in one move. No more mental math at the rack.
          </InfoBox>
          <PlateCalcVisual />
        </>
      ),
    },
    {
      title: `Big plates (${units === "kg" ? "25 kg" : "55 lb"})`,
      subtitle: "Some gyms only stock these as bumpers for squats and deadlifts, not bench.",
      body: <PillRow options={[{ key: "off", label: "Off" }, { key: "lower", label: "Squats & deadlifts" }, { key: "all", label: "All lifts" }]} value={plate55Scope} onChange={setPlate55Scope} columns={1} />,
    },
    {
      title: "Muscle names",
      subtitle: "How muscle groups are labeled throughout the app.",
      body: (
        <>
          <MuscleNameSlider value={muscleNameMode} onChange={setMuscleNameMode} />
          <InfoBox>e.g. Chest vs Upper Chest vs Clavicular Head vs Pectoralis Major (Clavicular Head)</InfoBox>
        </>
      ),
    },
    {
      title: "Default rest timer",
      subtitle: "Starts counting down after you log a set. Exercises with their own custom time keep it.",
      body: (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginTop: 8 }}>
          <button onClick={() => setRestSeconds(Math.max(15, restSeconds - 15))} style={{ width: 48, height: 48, borderRadius: 12, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 22, fontWeight: 700 }}>−</button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 40, fontWeight: 700, color: T.text, minWidth: 100, textAlign: "center" }}>
            {Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, "0")}
          </div>
          <button onClick={() => setRestSeconds(Math.min(600, restSeconds + 15))} style={{ width: 48, height: 48, borderRadius: 12, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 22, fontWeight: 700 }}>+</button>
        </div>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  function commitStepAndFinish() {
    setPref("units", units);
    setPref("trainingIdeology", trainingIdeology);
    setPref("scoreDisplay", scoreDisplay);
    setPref("weightEntryMode", weightEntryMode);
    setPref("plate55Scope", plate55Scope);
    setPref("muscleNameMode", muscleNameMode);
    setPref("restSeconds", restSeconds);
    setPref("setupWizardSeen", true);
    onComplete();
  }

  function handleNext() {
    if (isLast) commitStepAndFinish();
    else setStep(step + 1);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 45, overflowY: "auto", background: T.bg, display: "flex", flexDirection: "column", padding: 24, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <button
          onClick={() => (step === 0 ? null : setStep(step - 1))}
          style={{ width: 32, height: 32, borderRadius: 999, border: `1px solid ${T.line}`, background: T.surface, color: step === 0 ? "transparent" : T.dim, fontSize: 14 }}
          disabled={step === 0}
        >
          ‹
        </button>
        <Logo size={36} />
        <button onClick={commitStepAndFinish} style={{ background: "none", border: "none", color: T.dim, fontSize: 13, textDecoration: "underline" }}>
          Skip
        </button>
      </div>

      <div style={{ display: "flex", gap: 5, marginBottom: 28 }}>
        {steps.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? T.accent : T.line }} />
        ))}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 380, width: "100%", margin: "0 auto" }}>
        <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, textAlign: "center" }}>
          Step {step + 1} of {steps.length}
        </div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: T.text, textAlign: "center", marginBottom: 6 }}>
          {current.title}
        </div>
        <div style={{ color: T.dim, fontSize: 13, textAlign: "center", marginBottom: 24, lineHeight: 1.5 }}>
          {current.subtitle}
        </div>
        {current.body}
      </div>

      <div style={{ width: "100%", maxWidth: 380, margin: "0 auto", paddingTop: 16 }}>
        <button
          onClick={handleNext}
          style={{ width: "100%", padding: "16px 0", borderRadius: 14, border: "none", background: T.accent, color: "#fff", fontSize: 16, fontWeight: 700 }}
        >
          {isLast ? "Finish setup" : "Continue"}
        </button>
      </div>
    </div>
  );
}
