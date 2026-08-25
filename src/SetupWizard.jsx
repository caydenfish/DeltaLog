import { useState } from "react";
import { getPrefs, setPref, markInstallPromptShownThisLoad } from "./lib/prefs";
import { IDEOLOGIES } from "./lib/ideologies";
import { PROGRESSION_MODELS, PROGRESSION_MODEL_DESCRIPTIONS } from "./lib/programEngine";
import OnboardingProgress from "./OnboardingProgress";
import InstallGuide from "./InstallGuide";
import Logo from "./Logo";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
  green: "#3BA55D",
};

const GOAL_OPTIONS = [
  { key: "Hypertrophy", label: "Build muscle", desc: `${IDEOLOGIES.Hypertrophy.low}-${IDEOLOGIES.Hypertrophy.high} rep targets` },
  { key: "Strength", label: "Get stronger", desc: `${IDEOLOGIES.Strength.low}-${IDEOLOGIES.Strength.high} rep targets` },
  { key: "Endurance", label: "Build endurance", desc: `${IDEOLOGIES.Endurance.low}-${IDEOLOGIES.Endurance.high} rep targets` },
];

const MUSCLE_NAME_OPTIONS = [
  { key: "generic", label: "Category", desc: "Broad groups, like Chest, Back, Legs. Simplest and most common." },
  { key: "detailed", label: "Region", desc: "More specific areas, like Upper Chest, Lats, Quads." },
  { key: "scientific", label: "Anatomy", desc: "Full anatomical terms, like Pectoralis Major, Latissimus Dorsi." },
];

const SCORE_OPTIONS = [
  { key: "percentile", label: "Percentile", desc: "Ranks your best lift against real DeltaLog users — how you compare to people actually using the app." },
  { key: "dots", label: "DOTS", desc: "A competitive-powerlifting formula, bodyweight-normalized. Reads low if you're not training at that level — that's the formula, not you." },
  { key: "none", label: "None", desc: "Turns the score off. Nothing compared against other users." },
];

const TARGET_CALC_OPTIONS = Object.entries(PROGRESSION_MODELS).map(([key, label]) => ({ key, label, desc: PROGRESSION_MODEL_DESCRIPTIONS[key] }));

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

// A selectable list of cards, each with a title and its own one-line
// explanation -- used everywhere the wizard asks someone to pick between
// options that actually need explaining (goal, muscle names, strength
// score, target calc method), instead of a bare pill row plus one
// combined caption underneath all of them.
function OptionCards({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          style={{
            textAlign: "left", borderRadius: 10, padding: "12px 14px", border: `1px solid ${value === opt.key ? T.accent : T.line}`,
            background: value === opt.key ? "rgba(232,68,46,0.12)" : T.surface,
          }}
        >
          <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>{opt.label}</div>
          <div style={{ color: T.dim, fontSize: 11.5, marginTop: 2, lineHeight: 1.4 }}>{opt.desc}</div>
        </button>
      ))}
    </div>
  );
}

function StepShell({ step, total, title, subtitle, children, onBack, onSkip, onNext, nextLabel, nextDisabled, showProgress = true }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 45, overflowY: "auto", background: T.bg, display: "flex", flexDirection: "column", padding: 24, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <button
          onClick={onBack}
          aria-label={onBack ? "Back" : "Close"}
          style={{ width: 32, height: 32, borderRadius: 999, border: `1px solid ${T.line}`, background: T.surface, color: onBack ? T.dim : "transparent", fontSize: 14 }}
          disabled={!onBack}
        >
          ‹
        </button>
        <Logo size={36} />
        {onSkip ? (
          <button onClick={onSkip} style={{ background: "none", border: "none", color: T.dim, fontSize: 13, textDecoration: "underline" }}>
            Skip
          </button>
        ) : (
          <div style={{ width: 32 }} />
        )}
      </div>

      {showProgress && <OnboardingProgress step={step} total={total} />}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 380, width: "100%", margin: "0 auto" }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, color: T.text, textAlign: "center", marginBottom: 6 }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ color: T.dim, fontSize: 13, textAlign: "center", marginBottom: 22, lineHeight: 1.5 }}>
            {subtitle}
          </div>
        )}
        {children}
      </div>

      <div style={{ width: "100%", maxWidth: 380, margin: "0 auto", paddingTop: 16 }}>
        <button
          onClick={onNext}
          disabled={nextDisabled}
          style={{ width: "100%", padding: "16px 0", borderRadius: 14, border: "none", background: nextDisabled ? T.surface2 : T.accent, color: nextDisabled ? T.dim : "#fff", fontSize: 16, fontWeight: 700 }}
        >
          {nextLabel || "Continue"}
        </button>
      </div>
    </div>
  );
}

const TOTAL_STEPS = 7;
const FINISH_STEP = 4; // internal step index for the Finish screen

export default function SetupWizard({ profile, onComplete, onClose, simulate }) {
  const prefs = getPrefs();
  // Present when Settings > Help > "Rerun setup wizard" reopens this for an
  // already-onboarded person to revisit their preferences -- as opposed to
  // a brand-new signup moving through it as part of account creation.
  // Suppresses the onboarding-only chrome (step-of-7 progress bar, "you're
  // all set" framing, the install-to-home-screen ask) and gives the first
  // screen's back arrow something to actually close.
  const isReplay = !!onClose;
  // Present when Admin Home's "Simulate new-user experience" opens this --
  // renders EXACTLY the real onboarding chrome (full progress bar, real
  // copy, the install-prompt card) so it's a true preview of what a
  // brand-new signup sees, but never persists any preference change or
  // marks setup as seen. Adds one small "Exit simulation" affordance
  // (clearly meta, not part of the flow being demonstrated) since a real
  // new user has no way out of onboarding but an admin previewing it does.
  const [step, setStep] = useState(0); // 0=Goal 1=AboutYou 2=Score 3=TargetCalc 4=Finish
  const [units, setUnits] = useState(prefs.units);
  const [trainingIdeology, setTrainingIdeology] = useState(prefs.trainingIdeology);
  const [muscleNameMode, setMuscleNameMode] = useState(prefs.muscleNameMode);
  const [scoreDisplay, setScoreDisplay] = useState(prefs.scoreDisplay);
  const [targetCalcMethod, setTargetCalcMethod] = useState(prefs.targetCalcMethod);
  const [defaultPlannedSets, setDefaultPlannedSets] = useState(prefs.defaultPlannedSets);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [installHandled, setInstallHandled] = useState(false);

  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  function commitPrefs() {
    setPref("units", units);
    setPref("trainingIdeology", trainingIdeology);
    setPref("muscleNameMode", muscleNameMode);
    setPref("scoreDisplay", scoreDisplay);
    setPref("targetCalcMethod", targetCalcMethod);
    setPref("defaultPlannedSets", defaultPlannedSets);
  }

  function finish() {
    if (simulate) { onComplete(); return; }
    commitPrefs();
    if (!isReplay) {
      setPref("setupWizardSeen", true);
      // The finish step already offered the home-screen install ask (unless
      // running standalone already, where there's nothing to offer) --
      // mark it handled so Home's own auto-popup doesn't repeat the exact
      // same ask again the instant they land there.
      markInstallPromptShownThisLoad();
    }
    onComplete();
  }

  function handleInstallChoice(handled) {
    setInstallHandled(handled);
    if (!simulate) markInstallPromptShownThisLoad();
  }

  const firstName = profile?.first_name ? profile.first_name.split(" ")[0] : null;
  const hideProgress = isReplay; // simulate mode keeps the real progress bar

  if (step === 0) {
    return (
      <StepShell
        step={3} total={TOTAL_STEPS}
        showProgress={!hideProgress}
        title="What's your main goal?"
        subtitle="You can fine-tune this anytime later."
        onBack={isReplay ? onClose : undefined}
        onSkip={() => setStep(FINISH_STEP)}
        onNext={() => setStep(1)}
      >
        <OptionCards options={GOAL_OPTIONS} value={trainingIdeology} onChange={setTrainingIdeology} />
        {simulate && <SimulateExitTag onExit={onComplete} />}
      </StepShell>
    );
  }

  if (step === 1) {
    return (
      <StepShell
        step={4} total={TOTAL_STEPS}
        showProgress={!hideProgress}
        title="About you"
        subtitle="All changeable later in Preferences."
        onBack={() => setStep(0)}
        onSkip={() => setStep(FINISH_STEP)}
        onNext={() => setStep(2)}
      >
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Weight units</div>
          <PillRow options={[{ key: "lb", label: "Pounds" }, { key: "kg", label: "Kilograms" }]} value={units} onChange={setUnits} />
        </div>
        <div>
          <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Muscle names</div>
          <OptionCards options={MUSCLE_NAME_OPTIONS} value={muscleNameMode} onChange={setMuscleNameMode} />
        </div>
        {simulate && <SimulateExitTag onExit={onComplete} />}
      </StepShell>
    );
  }

  if (step === 2) {
    return (
      <StepShell
        step={5} total={TOTAL_STEPS}
        showProgress={!hideProgress}
        title="Strength score"
        subtitle="Shown on your workout summary after every session."
        onBack={() => setStep(1)}
        onSkip={() => setStep(FINISH_STEP)}
        onNext={() => setStep(3)}
      >
        <OptionCards options={SCORE_OPTIONS} value={scoreDisplay} onChange={setScoreDisplay} />
        {simulate && <SimulateExitTag onExit={onComplete} />}
      </StepShell>
    );
  }

  if (step === 3) {
    return (
      <StepShell
        step={6} total={TOTAL_STEPS}
        showProgress={!hideProgress}
        title="Target calculation"
        subtitle="How the weight/reps suggested for your next set gets worked out."
        onBack={() => setStep(2)}
        onSkip={() => setStep(FINISH_STEP)}
        onNext={() => setStep(FINISH_STEP)}
      >
        <div style={{ marginBottom: 20 }}>
          <OptionCards options={TARGET_CALC_OPTIONS} value={targetCalcMethod} onChange={setTargetCalcMethod} />
        </div>
        <div>
          <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, textAlign: "center" }}>Default sets per exercise</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
            <button onClick={() => setDefaultPlannedSets((n) => Math.max(1, n - 1))} style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 20, fontWeight: 700 }}>&minus;</button>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 34, fontWeight: 700, color: T.text, minWidth: 44, textAlign: "center" }}>{defaultPlannedSets}</div>
            <button onClick={() => setDefaultPlannedSets((n) => Math.min(12, n + 1))} style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 20, fontWeight: 700 }}>+</button>
          </div>
        </div>
        {simulate && <SimulateExitTag onExit={onComplete} />}
      </StepShell>
    );
  }

  // step 4: Finish
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 45, overflowY: "auto", background: T.bg, display: "flex", flexDirection: "column", padding: 24, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <button onClick={() => setStep(3)} aria-label="Back" style={{ width: 32, height: 32, borderRadius: 999, border: `1px solid ${T.line}`, background: T.surface, color: T.dim, fontSize: 14 }}>‹</button>
        <Logo size={36} />
        <div style={{ width: 32 }} />
      </div>

      {!hideProgress && <OnboardingProgress step={7} total={TOTAL_STEPS} />}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 380, width: "100%", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 999, background: "rgba(59,165,93,0.15)", border: `1px solid ${T.green}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: T.green, fontSize: 20 }}>✓</div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, color: T.text }}>
            {isReplay ? "Preferences updated" : `You're all set${firstName ? `, ${firstName}` : ""}`}
          </div>
        </div>

        {!isStandalone && !isReplay && (
          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, marginBottom: 8 }}>
            <div style={{ color: T.text, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>One last thing</div>
            <div style={{ color: T.dim, fontSize: 12.5, lineHeight: 1.5, marginBottom: 12 }}>
              Add DeltaLog to your home screen so it opens full-screen, like a real app. Takes 10 seconds.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { setShowInstallGuide(true); handleInstallChoice(true); }}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: T.accent, color: "#fff", fontSize: 13, fontWeight: 700 }}
              >
                Show me how
              </button>
              <button
                onClick={() => handleInstallChoice(true)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${T.line}`, background: "none", color: installHandled ? T.text : T.dim, fontSize: 13 }}
              >
                {installHandled ? "Got it" : "Skip for now"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ width: "100%", maxWidth: 380, margin: "0 auto", paddingTop: 16 }}>
        <button onClick={finish} style={{ width: "100%", padding: "16px 0", borderRadius: 14, border: "none", background: T.accent, color: "#fff", fontSize: 16, fontWeight: 700 }}>
          {isReplay ? "Done" : "Start using DeltaLog"}
        </button>
      </div>

      {showInstallGuide && <InstallGuide onClose={() => setShowInstallGuide(false)} />}
      {simulate && <SimulateExitTag onExit={onComplete} />}
    </div>
  );
}

// A small, unmistakably-meta tag so an admin previewing the real
// onboarding chrome (which has no other exit before Finish, by design --
// a real new user can't back out of onboarding either) still has a way
// out of the simulation. Positioned apart from the flow's own controls
// so it doesn't read as part of what's being demonstrated.
function SimulateExitTag({ onExit }) {
  return (
    <button
      onClick={onExit}
      style={{ position: "fixed", top: 10, right: 10, zIndex: 50, background: T.accent, border: "none", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "5px 12px" }}
    >
      Exit simulation
    </button>
  );
}
