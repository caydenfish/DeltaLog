import { createContext, useCallback, useContext, useState } from "react";
import { getPrefs, setPref } from "./lib/prefs";

// A deliberately simple guided tour: every step advances ONLY when the
// person taps the next/back arrows — no auto-timers, no waiting on the
// person to perform in-app actions. Two modes:
//   "info" — tapping next just moves to the next step.
//   "nav"  — tapping next first taps the real element being highlighted
//            (opening Settings, opening Templates), then moves on. The
//            person never has to find or tap the element themselves.
// `onAdvance` (optional): a selector clicked silently when leaving the
// step, used to close a screen the tour opened (e.g. Templates) so the
// next step's element is back on screen.
export const TUTORIAL_STEPS = [
  {
    target: null,
    title: "Welcome to DeltaLog",
    body: "A quick tour of the essentials. Use the arrows to move through it — skip anytime, rewatch from Settings > Help.",
    mode: "info",
  },
  {
    target: '[data-tutorial="settings-btn"]',
    title: "Settings",
    body: "Preferences, templates, and your profile all live behind this menu. Tap next to take a look inside.",
    mode: "nav",
  },
  {
    target: '[data-tutorial="default-entry-toggle"]',
    title: "Default set entry",
    body: "Choose whether logging a set opens with manual weight entry or the plate calculator. You can switch per set either way.",
    mode: "info",
  },
  {
    target: '[data-tutorial="templates-row"]',
    title: "Templates",
    body: "Reusable workouts, so you're not rebuilding the same session every time. Tap next to peek at the builder.",
    mode: "nav",
  },
  {
    target: '[data-tutorial="new-template-btn"]',
    title: "Build a template",
    body: "Tap here anytime — pick exercises, set planned sets for each, and it's ready to load whenever you start a workout.",
    mode: "info",
    onAdvance: '[data-tutorial="templates-close-btn"]',
  },
  {
    target: '[data-tutorial="start-workout"]',
    title: "Start a workout",
    body: "Every session begins here. You'll get an empty workout you can fill three ways: build it exercise-by-exercise, load a template, or let the generator put one together from muscle groups you pick.",
    mode: "info",
  },
  {
    target: null,
    title: "Logging sets",
    body: "Inside a workout, each exercise has its own set list. Tap Log next set, enter weight and reps, and your last session's numbers sit right there for reference. The exercise picker supports multi-select, so you can queue up several at once.",
    mode: "info",
  },
  {
    target: null,
    title: "Strength, Hypertrophy, or Endurance",
    body: "Every exercise targets a rep range based on a training focus: Strength (3-5 reps, heavy), Hypertrophy (8-12 reps, muscle growth), or Endurance (15-20 reps, work capacity). Your target weight recalculates from your estimated 1RM to match whichever you pick. Set it app-wide or override it per exercise from the badge above the set list.",
    mode: "info",
  },
  {
    target: null,
    title: "The plate calculator",
    body: "No more mental math at the rack. Tap plates to load the bar — the total updates live and mirrors both sides. Or type a target weight and tap Optimize loading to fill the bar with the fewest plates in one move.",
    mode: "info",
    visual: "plateCalc",
  },
  {
    target: null,
    title: "Rest timer",
    body: "Starts automatically after every set you log. Each exercise remembers its own rest time, and the default is adjustable in Settings.",
    mode: "info",
  },
  {
    target: null,
    title: "That's the tour",
    body: "Rewatch this anytime from Settings > Help. Now go lift something.",
    mode: "info",
  },
];

const TutorialCtx = createContext(null);

export function TutorialProvider({ children }) {
  const [stepIndex, setStepIndex] = useState(-1); // -1 = inactive

  const start = useCallback(() => setStepIndex(0), []);
  const finish = useCallback(() => {
    setPref("tutorialSeen", true);
    setStepIndex(-1);
  }, []);
  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i + 1 >= TUTORIAL_STEPS.length) {
        setPref("tutorialSeen", true);
        return -1;
      }
      return i + 1;
    });
  }, []);
  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const active = stepIndex >= 0;
  const value = {
    active,
    step: active ? TUTORIAL_STEPS[stepIndex] : null,
    stepIndex,
    totalSteps: TUTORIAL_STEPS.length,
    start,
    next,
    prev,
    skip: finish,
    startIfUnseen: useCallback(() => {
      if (!getPrefs().tutorialSeen) start();
    }, [start]),
  };

  return <TutorialCtx.Provider value={value}>{children}</TutorialCtx.Provider>;
}

export function useTutorial() {
  return useContext(TutorialCtx);
}
