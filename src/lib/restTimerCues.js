// Rest-timer completion cues: sound and vibration, each independently
// enabled and selectable in Settings > Rest Timer. Sounds are
// synthesized with the Web Audio API rather than bundled audio files --
// keeps this dependency-free and instant to add new options to.

let sharedCtx = null;
function getAudioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedCtx) sharedCtx = new Ctx();
  // Browsers suspend a newly-created (or backgrounded-tab) AudioContext
  // until it's resumed from a user gesture. Tapping "Test" or finishing
  // a rest timer both happen after the person has already interacted
  // with the page this session, so resume() here is safe and silent if
  // it's already running.
  if (sharedCtx.state === "suspended") sharedCtx.resume().catch(() => {});
  return sharedCtx;
}

function tone(ctx, { freq, start, duration, type = "sine", peakGain = 0.3 }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const t0 = ctx.currentTime + start;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

const SOUNDS = {
  chime: (ctx) => {
    tone(ctx, { freq: 660, start: 0, duration: 0.32, type: "sine" });
    tone(ctx, { freq: 880, start: 0.12, duration: 0.4, type: "sine" });
  },
  bell: (ctx) => {
    tone(ctx, { freq: 523, start: 0, duration: 0.9, type: "triangle", peakGain: 0.28 });
    tone(ctx, { freq: 1046, start: 0, duration: 0.6, type: "sine", peakGain: 0.12 });
  },
  beep: (ctx) => {
    tone(ctx, { freq: 880, start: 0, duration: 0.18, type: "square", peakGain: 0.2 });
    tone(ctx, { freq: 880, start: 0.22, duration: 0.18, type: "square", peakGain: 0.2 });
  },
  digital: (ctx) => {
    tone(ctx, { freq: 1200, start: 0, duration: 0.09, type: "square", peakGain: 0.18 });
    tone(ctx, { freq: 1200, start: 0.13, duration: 0.09, type: "square", peakGain: 0.18 });
    tone(ctx, { freq: 1200, start: 0.26, duration: 0.09, type: "square", peakGain: 0.18 });
  },
};

export const REST_TIMER_SOUNDS = [
  { key: "chime", label: "Chime" },
  { key: "bell", label: "Bell" },
  { key: "beep", label: "Beep" },
  { key: "digital", label: "Digital" },
];

export function playRestTimerSound(key) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const play = SOUNDS[key] || SOUNDS.chime;
  try {
    play(ctx);
  } catch {
    // Audio is a nice-to-have here, never worth surfacing an error for.
  }
}

const VIBRATIONS = {
  short: [200],
  double: [120, 100, 120],
  triple: [90, 90, 90, 90, 90],
  long: [600],
};

export const REST_TIMER_VIBRATIONS = [
  { key: "short", label: "Short pulse" },
  { key: "double", label: "Double pulse" },
  { key: "triple", label: "Triple pulse" },
  { key: "long", label: "Long buzz" },
];

export function triggerRestTimerVibration(key) {
  // Vibration API isn't implemented in iOS Safari at all -- this is a
  // silent no-op there rather than an error, same as any other
  // capability check.
  if (!navigator.vibrate) return;
  try {
    navigator.vibrate(VIBRATIONS[key] || VIBRATIONS.double);
  } catch {
    // ignore
  }
}
