import { useState } from "react";
import { getPrefs, setPref } from "./lib/prefs";
import { IDEOLOGIES } from "./lib/ideologies";
import { PROGRESSION_MODELS, PROGRESSION_MODEL_DESCRIPTIONS } from "./lib/programEngine";
import Logo from "./Logo";

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

export default function SetupWizard({ onComplete, onClose }) {
  const prefs = getPrefs();
  const [step, setStep] = useState(0);
  const [units, setUnits] = useState(prefs.units);
  const [trainingIdeology, setTrainingIdeology] = useState(prefs.trainingIdeology);
  const [scoreDisplay, setScoreDisplay] = useState(prefs.scoreDisplay);
  const [muscleNameMode, setMuscleNameMode] = useState(prefs.muscleNameMode);
  const [targetCalcMethod, setTargetCalcMethod] = useState(prefs.targetCalcMethod);
  const [bodyModelSex, setBodyModelSex] = useState(prefs.bodyModelSex);

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
      title: "Target calculation method",
      subtitle: "How the weight/reps suggested for your next set is worked out. Switch anytime in Preferences.",
      body: (
        <>
          <PillRow
            options={Object.entries(PROGRESSION_MODELS).map(([key, label]) => ({ key, label }))}
            value={targetCalcMethod}
            onChange={setTargetCalcMethod}
            columns={1}
          />
          <InfoBox>{PROGRESSION_MODEL_DESCRIPTIONS[targetCalcMethod]}</InfoBox>
        </>
      ),
    },
    {
      title: "Body map model",
      subtitle: "Which body you'll see on your muscle heatmap. Change anytime in Preferences.",
      body: (
        <PillRow
          options={[{ key: "male", label: "Male" }, { key: "female", label: "Female" }]}
          value={bodyModelSex}
          onChange={setBodyModelSex}
        />
      ),
    },
    {
      title: "Muscle names",
      subtitle: "How muscle groups are labeled throughout the app.",
      body: (
        <>
          <PillRow options={[{ key: "generic", label: "Category" }, { key: "detailed", label: "Region" }, { key: "scientific", label: "Anatomy" }]} value={muscleNameMode} onChange={setMuscleNameMode} columns={3} />
          <InfoBox>e.g. Chest (Category) vs Upper Chest (Region) vs Pectoralis Major, Clavicular Head (Anatomy)</InfoBox>
        </>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  function commitStepAndFinish() {
    setPref("units", units);
    setPref("trainingIdeology", trainingIdeology);
    setPref("scoreDisplay", scoreDisplay);
    setPref("targetCalcMethod", targetCalcMethod);
    setPref("muscleNameMode", muscleNameMode);
    setPref("bodyModelSex", bodyModelSex);
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
          onClick={() => (step === 0 ? (onClose ? onClose() : null) : setStep(step - 1))}
          aria-label={step === 0 ? "Close" : "Back"}
          style={{ width: 32, height: 32, borderRadius: 999, border: `1px solid ${T.line}`, background: T.surface, color: step === 0 && !onClose ? "transparent" : T.dim, fontSize: 14 }}
          disabled={step === 0 && !onClose}
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
