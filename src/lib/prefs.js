import { supabase } from "./supabaseClient";

const KEY = "deltalog_prefs";
const DEFAULTS = { restSeconds: 90, warmupRestSeconds: 60, warmupRestEnabled: true, restTimerSoundEnabled: true, restTimerSound: "chime", restTimerVibrationEnabled: true, restTimerVibration: "double", restTimerNotificationEnabled: false, units: "lb", muscleNameMode: "generic", scoreDisplay: "percentile", weightEntryMode: "manual", tutorialSeen: false, plate55Scope: "off", installPromptSeen: false, trainingIdeology: "Hypertrophy", setupWizardSeen: false, lastSeenVersion: null, lastWhatsNewDate: null, timeFormat: "12h", adminViewMode: "admin", homeRange: "30d", exportImagePrefs: null, homeModules: null, weeklySetGoalsMode: "individual", targetCalcMethod: "rir_autoregulation", muscleBreakdownSetsFilter: "working", muscleBreakdownRoleFilter: "both" };

// Backs up preferences to Supabase (migration_071's user_preferences,
// one jsonb blob per user) so clearing browser data -- cookies, cache,
// site data, the exact recovery step for the stale-service-worker
// gray-screen bug fixed in 1.12.14 -- doesn't also wipe every
// preference someone's set. Imports supabaseClient directly rather than
// going through queries.js, specifically to avoid a circular import:
// queries.js already imports getPrefs from this file (for unit
// conversions), so this file importing queries.js back would create a
// cycle. syncUserId is set once at sign-in (App.jsx) and cleared at
// sign-out; setPref() debounces a full-snapshot push whenever it's set,
// so call sites elsewhere in the app don't need to know sync exists at
// all -- same as they never needed to know about localStorage directly.
let syncUserId = null;
let syncTimer = null;

function pushPrefsSync() {
  if (!syncUserId) return;
  const uid = syncUserId;
  supabase.from("user_preferences")
    .upsert({ user_id: uid, prefs: getPrefs(), updated_at: new Date().toISOString() })
    .then(() => {})
    .catch(() => {});
}

function schedulePrefsSync() {
  if (!syncUserId) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushPrefsSync, 1500);
}

// Called once at sign-in (App.jsx). Pulls the person's saved server
// copy and merges it UNDER whatever's already in localStorage -- local
// wins for any key it actually contains (so an in-progress local change
// on this device never gets clobbered by a slightly-stale server copy),
// server only fills in keys local doesn't have at all. On a genuinely
// fresh/cleared browser, local has nothing, so this restores everything
// from the server copy; on a normal browser with existing prefs, this
// is a no-op merge that changes nothing they've already got locally.
export async function initPrefsSync(userId) {
  syncUserId = userId;
  try {
    const { data } = await supabase.from("user_preferences").select("prefs").eq("user_id", userId).maybeSingle();
    const serverPrefs = data?.prefs || null;
    if (!serverPrefs) return;
    let localRaw = {};
    try {
      const raw = localStorage.getItem(KEY);
      localRaw = raw ? JSON.parse(raw) : {};
    } catch {
      localRaw = {};
    }
    const merged = { ...serverPrefs, ...localRaw };
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    // Offline, or the table/row doesn't exist yet for this user --
    // local prefs (whatever they are) still work exactly as before.
  }
}

// Called at sign-out so a subsequent sign-in (possibly a different
// person on a shared device) never has a stray debounced write land
// under the wrong user_id.
export function clearPrefsSync() {
  syncUserId = null;
  clearTimeout(syncTimer);
}

// The home dashboard's modules, in their default order — every user
// effectively starts with this until they customize it via the pencil
// icon on Home. Keep in sync with the switch in Home.jsx's renderModule.
// weeklyGoalsMap is the one home for Weekly Set Goals (the bars widget
// that used to live under a separate "myPlan" id, and the standalone
// Settings entry, are both rolled into it) -- it doesn't fully hide
// itself even before any goal is saved, showing a setup prompt instead,
// since removing the Settings entry means this module (once enabled) is
// the only way in. See WeeklyGoalsBodyMap.jsx.
export const DEFAULT_HOME_MODULE_IDS = ["insight", "volume", "weight", "workoutTime", "muscleBreakdown", "weeklyGoalsMap", "calendar"];

export const HOME_MODULE_LABELS = {
  insight: "Last workout",
  volume: "Volume over time",
  weight: "Bodyweight over time",
  workoutTime: "Workout time",
  muscleBreakdown: "Muscle breakdown",
  weeklyGoalsMap: "Weekly Set Goals",
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
  schedulePrefsSync();
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
