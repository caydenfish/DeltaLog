const KEY = "deltalog_prefs";
const DEFAULTS = { restSeconds: 90, warmupRestSeconds: 60, warmupRestEnabled: true, restTimerSoundEnabled: true, restTimerSound: "chime", restTimerVibrationEnabled: true, restTimerVibration: "double", restTimerNotificationEnabled: false, units: "lb", muscleNameMode: "generic", scoreDisplay: "percentile", weightEntryMode: "manual", tutorialSeen: false, plate55Scope: "off", installPromptSeen: false, trainingIdeology: "Hypertrophy", setupWizardSeen: false, lastSeenVersion: null, lastWhatsNewDate: null, timeFormat: "12h", adminViewMode: "admin", homeRange: "30d", exportImagePrefs: null, muscleBreakdownChartType: "bodymap" };

export function getPrefs() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    // Migrate the old boolean toggle (on = every lift could use the big
    // plate) to the new pattern-scoped preference, once.
    if (parsed.plate55Scope === undefined && parsed.allow55 !== undefined) {
      parsed.plate55Scope = parsed.allow55 ? "all" : "off";
    }
    // Migrate the old generic/scientific-only boolean to the new 3-way
    // mode that adds a "detailed" (gym-common) middle tier, once.
    if (parsed.muscleNameMode === undefined && parsed.scientificNames !== undefined) {
      parsed.muscleNameMode = parsed.scientificNames ? "scientific" : "generic";
    }
    // The setup wizard is for first-time users only. Anyone who already
    // has other prefs set (i.e. they've used the app before this wizard
    // existed) gets skipped straight past it, once, rather than being
    // interrupted by an onboarding step that's meant for new installs.
    if (parsed.setupWizardSeen === undefined && (parsed.tutorialSeen || parsed.installPromptSeen)) {
      parsed.setupWizardSeen = true;
    }
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setPref(key, value) {
  const prefs = getPrefs();
  prefs[key] = value;
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // ignore write failures (e.g. private browsing storage limits)
  }
}
