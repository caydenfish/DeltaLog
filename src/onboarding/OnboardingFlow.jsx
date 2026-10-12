import { useEffect, useMemo, useState } from "react";
import { getPrefs, setPref } from "../lib/prefs";
import { saveProfile, acceptTerms } from "../lib/queries";
import { IDEOLOGIES } from "../lib/ideologies";
import { PROGRESSION_MODELS, PROGRESSION_MODEL_DESCRIPTIONS } from "../lib/programEngine";
import { NAME_MODES } from "../lib/muscleTaxonomy";
import { ftInToInches, inchesToFtIn } from "../lib/height";
import { fetchMyHandle, setMyHandle, searchUsersByHandle, normalizeHandle, HANDLE_PATTERN } from "../lib/social";
import { useBackLayer } from "../lib/backNav";
import { supabase } from "../lib/supabaseClient";
import WelcomeScreen from "./WelcomeScreen";
import { ILLUSTRATIONS } from "./illustrations";
import InstallGuide from "../InstallGuide";
import TermsViewer from "../TermsViewer";
import PrivacyPolicy from "../PrivacyPolicy";

// Intro and setup (v1.19.0). One component, three modes, so new users,
// people redoing setup and devs simulating it all see the same screens:
//   "new"      first run after sign-in. Saves as it goes; App gates on it.
//   "redo"     Settings > Redo setup. Starts filled with current answers.
//   "simulate" Admin > Onboarding simulator. Can start at any step, start
//              blank or filled, and run dry (nothing written anywhere).
// Steps: welcome (simulate only; real users see it in Auth) → about →
// body → training → app → finish.

const T = { bg: "#101216", surface: "#1A1D23", surface2: "#22262E", line: "#2C313B", line2: "#3A404B", text: "#F2F1EC", dim: "#A3A9B4", faint: "#8B919D", accent: "#E8442E", green: "#3BA55D", greenText: "#7BD69B" };
const condensed = "'Barlow Condensed', sans-serif";
const eyebrow = { fontFamily: condensed, fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.dim };
const inputStyle = { width: "100%", boxSizing: "border-box", height: 50, padding: "0 14px", borderRadius: 12, border: `1px solid ${T.line}`, background: T.surface, color: T.text, fontSize: 17, outline: "none", fontFamily: "inherit" };

export const ONBOARDING_STEPS = ["welcome", "about", "body", "training", "app", "finish"];
export const STEP_LABELS = { welcome: "Welcome", about: "About you", body: "Your body", training: "Training", app: "Your app", finish: "Finish" };
const PROGRESS_STEPS = ["about", "body", "training", "app"];
const GENDERS = ["Male", "Female", "Other"];
const GOAL_ART = { Strength: "strength", Hypertrophy: "hypertrophy", Endurance: "endurance" };

function blankAnswers() {
  return {
    firstName: "", lastName: "", handle: "",
    gender: "", dob: "", units: "lb", weight: "", heightUnit: "ftin", heightFt: "", heightIn: "", heightCm: "",
    trainingIdeology: "Hypertrophy", targetCalcMethod: "rir_autoregulation", scoreDisplay: "percentile", muscleNameMode: "generic", bodyModelSex: null,
  };
}
function answersFrom(profile, handle) {
  const p = getPrefs();
  const ftin = profile?.height_unit === "ftin" && profile?.height ? inchesToFtIn(profile.height) : null;
  return {
    firstName: profile?.first_name || "", lastName: profile?.last_name || "", handle: handle || "",
    gender: profile?.gender || "", dob: profile?.date_of_birth || "",
    units: p.units || profile?.weight_unit || "lb", weight: profile?.weight ? String(profile.weight) : "",
    heightUnit: profile?.height_unit === "cm" ? "cm" : "ftin",
    heightFt: ftin ? String(ftin.ft) : "", heightIn: ftin ? String(ftin.in) : "",
    heightCm: profile?.height_unit === "cm" && profile?.height ? String(profile.height) : "",
    trainingIdeology: p.trainingIdeology || "Hypertrophy", targetCalcMethod: p.targetCalcMethod || "rir_autoregulation",
    scoreDisplay: p.scoreDisplay || "percentile", muscleNameMode: p.muscleNameMode || "generic", bodyModelSex: p.bodyModelSex || null,
  };
}

function Segmented({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} style={{ display: "flex", gap: 4, padding: 4, borderRadius: 12, background: T.surface2 }}>
      {options.map((o) => {
        const key = typeof o === "string" ? o : o.key;
        const text = typeof o === "string" ? o : o.label;
        const on = key === value;
        return (
          <button key={key} onClick={() => onChange(key)} aria-pressed={on} style={{ flex: 1, minWidth: 0, height: 44, border: "none", borderRadius: 9, background: on ? T.accent : "transparent", color: on ? "#fff" : T.dim, fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {text}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, htmlFor, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      {htmlFor ? <label htmlFor={htmlFor} style={eyebrow}>{label}</label> : <span style={eyebrow}>{label}</span>}
      {children}
      {hint && <span style={{ fontSize: 12.5, color: T.faint, lineHeight: 1.4 }}>{hint}</span>}
    </div>
  );
}

const CheckIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
);

export default function OnboardingFlow({ user, profile, mode = "new", startStep, fill = "mine", dryRun = false, onExit }) {
  const simulate = mode === "simulate";
  const steps = simulate ? ONBOARDING_STEPS : ONBOARDING_STEPS.slice(1);
  const [step, setStep] = useState(() => (steps.includes(startStep) ? startStep : steps[0]));
  const [a, setA] = useState(() => (fill === "blank" ? blankAnswers() : answersFrom(profile, null)));
  const [savedHandle, setSavedHandle] = useState(null); // the handle stored on the account, for availability checks
  const [handleState, setHandleState] = useState("idle"); // idle | checking | available | taken | invalid | mine
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [openPref, setOpenPref] = useState("targetCalcMethod");
  const set = (patch) => { setError(null); setA((prev) => ({ ...prev, ...patch })); };
  const write = !(simulate && dryRun); // false = dry run: nothing touches the server or local prefs

  // Pull the stored ID so "mine" fills show it and availability treats it as yours.
  useEffect(() => {
    if (!user) return;
    fetchMyHandle(user.id).then((r) => {
      setSavedHandle(r.handle || null);
      if (fill !== "blank" && r.handle) setA((prev) => (prev.handle ? prev : { ...prev, handle: r.handle }));
    }).catch(() => {});
  }, [user, fill]);

  // Live ID availability.
  useEffect(() => {
    const h = normalizeHandle(a.handle);
    if (!h) { setHandleState("idle"); return; }
    if (!HANDLE_PATTERN.test(h)) { setHandleState("invalid"); return; }
    if (savedHandle && h === savedHandle.toLowerCase()) { setHandleState("mine"); return; }
    setHandleState("checking");
    const t = setTimeout(() => {
      searchUsersByHandle(h)
        .then((rows) => setHandleState(rows.some((r) => (r.handle || "").toLowerCase() === h) ? "taken" : "available"))
        .catch(() => setHandleState("available"));
    }, 300);
    return () => clearTimeout(t);
  }, [a.handle, savedHandle]);

  const idx = steps.indexOf(step);
  function back() {
    setError(null);
    if (idx > 0) setStep(steps[idx - 1]);
    else if (mode !== "new") onExit("cancel");
  }
  useBackLayer(mode === "new" && idx === 0 ? 0 : 1, back, 40);

  const bodyModelSex = a.bodyModelSex || (a.gender === "Female" ? "female" : "male");

  const canContinue = useMemo(() => {
    if (step === "about") return a.firstName.trim() && a.lastName.trim() && (handleState === "available" || handleState === "mine");
    if (step === "body") return a.gender && a.dob;
    return true;
  }, [step, a, handleState]);

  async function next() {
    if (!canContinue || busy) return;
    setBusy(true); setError(null);
    try {
      if (step === "about" && write) {
        // New accounts need a profile row before the ID or terms can be
        // stored on it; saveProfile upserts, and only sends the fields given.
        await saveProfile(user.id, { firstName: a.firstName.trim(), lastName: a.lastName.trim(), weightUnit: a.units });
        if (mode === "new" && !profile?.terms_accepted_at) await acceptTerms(user.id);
        const h = normalizeHandle(a.handle);
        if (h !== (savedHandle || "").toLowerCase()) setSavedHandle(await setMyHandle(h));
      }
      if (step === "app" && write) {
        const height = a.heightUnit === "ftin" ? ftInToInches(a.heightFt, a.heightIn) : (parseFloat(a.heightCm) || null);
        await saveProfile(user.id, {
          firstName: a.firstName.trim(), lastName: a.lastName.trim(),
          gender: a.gender, dateOfBirth: a.dob,
          weight: parseFloat(a.weight) || null, weightUnit: a.units,
          height, heightUnit: a.heightUnit,
        });
        setPref("units", a.units);
        setPref("trainingIdeology", a.trainingIdeology);
        setPref("targetCalcMethod", a.targetCalcMethod);
        setPref("scoreDisplay", a.scoreDisplay);
        setPref("muscleNameMode", a.muscleNameMode);
        setPref("bodyModelSex", bodyModelSex);
        setPref("setupWizardSeen", true);
      }
      setStep(steps[idx + 1]);
    } catch (e) {
      setError(e.message || "Couldn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const banner = simulate ? (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: "rgba(232,176,75,0.12)", border: "1px solid rgba(232,176,75,0.45)", flexShrink: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "#E8B04B", whiteSpace: "nowrap" }}>SIMULATION</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "#D6D8DD", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{dryRun ? "Dry run · nothing is saved" : "Live · answers save to your account"}</span>
      <button onClick={() => onExit("cancel")} style={{ background: "none", border: "none", padding: "4px 0", color: "#E8B04B", fontSize: 13, fontWeight: 700 }}>Exit</button>
    </div>
  ) : null;

  const overlays = (
    <>
      {showInstall && <InstallGuide onClose={() => setShowInstall(false)} />}
      {showTerms && <TermsViewer onClose={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacyPolicy user={user} onClose={() => setShowPrivacy(false)} />}
    </>
  );

  if (step === "welcome") {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
        <WelcomeScreen banner={banner} onGoogle={next} onEmail={next} onSignIn={next} onTerms={() => setShowTerms(true)} onPrivacy={() => setShowPrivacy(true)} />
        {overlays}
      </div>
    );
  }

  const progressAt = PROGRESS_STEPS.indexOf(step);
  const showBack = idx > 0 || mode !== "new";

  let title, subtitle, body, cta;
  if (step === "about") {
    title = mode === "redo" ? "About you" : "Who's lifting?";
    subtitle = "Your name stays private. Your ID is how friends find you.";
    const hs = handleState;
    const status = hs === "available" ? { c: T.greenText, t: "Available", ok: true }
      : hs === "mine" ? { c: T.greenText, t: "Yours", ok: true }
      : hs === "taken" ? { c: "#FF8A78", t: "Taken" }
      : hs === "checking" ? { c: T.faint, t: "Checking" }
      : null;
    body = (
      <>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}><Field label="First name" htmlFor="ob-first"><input id="ob-first" autoComplete="given-name" value={a.firstName} onChange={(e) => set({ firstName: e.target.value })} style={inputStyle} /></Field></div>
          <div style={{ flex: 1, minWidth: 0 }}><Field label="Last name" htmlFor="ob-last"><input id="ob-last" autoComplete="family-name" value={a.lastName} onChange={(e) => set({ lastName: e.target.value })} style={inputStyle} /></Field></div>
        </div>
        <Field label="Your ID" htmlFor="ob-handle" hint={hs === "invalid" ? "3-20 characters: letters, numbers, _ and ." : "Letters, numbers, _ and . You can change it once a week."}>
          <div style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 4, borderColor: status?.ok ? T.green : hs === "taken" || hs === "invalid" ? T.accent : T.line }}>
            <span style={{ color: T.faint }}>@</span>
            <input id="ob-handle" value={a.handle} onChange={(e) => set({ handle: e.target.value.replace(/\s/g, "") })} autoCapitalize="none" autoCorrect="off" autoComplete="off" maxLength={21} style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: T.text, fontSize: 17, fontFamily: "inherit" }} />
            {status && <span style={{ display: "flex", alignItems: "center", gap: 4, color: status.c, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{status.ok && <CheckIcon />}{status.t}</span>}
          </div>
        </Field>
      </>
    );
    cta = "Continue";
  } else if (step === "body") {
    title = "Your body";
    subtitle = "Sets your strength score and the body on your muscle map. Never shown to friends.";
    body = (
      <>
        {ILLUSTRATIONS.body && <img src={ILLUSTRATIONS.body} alt="" aria-hidden="true" style={{ height: 96, objectFit: "contain", alignSelf: "flex-start", filter: "invert(1) opacity(0.85)" }} />}
        <Field label="Sex"><Segmented label="Sex" options={GENDERS} value={a.gender} onChange={(g) => set({ gender: g })} /></Field>
        <Field label="Birthday" htmlFor="ob-dob"><input id="ob-dob" type="date" value={a.dob} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set({ dob: e.target.value })} style={{ ...inputStyle, colorScheme: "dark" }} /></Field>
        <Field label="Units" hint="Used everywhere you enter or see a weight."><Segmented label="Units" options={["lb", "kg"]} value={a.units} onChange={(u) => set({ units: u })} /></Field>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Field label={`Weight (${a.units})`} htmlFor="ob-weight"><input id="ob-weight" inputMode="decimal" value={a.weight} onChange={(e) => set({ weight: e.target.value.replace(/[^\d.]/g, "") })} placeholder="Optional" style={inputStyle} /></Field>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Field label="Height">
              {a.heightUnit === "ftin" ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <input aria-label="Height, feet" inputMode="numeric" value={a.heightFt} onChange={(e) => set({ heightFt: e.target.value.replace(/\D/g, "") })} placeholder="ft" style={inputStyle} />
                  <input aria-label="Height, inches" inputMode="decimal" value={a.heightIn} onChange={(e) => set({ heightIn: e.target.value.replace(/[^\d.]/g, "") })} placeholder="in" style={inputStyle} />
                </div>
              ) : (
                <input aria-label="Height, centimeters" inputMode="decimal" value={a.heightCm} onChange={(e) => set({ heightCm: e.target.value.replace(/[^\d.]/g, "") })} placeholder="cm" style={inputStyle} />
              )}
            </Field>
          </div>
        </div>
        <button onClick={() => set({ heightUnit: a.heightUnit === "ftin" ? "cm" : "ftin" })} style={{ alignSelf: "flex-end", marginTop: -8, background: "none", border: "none", color: T.dim, fontSize: 13, fontWeight: 600, padding: "6px 0" }}>
          Use {a.heightUnit === "ftin" ? "cm" : "ft and in"}
        </button>
      </>
    );
    cta = "Continue";
  } else if (step === "training") {
    title = "What are you training for?";
    subtitle = "Sets your default rep range. You can change it for any exercise, any workout.";
    body = Object.entries(IDEOLOGIES).map(([name, v]) => {
      const on = a.trainingIdeology === name;
      const art = ILLUSTRATIONS[GOAL_ART[name]];
      return (
        <button key={name} onClick={() => set({ trainingIdeology: name })} aria-pressed={on} style={{ display: "flex", gap: 14, alignItems: "center", padding: 16, borderRadius: 14, border: on ? `2px solid ${T.accent}` : `1px solid ${T.line}`, background: on ? "rgba(232,68,46,0.10)" : T.surface, color: T.text, textAlign: "left" }}>
          {art && <img src={art} alt="" aria-hidden="true" style={{ width: 56, height: 56, objectFit: "contain", flexShrink: 0, filter: "invert(1) opacity(0.9)" }} />}
          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: condensed, fontSize: 24, fontWeight: 700, textTransform: "uppercase" }}>{name}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: on ? "#FF8A78" : T.dim, whiteSpace: "nowrap" }}>{v.low}-{v.high} reps</span>
            </span>
            <span style={{ fontSize: 14, lineHeight: 1.4, color: T.dim }}>{v.desc}</span>
          </span>
        </button>
      );
    });
    cta = "Continue";
  } else if (step === "app") {
    title = mode === "redo" ? "Your app" : "We set these up for you";
    subtitle = "Recommended defaults. Tap any to change, or keep them and go.";
    const scoreOpts = [
      { key: "percentile", label: "DeltaLog Percentile", sub: "Ranks your best lifts against real DeltaLog users" },
      { key: "dots", label: "DOTS", sub: "Powerlifting formula, bodyweight-normalized" },
      { key: "none", label: "Off", sub: "No score, no comparisons" },
    ];
    const rows = [
      { id: "targetCalcMethod", label: "Next-set targets", recommended: "rir_autoregulation",
        options: Object.entries(PROGRESSION_MODELS).map(([key, label]) => ({ key, label, sub: PROGRESSION_MODEL_DESCRIPTIONS[key].split(". ")[0] + "." })),
        detail: PROGRESSION_MODEL_DESCRIPTIONS[a.targetCalcMethod] },
      { id: "scoreDisplay", label: "Strength score", recommended: "percentile", options: scoreOpts },
      { id: "muscleNameMode", label: "Muscle names", recommended: "generic", options: NAME_MODES.map((m) => ({ key: m.key, label: m.label, sub: `e.g. ${m.example}` })) },
      { id: "bodyModelSex", label: "Body map", recommended: null, value: bodyModelSex,
        options: [{ key: "male", label: "Male", sub: "Male anatomy on your heatmap" }, { key: "female", label: "Female", sub: "Female anatomy on your heatmap" }] },
    ];
    body = rows.map((r) => {
      const value = r.value ?? a[r.id];
      const current = r.options.find((o) => o.key === value) || r.options[0];
      const open = openPref === r.id;
      return open ? (
        <div key={r.id} style={{ borderRadius: 14, border: `1px solid ${T.line2}`, background: T.surface, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={() => setOpenPref(null)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", padding: 0, color: T.text }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{r.label}</span>
            {r.recommended === value && <span style={{ fontSize: 12, fontWeight: 700, color: T.greenText }}>Recommended</span>}
          </button>
          {r.options.map((o) => {
            const sel = o.key === value;
            return (
              <button key={o.key} onClick={() => set({ [r.id]: o.key })} aria-pressed={sel} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 48, padding: "6px 12px", borderRadius: 10, border: sel ? `1.5px solid ${T.accent}` : `1px solid ${T.line}`, background: T.bg, color: T.text, textAlign: "left" }}>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700 }}>{o.label}</span>
                  {o.sub && <span style={{ fontSize: 12.5, color: T.faint, lineHeight: 1.35 }}>{o.sub}</span>}
                </span>
                {sel && <span style={{ color: "#FF8A78", display: "flex" }}><CheckIcon /></span>}
              </button>
            );
          })}
          {r.detail && <span style={{ fontSize: 12.5, lineHeight: 1.45, color: T.faint }}>{r.detail}</span>}
        </div>
      ) : (
        <button key={r.id} onClick={() => setOpenPref(r.id)} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 56, padding: "0 14px", borderRadius: 14, border: `1px solid ${T.line}`, background: T.surface, color: T.text, textAlign: "left" }}>
          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{r.label}</span>
            <span style={{ fontSize: 13, color: T.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{current.label}{r.id === "bodyModelSex" && !a.bodyModelSex ? " · from your answer" : ""}</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      );
    });
    cta = mode === "redo" ? "Save" : "Looks good";
  }

  if (step === "finish") {
    const standalone = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone);
    const ideo = IDEOLOGIES[a.trainingIdeology];
    const done = (choice) => onExit(simulate ? "cancel" : choice);
    const secondary = { height: 52, borderRadius: 14, border: `1px solid ${T.line2}`, background: T.surface, color: T.text, fontSize: 16, fontWeight: 600, whiteSpace: "nowrap" };
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 60, background: T.bg, color: T.text, display: "flex", justifyContent: "center", overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: 420, boxSizing: "border-box", minHeight: "100dvh", display: "flex", flexDirection: "column", padding: "calc(16px + env(safe-area-inset-top, 0px)) 22px calc(24px + env(safe-area-inset-bottom, 0px))" }}>
          {banner}
          <div style={{ height: 32 }} />
          {ILLUSTRATIONS.finish ? (
            <img src={ILLUSTRATIONS.finish} alt="" aria-hidden="true" style={{ height: 120, objectFit: "contain", alignSelf: "flex-start", filter: "invert(1) opacity(0.9)" }} />
          ) : (
            <span style={{ width: 56, height: 56, borderRadius: 28, background: "rgba(59,165,93,0.16)", color: T.greenText, display: "flex", alignItems: "center", justifyContent: "center" }}><CheckIcon size={28} /></span>
          )}
          <h1 style={{ margin: "18px 0 0", fontFamily: condensed, fontSize: 40, fontWeight: 700, lineHeight: 1, textTransform: "uppercase" }}>
            {mode === "redo" ? "Setup saved" : `You're set${a.firstName.trim() ? `, ${a.firstName.trim()}` : ""}`}
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.45, color: T.dim }}>
            {a.trainingIdeology}, {ideo ? `${ideo.low}-${ideo.high} reps` : ""}, {a.units}. Change any of it in Settings, or redo setup anytime.
          </p>
          {!standalone && mode !== "redo" && (
            <div style={{ marginTop: 24, borderRadius: 14, border: `1px solid ${T.line}`, background: T.surface, padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>Add to your home screen</span>
                <span style={{ fontSize: 13, lineHeight: 1.4, color: T.dim }}>Opens full screen and works offline.</span>
              </span>
              <button onClick={() => setShowInstall(true)} style={{ height: 40, padding: "0 14px", borderRadius: 10, border: `1px solid ${T.line2}`, background: "transparent", color: T.text, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>Show me</button>
            </div>
          )}
          {mode === "redo" ? (
            <>
              <div style={{ flex: 1 }} />
              <button onClick={() => done("dashboard")} style={{ height: 54, border: "none", borderRadius: 14, background: T.accent, color: "#fff", fontSize: 17, fontWeight: 700 }}>Done</button>
            </>
          ) : (
            <>
              <span style={{ ...eyebrow, marginTop: 26, letterSpacing: "0.1em" }}>Where do you want to start?</span>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={() => done("workout")} style={{ height: 54, border: "none", borderRadius: 14, background: T.accent, color: "#fff", fontSize: 17, fontWeight: 700, whiteSpace: "nowrap" }}>Start my first workout</button>
                <button onClick={() => done("templates")} style={secondary}>Build a template first</button>
                <button onClick={() => done("friends")} style={secondary}>Find friends</button>
              </div>
              <div style={{ flex: 1, minHeight: 16 }} />
              <button onClick={() => done("dashboard")} style={{ height: 44, border: "none", background: "transparent", color: T.dim, fontSize: 15, fontWeight: 600 }}>Take me to the dashboard</button>
            </>
          )}
        </div>
        {overlays}
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: T.bg, color: T.text, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 420, boxSizing: "border-box", minHeight: "100dvh", display: "flex", flexDirection: "column", padding: "calc(12px + env(safe-area-inset-top, 0px)) 22px calc(24px + env(safe-area-inset-bottom, 0px))" }}>
        {banner}
        <div style={{ display: "flex", alignItems: "center", gap: 10, height: 44, marginTop: banner ? 8 : 0 }}>
          {showBack ? (
            <button onClick={back} aria-label={idx === 0 ? "Close" : "Back"} style={{ width: 44, height: 44, marginLeft: -12, border: "none", background: "transparent", color: T.text, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          ) : <span style={{ width: 32 }} />}
          <div style={{ flex: 1, display: "flex", gap: 6 }} aria-hidden="true">
            {PROGRESS_STEPS.map((s, i) => <span key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= progressAt ? T.accent : T.line }} />)}
          </div>
        </div>
        <span style={{ ...eyebrow, marginTop: 14, letterSpacing: "0.1em" }}>Step {progressAt + 1} of {PROGRESS_STEPS.length} · {STEP_LABELS[step]}</span>
        <h1 style={{ margin: "6px 0 0", fontFamily: condensed, fontSize: 34, fontWeight: 700, lineHeight: 1.05, textTransform: "uppercase" }}>{title}</h1>
        <p style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.45, color: T.dim }}>{subtitle}</p>
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: step === "training" || step === "app" ? 10 : 18 }}>{body}</div>
        <div style={{ flex: 1, minHeight: 24 }} />
        {error && <div role="alert" style={{ marginBottom: 10, fontSize: 13, color: "#FF8A78", lineHeight: 1.4 }}>{error}</div>}
        {step === "about" && mode === "new" && !profile?.terms_accepted_at && (
          <p style={{ margin: "0 0 10px", textAlign: "center", fontSize: 12.5, lineHeight: 1.5, color: T.faint }}>
            By continuing you agree to the{" "}
            <button onClick={() => setShowTerms(true)} style={{ background: "none", border: "none", padding: 0, color: "#FF6A55", fontSize: 12.5, textDecoration: "underline" }}>Terms</button>
            {" "}and{" "}
            <button onClick={() => setShowPrivacy(true)} style={{ background: "none", border: "none", padding: 0, color: "#FF6A55", fontSize: 12.5, textDecoration: "underline" }}>Privacy Policy</button>.
          </p>
        )}
        <button onClick={next} disabled={!canContinue || busy} style={{ height: 54, border: "none", borderRadius: 14, background: T.accent, color: "#fff", fontSize: 17, fontWeight: 700, whiteSpace: "nowrap", opacity: !canContinue || busy ? 0.5 : 1 }}>
          {busy ? "Saving..." : cta}
        </button>
        {mode === "new" && idx === 0 && (
          <button onClick={() => supabase.auth.signOut()} style={{ marginTop: 6, height: 40, border: "none", background: "transparent", color: T.faint, fontSize: 14, fontWeight: 600 }}>
            Wrong account? Sign out
          </button>
        )}
      </div>
      {overlays}
    </div>
  );
}
