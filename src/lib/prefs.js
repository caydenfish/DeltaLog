const KEY = "deltalog_prefs";
const DEFAULTS = { restSeconds: 90, warmupRestSeconds: 60, warmupRestEnabled: true, restTimerSoundEnabled: true, restTimerSound: "chime", restTimerVibrationEnabled: true, restTimerVibration: "double", restTimerNotificationEnabled: false, units: "lb", muscleNameMode: "generic", scoreDisplay: "percentile", weightEntryMode: "manual", tutorialSeen: false, plate55Scope: "off", installPromptSeen: false, trainingIdeology: "Hypertrophy", setupWizardSeen: false, lastSeenVersion: null, lastWhatsNewDate: null, timeFormat: "12h", adminViewMode: "admin", homeRange: "30d", exportImagePrefs: null, muscleBreakdownChartType: "bodymap", homeModules: null, weeklySetGoalsMode: "individual" };

// The home dashboard's modules, in their default order — every user
// effectively starts with this until they customize it via the pencil
// icon on Home. Keep in sync with the switch in Home.jsx's renderModule.
export const DEFAULT_HOME_MODULE_IDS = ["insight", "myPlan", "volume", "weight", "workoutTime", "muscleBreakdown", "calendar"];

export const HOME_MODULE_LABELS = {
  insight: "Last workout",
  myPlan: "Weekly Set Goals",
  volume: "Volume over time",
  weight: "Bodyweight over time",
  workoutTime: "Workout time",
  muscleBreakdown: "Muscle breakdown",
  calendar: "Calendar",
};

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

// Independent Training Range per home chart (Volume, Bodyweight, Workout
// Time, Muscle breakdown) -- e.g. someone might want Bodyweight pinned
// to 90 Days while Volume stays at 30 Days. Falls back to the old
// single `homeRange` pref for anything not yet set per-chart, so
// existing users' one range carries over as every chart's starting
// point rather than silently resetting to a hardcoded default.
export function getChartRange(chartId) {
  const prefs = getPrefs();
  const perChart = prefs.homeChartRanges || {};
  return perChart[chartId] || prefs.homeRange || "30d";
}

export function setChartRange(chartId, rangeKey) {
  const prefs = getPrefs();
  const perChart = { ...(prefs.homeChartRanges || {}), [chartId]: rangeKey };
  setPref("homeChartRanges", perChart);
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

// Returns the home dashboard's modules as [{ id, enabled }], in the
// user's saved order if they've customized it. Reconciles against
// DEFAULT_HOME_MODULE_IDS so a module added in a later release (e.g.
// Workout Time) still shows up appended at the end for someone who
// customized their layout before it existed, and a since-removed id in
// old saved state is silently dropped instead of rendering nothing.
export function getHomeModules() {
  const saved = getPrefs().homeModules;
  const known = new Set(DEFAULT_HOME_MODULE_IDS);
  const modules = Array.isArray(saved) ? saved.filter((m) => m && known.has(m.id)) : [];
  const present = new Set(modules.map((m) => m.id));
  for (const id of DEFAULT_HOME_MODULE_IDS) {
    if (!present.has(id)) modules.push({ id, enabled: true });
  }
  return modules;
}

export function setHomeModules(modules) {
  setPref("homeModules", modules);
}
