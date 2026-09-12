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
  gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// Each sound takes a `base` time offset (seconds) so the same cue can be
// scheduled twice in one go -- see REPEAT_GAP below. Softened across the
// board from the original set: lower peak gains, rounder waveforms
// (sine/triangle instead of square), slightly slower attack -- a rest
// timer going off shouldn't startle you.
const SOUNDS = {
  chime: (ctx, base = 0) => {
    tone(ctx, { freq: 587, start: base, duration: 0.34, type: "sine", peakGain: 0.16 });
    tone(ctx, { freq: 784, start: base + 0.14, duration: 0.42, type: "sine", peakGain: 0.14 });
  },
  bell: (ctx, base = 0) => {
    tone(ctx, { freq: 523, start: base, duration: 0.8, type: "triangle", peakGain: 0.16 });
    tone(ctx, { freq: 1046, start: base, duration: 0.55, type: "sine", peakGain: 0.06 });
  },
  beep: (ctx, base = 0) => {
    tone(ctx, { freq: 740, start: base, duration: 0.16, type: "triangle", peakGain: 0.14 });
    tone(ctx, { freq: 740, start: base + 0.2, duration: 0.16, type: "triangle", peakGain: 0.14 });
  },
  digital: (ctx, base = 0) => {
    tone(ctx, { freq: 880, start: base, duration: 0.08, type: "sine", peakGain: 0.13 });
    tone(ctx, { freq: 880, start: base + 0.12, duration: 0.08, type: "sine", peakGain: 0.13 });
    tone(ctx, { freq: 880, start: base + 0.24, duration: 0.08, type: "sine", peakGain: 0.13 });
  },
};

export const REST_TIMER_SOUNDS = [
  { key: "chime", label: "Chime" },
  { key: "bell", label: "Bell" },
  { key: "beep", label: "Beep" },
  { key: "digital", label: "Digital" },
];

// Gap (seconds) between the two chimes -- long enough to read as two
// distinct rings rather than one messy overlapping sound, short enough
// to still feel like a single alert rather than two separate ones.
const REPEAT_GAP = 0.9;

export function playRestTimerSound(key) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const play = SOUNDS[key] || SOUNDS.chime;
  try {
    play(ctx, 0);
    play(ctx, REPEAT_GAP);
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

// Whether this browser/device can show notifications at all -- used to
// hide the toggle entirely rather than show a control that can never
// work (e.g. Notification isn't defined in some in-app browser webviews).
export function notificationsSupported() {
  return typeof Notification !== "undefined";
}

// Current permission state: "granted" | "denied" | "default" | "unsupported".
export function getNotificationPermission() {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

// Prompts for permission if it hasn't been decided yet. Must be called
// from a user gesture (the Settings toggle's onClick) -- browsers ignore
// or reject a request made outside one. Returns the resulting permission
// string so the toggle can reflect it immediately.
export async function requestNotificationPermission() {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

// Shows the actual "Rest Timer Complete" notification. Routed through
// the service worker registration when one's active (registration.
// showNotification) rather than `new Notification(...)` directly --
// that constructor throws on some mobile browsers once a page is
// installed as a PWA, where notifications are only allowed via a
// service worker. Falls back to the plain constructor if no
// registration is available (e.g. running in a plain browser tab
// during development).
export async function showRestTimerNotification() {
  if (getNotificationPermission() !== "granted") return;
  const options = {
    body: "Time to get back to it.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "rest-timer-complete",
    renotify: true,
  };
  try {
    if (navigator.serviceWorker) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification("Rest Timer Complete", options);
        return;
      }
    }
    new Notification("Rest Timer Complete", options);
  } catch {
    // A notification is a nice-to-have here, never worth surfacing an
    // error for -- the in-app sound/vibration already covered it.
  }
}
