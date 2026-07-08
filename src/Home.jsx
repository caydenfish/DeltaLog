import { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "./lib/supabaseClient";
import { fetchWorkoutHistory, fetchStreak, fetchProfile, fetchUnseenFeedbackCount, markFeedbackViewed, fetchAnnouncements, postAnnouncement, deleteAnnouncement, markAnnouncementsViewed, fetchMyNotifications, markNotificationsRead } from "./lib/queries";
import { getPrefs, setPref } from "./lib/prefs";
import { CHANGELOG } from "./lib/changelog";
import { versionsSince } from "./lib/versionCheck";
import { computeMuscleSetCounts, summarizeHistory, summarizeWeightHistory, bucketWeightHistory, bucketDailyVolume, groupWorkoutsByDate } from "./lib/volume";
import { muscleLabel } from "./lib/muscleNomenclature";
import { toDisplay } from "./lib/weight";
import { toLocalDateStr } from "./lib/time";
import BodyHeatmap from "./BodyHeatmap";
import MuscleSetsDetail from "./MuscleSetsDetail";
import Logo from "./Logo";
import { IconBell, IconMenu } from "./Icons";
import Templates from "./Templates";
import FAQ from "./FAQ";
import AdminExercises from "./AdminExercises";
import AdminFeedback from "./AdminFeedback";
import AdminHome from "./AdminHome";
import ExerciseLibraryView from "./ExerciseLibraryView";
import AdminPermissions from "./AdminPermissions";
import DangerZone from "./DangerZone";
import InstallGuide from "./InstallGuide";
import ProfileEditor from "./ProfileEditor";
import MyCustomExercises from "./MyCustomExercises";
import Splits from "./Splits";
import WorkoutHistory from "./WorkoutHistory";
import { useTutorial } from "./TutorialContext";
import Preferences from "./Preferences";
import FeedbackModal from "./FeedbackModal";
import TermsViewer from "./TermsViewer";
import PrivacyPolicy from "./PrivacyPolicy";
import WhatsNew from "./WhatsNew";
import HelpSupport from "./HelpSupport";
import SetupWizard from "./SetupWizard";
import VersionHistory from "./VersionHistory";
import { version as APP_VERSION } from "../package.json";

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

const RANGES = [
  { key: "7d", label: "7 Days", days: 7 },
  { key: "30d", label: "30 Days", days: 30 },
  { key: "90d", label: "90 Days", days: 90 },
  { key: "365d", label: "1 Year", days: 365 },
];

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// Builds the "last workout" summary shown at the top of the dashboard:
// days since, which muscle groups it hit, and a plain-language recovery
// note. This is general training guidance (48-72hr recovery windows are a
// common rule of thumb), not a personalized or medical recommendation.
function buildLastWorkoutInsight(history) {
  if (!history || history.length === 0) {
    return { daysSince: null, muscles: [], tip: "No workouts logged yet — start one to get going." };
  }
  const last = history[history.length - 1];
  const completedDate = new Date(last.completed_at);
  const today = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysSince = Math.floor((today.setHours(0, 0, 0, 0) - new Date(completedDate).setHours(0, 0, 0, 0)) / msPerDay);

  const muscles = [...new Set((last.workout_exercises || []).map((we) => we.exercises?.muscle_group).filter(Boolean))];

  let tip;
  if (daysSince <= 0) tip = "You already trained today. Nice work — recovery starts now.";
  else if (daysSince === 1) tip = `Trained yesterday. Most muscle groups want 48-72 hours before hitting them hard again — a different focus today keeps things moving.`;
  else if (daysSince <= 3) tip = "You're likely recovered from your last session. Good day to train.";
  else tip = `It's been ${daysSince} days. Consistency matters more than any single session — get back in when you can.`;

  return { daysSince, muscles, tip };
}

export default function Home({ user, onStartWorkout, onDataReset }) {
  const [range, setRange] = useState("30d");
  const [history, setHistory] = useState(null); // null = loading
  const [streak, setStreak] = useState(0);
  const [error, setError] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [settingsQuery, setSettingsQuery] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [autoWhatsNewEntries, setAutoWhatsNewEntries] = useState(null);
  const [showHelpSupport, setShowHelpSupport] = useState(false);
  const [showSetupReplay, setShowSetupReplay] = useState(false);
  const [adminSimulateNewUser, setAdminSimulateNewUser] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showAdminFeedback, setShowAdminFeedback] = useState(false);
  const [showAdminHome, setShowAdminHome] = useState(false);
  const [showExerciseLibraryView, setShowExerciseLibraryView] = useState(false);
  const [showAdminPermissions, setShowAdminPermissions] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [historyView, setHistoryView] = useState(null); // null | { initialWorkoutId? }
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [unseenFeedbackCount, setUnseenFeedbackCount] = useState(0);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [announcements, setAnnouncements] = useState(null); // null = not loaded yet
  const [unseenAnnouncements, setUnseenAnnouncements] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [units, setUnitsState] = useState(() => getPrefs().units);
  const [restDefault, setRestDefaultState] = useState(() => getPrefs().restSeconds);
  const [muscleNameMode, setMuscleNameModeState] = useState(() => getPrefs().muscleNameMode);
  const [muscleDetail, setMuscleDetail] = useState(null); // { muscle, role } when the sets drill-down sheet is open
  const [scoreDisplay, setScoreDisplayState] = useState(() => getPrefs().scoreDisplay);
  const [weightEntryMode, setWeightEntryModeState] = useState(() => getPrefs().weightEntryMode);
  const [plate55Scope, setPlate55ScopeState] = useState(() => getPrefs().plate55Scope);
  const [trainingIdeology, setTrainingIdeologyState] = useState(() => getPrefs().trainingIdeology);
  const [timeFormat, setTimeFormatState] = useState(() => getPrefs().timeFormat);
  const [adminViewMode, setAdminViewModeState] = useState(() => getPrefs().adminViewMode);
  function setAdminViewMode(mode) {
    setAdminViewModeState(mode);
    setPref("adminViewMode", mode);
  }
  const tutorial = useTutorial();
  // Settings search: a section stays visible if the query is empty or
  // found in its keyword string. Deliberately simple substring matching —
  // this is a short static page, not a search index.
  function settingsMatch(keywords) {
    const q = settingsQuery.trim().toLowerCase();
    return !q || keywords.toLowerCase().includes(q);
  }
  useEffect(() => { tutorial.startIfUnseen(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Greets the person once per calendar day, on whichever login happens
  // first that day, with everything shipped since their last visit — not
  // just the current version, in case they skipped a few releases.
  useEffect(() => {
    const prefs = getPrefs();
    const today = toLocalDateStr(new Date());
    if (prefs.lastSeenVersion == null) {
      // First time this tracking has run — true for brand-new signups
      // (nothing to catch up on) and for existing users updating from
      // before this feature existed (same thing: nothing to show them
      // right now). Either way, just start tracking from here.
      setPref("lastSeenVersion", APP_VERSION);
      setPref("lastWhatsNewDate", today);
      return;
    }
    if (prefs.lastWhatsNewDate === today) return; // already greeted today
    const entries = versionsSince(CHANGELOG, prefs.lastSeenVersion);
    if (entries.length > 0) {
      setAutoWhatsNewEntries(entries);
    } else {
      setPref("lastWhatsNewDate", today);
    }
  }, []);

  function closeAutoWhatsNew() {
    setAutoWhatsNewEntries(null);
    setPref("lastSeenVersion", APP_VERSION);
    setPref("lastWhatsNewDate", toLocalDateStr(new Date()));
  }

  useEffect(() => {
    if (getPrefs().installPromptSeen || !getPrefs().tutorialSeen) return;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (standalone) { setPref("installPromptSeen", true); return; }
    const t = setTimeout(() => setShowInstallGuide(true), 500);
    return () => clearTimeout(t);
  }, []);

  function setUnits(u) { setUnitsState(u); setPref("units", u); }
  function setRestDefault(s) { setRestDefaultState(s); setPref("restSeconds", s); }
  function setMuscleNameMode(v) { setMuscleNameModeState(v); setPref("muscleNameMode", v); }
  function setScoreDisplay(v) { setScoreDisplayState(v); setPref("scoreDisplay", v); }
  function setWeightEntryMode(v) { setWeightEntryModeState(v); setPref("weightEntryMode", v); }
  function setPlate55Scope(v) { setPlate55ScopeState(v); setPref("plate55Scope", v); }
  function setTrainingIdeology(v) { setTrainingIdeologyState(v); setPref("trainingIdeology", v); }
  function setTimeFormat(v) { setTimeFormatState(v); setPref("timeFormat", v); }
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const [profile, setProfile] = useState(null);
  const isRealAdmin = !!profile?.is_admin;
  // Lets an admin preview the app as a regular user without a second
  // account. Toggled from the Admin menu; persisted so it survives a
  // refresh. The Admin menu entry itself always stays reachable off
  // `isRealAdmin`, never off this, so flipping to "normal" can't lock
  // the admin out of flipping back.
  const effectiveIsAdmin = isRealAdmin && adminViewMode === "admin";
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showMyCustomExercises, setShowMyCustomExercises] = useState(false);
  const [showSplits, setShowSplits] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Always pull "all" history once — the range selector filters it
        // client-side, and the calendar needs the full picture anyway.
        const [h, s, p] = await Promise.all([fetchWorkoutHistory(user.id, null), fetchStreak(user.id), fetchProfile(user.id)]);
        if (cancelled) return;
        setHistory(h);
        setStreak(s);
        if (p) {
          setProfile(p);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [user.id]);

  useEffect(() => {
    if (!profile?.is_admin) return;
    let cancelled = false;
    fetchUnseenFeedbackCount(profile.feedback_last_viewed_at || null)
      .then((n) => { if (!cancelled) setUnseenFeedbackCount(n); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [profile?.is_admin, profile?.feedback_last_viewed_at]);

  // Everyone gets the announcements dot, from two sources merged
  // together: the global broadcast list (compared against when this
  // person last opened the panel) and their own personal notifications
  // (compared by read_at, since those are addressed to them specifically
  // rather than being a one-way broadcast everyone sees the same way).
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchAnnouncements(), fetchMyNotifications(user.id)])
      .then(([rows, notifs]) => {
        if (cancelled) return;
        const lastViewed = profile?.announcements_last_viewed_at;
        const hasUnseenGlobal = rows.length > 0 && (!lastViewed || new Date(rows[0].created_at) > new Date(lastViewed));
        const hasUnreadPersonal = notifs.some((n) => !n.read_at);
        setUnseenAnnouncements(hasUnseenGlobal || hasUnreadPersonal);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [profile?.announcements_last_viewed_at, user.id]);

  function loadAnnouncementsPanel() {
    Promise.all([fetchAnnouncements(), fetchMyNotifications(user.id)])
      .then(([rows, notifs]) => {
        const merged = [
          ...rows.map((r) => ({ ...r, kind: "global" })),
          ...notifs.map((n) => ({ ...n, kind: "personal" })),
        ].sort((a, b) => b.created_at.localeCompare(a.created_at));
        setAnnouncements(merged);
      })
      .catch(() => setAnnouncements([]));
  }

  function openAnnouncements() {
    setShowAnnouncements(true);
    if (announcements === null) loadAnnouncementsPanel();
    setUnseenAnnouncements(false);
    markAnnouncementsViewed(user.id).then(() => setProfile((p) => (p ? { ...p, announcements_last_viewed_at: new Date().toISOString() } : p))).catch(() => {});
    markNotificationsRead(user.id).catch(() => {});
  }

  async function submitAnnouncement() {
    const trimmed = newAnnouncement.trim();
    if (!trimmed) return;
    setPostingAnnouncement(true);
    try {
      await postAnnouncement(user.id, trimmed);
      setNewAnnouncement("");
      loadAnnouncementsPanel();
    } catch (err) {
      setError(err.message);
    }
    setPostingAnnouncement(false);
  }

  async function removeAnnouncement(id) {
    try {
      await deleteAnnouncement(id);
      setAnnouncements((prev) => (prev || []).filter((a) => !(a.kind === "global" && a.id === id)));
    } catch (err) {
      setError(err.message);
    }
  }

  const rangeIdx = RANGES.findIndex((r) => r.key === range);
  const rangeDef = RANGES[rangeIdx];
  function shiftRange(delta) {
    const next = rangeIdx + delta;
    if (next < 0 || next >= RANGES.length) return;
    setRange(RANGES[next].key);
  }
  const filteredHistory = useMemo(() => {
    if (!history) return [];
    if (!rangeDef.days) return history;
    const cutoff = isoDaysAgo(rangeDef.days);
    return history.filter((w) => w.completed_at >= cutoff);
  }, [history, rangeDef]);

  const { entries, dailyVolume: dailyVolumeLb } = useMemo(
    () => summarizeHistory(filteredHistory),
    [filteredHistory]
  );
  const dailyVolume = useMemo(
    () => bucketDailyVolume(dailyVolumeLb.map((d) => ({ ...d, volume: Math.round(toDisplay(d.volume, units)) })), range),
    [dailyVolumeLb, units, range]
  );
  const { primary, secondary, fullBodySets } = useMemo(() => computeMuscleSetCounts(entries), [entries]);
  // Computed directly from the raw workout data for the selected range,
  // not derived from the muscle-group breakdown above — that path silently
  // drops sets from any exercise it can't categorize (e.g. a deleted
  // custom exercise), which would quietly undercount the total.
  const totalSetsInRange = useMemo(
    () => filteredHistory.reduce(
      (total, w) => total + (w.workout_exercises || []).reduce((s, we) => s + (we.sets || []).filter((set) => !set.is_warmup).length, 0),
      0
    ),
    [filteredHistory]
  );
  const weightHistory = useMemo(
    () => bucketWeightHistory(summarizeWeightHistory(filteredHistory), range),
    [filteredHistory, range]
  );

  // The calendar always reflects real training history, independent of
  // whatever range the volume chart above happens to be showing.
  const { byDate: calendarByDate, workoutsByDate } = useMemo(() => groupWorkoutsByDate(history || []), [history]);
  const monthGrid = useMemo(() => buildMonthGrid(calendarMonth, calendarByDate), [calendarMonth, calendarByDate]);
  const maxDayVolume = Math.max(1, ...Object.values(calendarByDate || {}));
  const insight = useMemo(() => buildLastWorkoutInsight(history), [history]);

  function handleDayClick(dateStr) {
    const workouts = workoutsByDate[dateStr];
    if (!workouts || workouts.length === 0) return;
    if (workouts.length === 1) {
      setHistoryView({ initialWorkoutId: workouts[0].id });
    } else {
      // Multiple sessions on the same day — open the same list-style view
      // as "View full history", just scoped to this one date, instead of
      // arbitrarily guessing which of the day's sessions to jump into.
      setHistoryView({ dateFilter: dateStr });
    }
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ color: T.accent, textAlign: "center", maxWidth: 320 }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0A0B0D", display: "flex", justifyContent: "center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&display=swap'); button { cursor: pointer; }`}</style>
      <div style={{ width: "100%", maxWidth: 400, background: T.bg, minHeight: "100vh", display: "flex", flexDirection: "column" }}>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 100px" }}>
          {/* Header — scrolls with the rest of the page */}
          <div style={{ padding: "20px 0 8px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: streak > 0 ? T.accent : T.dim }}>
                {streak}
              </div>
              <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>Streak</div>
            </div>
            <Logo size={64} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={openAnnouncements} data-tutorial="announcements-btn" aria-label="Announcements" style={{ position: "relative", width: 32, height: 32, borderRadius: 999, border: `1px solid ${T.line}`, background: T.surface, color: T.dim, fontSize: 14, flexShrink: 0 }}>
                <IconBell size={15} />
                {unseenAnnouncements && (
                  <span style={{ position: "absolute", top: -3, left: -3, width: 10, height: 10, borderRadius: 999, background: T.accent, border: `2px solid ${T.bg}` }} />
                )}
              </button>
              <button onClick={() => setShowMenu(true)} data-tutorial="settings-btn" aria-label="Settings" style={{ position: "relative", width: 32, height: 32, borderRadius: 999, border: `1px solid ${T.line}`, background: T.surface, color: T.dim, fontSize: 14, flexShrink: 0 }}>
                <IconMenu size={16} />
                {unseenFeedbackCount > 0 && (
                  <span style={{ position: "absolute", top: -3, left: -3, width: 10, height: 10, borderRadius: 999, background: T.accent, border: `2px solid ${T.bg}` }} />
                )}
              </button>
            </div>
          </div>

          {history !== null && (
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, marginTop: 8, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: T.text }}>
                  {insight.daysSince === null ? "—" : `${insight.daysSince} day${insight.daysSince === 1 ? "" : "s"}`}
                </div>
                <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>Since last workout</div>
              </div>
              {insight.muscles.length > 0 && (
                <div style={{ fontSize: 12, color: T.dim, marginBottom: 8 }}>
                  Last session: <span style={{ color: T.text }}>{insight.muscles.map((m) => muscleLabel(m, muscleNameMode)).join(", ")}</span>
                </div>
              )}
              <div style={{ fontSize: 13, color: T.dim, lineHeight: 1.5 }}>{insight.tip}</div>
            </div>
          )}
          {history === null ? (
            <div style={{ color: T.dim, fontSize: 13, padding: "40px 0", textAlign: "center" }}>Loading your history…</div>
          ) : (
            <>
              {/* Shared training range — controls Volume, Weight, and Muscle breakdown below */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px", marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>Training range</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button onClick={() => shiftRange(-1)} disabled={rangeIdx === 0} style={rangeArrowBtn(rangeIdx === 0)} aria-label="Shorter range">‹</button>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, minWidth: 62, textAlign: "center" }}>{rangeDef.label}</div>
                  <button onClick={() => shiftRange(1)} disabled={rangeIdx === RANGES.length - 1} style={rangeArrowBtn(rangeIdx === RANGES.length - 1)} aria-label="Longer range">›</button>
                </div>
              </div>

              {/* Volume over time */}
              <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 8px 8px", marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, padding: "0 8px" }}>
                  Volume over time
                </div>
                {dailyVolume.length === 0 ? (
                  <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>No completed workouts in this range yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={dailyVolume} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke={T.line} strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: T.dim, fontSize: 10 }}
                        tickFormatter={(d) =>
                          range === "365d"
                            ? new Date(`${d}-01T00:00:00`).toLocaleString(undefined, { month: "short" })
                            : d.slice(5)
                        }
                      />
                      <YAxis tick={{ fill: T.dim, fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: T.text }}
                        labelFormatter={(d) =>
                          range === "365d"
                            ? new Date(`${d}-01T00:00:00`).toLocaleString(undefined, { month: "long", year: "numeric" })
                            : range === "30d"
                            ? `Week of ${new Date(`${d}T00:00:00`).toLocaleString(undefined, { month: "short", day: "numeric" })}`
                            : new Date(`${d}T00:00:00`).toLocaleString(undefined, { month: "short", day: "numeric" })
                        }
                        formatter={(v) => [`${v.toLocaleString()} ${units}`, "Volume"]}
                      />
                      <Line type="monotone" dataKey="volume" stroke={T.accent} strokeWidth={2} dot={{ r: 3, fill: T.accent }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Bodyweight over time */}
              <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 8px 8px", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, padding: "0 8px" }}>
                    Bodyweight over time
                  </div>
                  {weightHistory.length === 0 ? (
                    <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>No bodyweight logged in this range. Add it after a workout or in Settings.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={weightHistory} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                        <CartesianGrid stroke={T.line} strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: T.dim, fontSize: 10 }}
                          tickFormatter={(d) =>
                            range === "365d"
                              ? new Date(`${d}-01T00:00:00`).toLocaleString(undefined, { month: "short" })
                              : d.slice(5)
                          }
                        />
                        <YAxis tick={{ fill: T.dim, fontSize: 10 }} domain={["auto", "auto"]} />
                        <Tooltip
                          contentStyle={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 12 }}
                          labelStyle={{ color: T.text }}
                          labelFormatter={(d) =>
                            range === "365d"
                              ? new Date(`${d}-01T00:00:00`).toLocaleString(undefined, { month: "long", year: "numeric" })
                              : range === "30d"
                              ? `Week of ${new Date(`${d}T00:00:00`).toLocaleString(undefined, { month: "short", day: "numeric" })}`
                              : new Date(`${d}T00:00:00`).toLocaleString(undefined, { month: "short", day: "numeric" })
                          }
                          formatter={(v) => [`${v.toLocaleString()} ${units}`, "Bodyweight"]}
                        />
                        <Line type="monotone" dataKey="weight" stroke={T.green} strokeWidth={2} dot={{ r: 3, fill: T.green }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>

              {/* Muscle breakdown */}
              <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>Muscle breakdown</div>
                  <div style={{ fontSize: 11, color: T.dim }}>{totalSetsInRange} set{totalSetsInRange === 1 ? "" : "s"}</div>
                </div>
                {Object.keys(primary).length === 0 && Object.keys(secondary).length === 0 ? (
                  <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "12px 0" }}>Nothing logged in this range yet.</div>
                ) : (
                  <BodyHeatmap primary={primary} secondary={secondary} fullBodySets={fullBodySets} nameMode={muscleNameMode} onSelectMuscle={(muscle, role) => setMuscleDetail({ muscle, role })} />
                )}
              </div>

              {/* Calendar heatmap */}
              <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <button onClick={() => shiftMonth(setCalendarMonth, -1)} style={navBtn}>‹</button>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                    {calendarMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
                  </div>
                  <button onClick={() => shiftMonth(setCalendarMonth, 1)} style={navBtn}>›</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                    <div key={i} style={{ textAlign: "center", fontSize: 10, color: T.dim }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                  {monthGrid.map((cell, i) => {
                    if (!cell) return <div key={i} />;
                    const intensity = cell.volume > 0 ? Math.min(1, cell.volume / maxDayVolume) : 0;
                    const clickable = cell.volume > 0;
                    return (
                      <button
                        key={i}
                        onClick={() => clickable && handleDayClick(cell.date)}
                        disabled={!clickable}
                        title={cell.volume > 0 ? `${Math.round(toDisplay(cell.volume, units)).toLocaleString()} ${units} — tap for details` : undefined}
                        style={{
                          aspectRatio: "1", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, color: intensity > 0.4 ? "#fff" : T.dim,
                          background: intensity > 0 ? T.accent : T.surface2,
                          opacity: intensity > 0 ? 0.35 + intensity * 0.65 : 1,
                          border: cell.isToday ? `1px solid ${T.text}` : "none",
                          padding: 0, cursor: clickable ? "pointer" : "default",
                        }}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setHistoryView({})}
                  style={{ width: "100%", marginTop: 12, padding: "10px 0", borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  View full history <span style={{ color: T.dim }}>›</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Start workout */}
        <div style={{ position: "sticky", bottom: 0, borderTop: `1px solid ${T.line}`, background: T.surface, padding: 16 }}>
          <button onClick={onStartWorkout} data-tutorial="start-workout" style={{ width: "100%", padding: "16px 0", borderRadius: 14, border: "none", background: T.accent, color: "#fff", fontSize: 17, fontWeight: 700, letterSpacing: 0.3 }}>
            Start Workout
          </button>
        </div>
      </div>

      {showMenu && (
        <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 20, display: "flex", justifyContent: "center", overflowY: "auto" }}>
          <div style={{ width: "100%", maxWidth: 400, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}>
              <button onClick={() => { setShowMenu(false); setSettingsQuery(""); }} aria-label="Close" style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 13 }}>‹</button>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: T.text, textAlign: "center" }}>SETTINGS</div>
              <div style={{ width: 26 }} />
            </div>

            <div style={{ padding: "12px 16px 0" }}>
              <input
                value={settingsQuery}
                onChange={(e) => setSettingsQuery(e.target.value)}
                placeholder="Search settings"
                aria-label="Search settings"
                style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, color: T.text, fontSize: 14, padding: "10px 12px", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ padding: 16, flex: 1 }}>
              {/* Templates */}
              {settingsMatch("templates workouts reusable build manage") && (
              <>
              <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Workouts</div>
              <button
                onClick={() => setShowTemplates(true)}
                data-tutorial="templates-row"
                style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}
              >
                <div>
                  <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>Templates</div>
                  <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>Build or manage reusable workouts</div>
                </div>
                <div style={{ color: T.dim, fontSize: 16 }}>›</div>
              </button>
              </>
              )}

              {settingsMatch("exercise library browse muscle scientific detailed generic nicknames equipment pattern") && (
              <button
                onClick={() => setShowExerciseLibraryView(true)}
                style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}
              >
                <div>
                  <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>Exercise Library</div>
                  <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>Browse every exercise and its full details</div>
                </div>
                <div style={{ color: T.dim, fontSize: 16 }}>›</div>
              </button>
              )}

              {settingsMatch("custom exercises edit delete") && (
              <button
                onClick={() => setShowMyCustomExercises(true)}
                style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}
              >
                <div>
                  <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>My Custom Exercises</div>
                  <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>Edit or delete exercises you've added</div>
                </div>
                <div style={{ color: T.dim, fontSize: 16 }}>›</div>
              </button>
              )}

              {/* Profile */}
              {settingsMatch("profile gender age date of birth weight height") && (
              <>
              <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Profile</div>
              <button
                onClick={() => setShowProfileEditor(true)}
                style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}
              >
                <div>
                  <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>Gender, age, weight, height</div>
                  <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>Used for strength scoring and insights</div>
                </div>
                <div style={{ color: T.dim, fontSize: 16 }}>›</div>
              </button>
              </>
              )}

              {/* Preferences */}
              {settingsMatch("preferences units weight lb kg pounds kilograms time format 12h 24h clock muscle names generic detailed scientific training focus rep range hypertrophy strength endurance dots percentile deltalog default set entry manual plate calculator logging type big plates bumpers squats deadlifts rest timer seconds") && (
              <>
              <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Preferences</div>
              <div style={{ marginBottom: 8 }}>
                <Preferences
                  value={{ units, muscleNameMode, scoreDisplay, weightEntryMode, restSeconds: restDefault, plate55Scope, trainingIdeology, timeFormat }}
                  filterQuery={settingsQuery}
                  onChange={(key, val) => {
                    if (key === "units") setUnits(val);
                    else if (key === "muscleNameMode") setMuscleNameMode(val);
                    else if (key === "scoreDisplay") setScoreDisplay(val);
                    else if (key === "weightEntryMode") setWeightEntryMode(val);
                    else if (key === "restSeconds") setRestDefault(val);
                    else if (key === "plate55Scope") setPlate55Scope(val);
                    else if (key === "trainingIdeology") setTrainingIdeology(val);
                    else if (key === "timeFormat") setTimeFormat(val);
                  }}
                />
              </div>
              </>
              )}

              {/* Tutorials & Support */}
              {settingsMatch("tutorials guides support walkthroughs faq community feedback replay splits push pull legs") && (
              <>
              <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Tutorials & Support</div>
              <button
                onClick={() => setShowHelpSupport(true)}
                style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}
              >
                <div>
                  <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>Tutorials, Guides & Support</div>
                  <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>Walkthroughs, FAQ, community, and feedback</div>
                </div>
                <div style={{ color: T.dim, fontSize: 16 }}>›</div>
              </button>
              </>
              )}

              {/* Admin */}
              {isRealAdmin && settingsMatch("admin custom exercises feedback bugs simulate new user version history changelog exercise library muscle groups permissions admin view normal") && (
                <>
                  <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Admin</div>
                  <button
                    onClick={() => setShowAdminHome(true)}
                    style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}
                  >
                    <div>
                      <div style={{ color: T.text, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                        Admin
                        {unseenFeedbackCount > 0 && (
                          <span style={{ background: T.accent, color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "1px 7px", lineHeight: 1.5 }}>{unseenFeedbackCount}</span>
                        )}
                      </div>
                      <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>Custom exercises, feedback, version history, and testing tools</div>
                    </div>
                    <div style={{ color: T.dim, fontSize: 16 }}>›</div>
                  </button>
                </>
              )}

              {/* Account — kept at the bottom, away from the everyday controls */}
              {settingsMatch("account email sign out logout") && (
              <>
              <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Account</div>
              <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 20 }}>
                <div style={{ color: T.text, fontSize: 14, marginBottom: 4 }}>{user.email}</div>
                {user.app_metadata?.provider && user.app_metadata.provider !== "email" && (
                  <div style={{ color: T.dim, fontSize: 11, marginBottom: 12 }}>
                    Signed in with {user.app_metadata.provider.charAt(0).toUpperCase() + user.app_metadata.provider.slice(1)}
                  </div>
                )}
                {(!user.app_metadata?.provider || user.app_metadata.provider === "email") && (
                  <div style={{ height: 8 }} />
                )}
                <button onClick={() => supabase.auth.signOut()} style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: `1px solid ${T.accent}`, background: "rgba(232,68,46,0.1)", color: T.accent, fontSize: 14, fontWeight: 700 }}>
                  Sign out
                </button>
              </div>
              </>
              )}

              {/* Danger zone */}
              {settingsMatch("danger zone reset delete all data account") && (
              <>
              <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Danger zone</div>
              <button
                onClick={() => setShowDangerZone(true)}
                style={{ width: "100%", background: T.surface, border: `1px solid ${T.accent}`, borderRadius: 12, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}
              >
                <div>
                  <div style={{ color: T.accent, fontSize: 14, fontWeight: 600 }}>Danger Zone</div>
                  <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>Reset all data or delete your account</div>
                </div>
                <div style={{ color: T.accent, fontSize: 16 }}>›</div>
              </button>
              </>
              )}

              <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 16 }}>
                <button
                  onClick={() => setShowTerms(true)}
                  style={{ background: "none", border: "none", color: T.dim, fontSize: 12.5, textDecoration: "underline", padding: 0 }}
                >
                  Terms & Conditions
                </button>
                <button
                  onClick={() => setShowPrivacy(true)}
                  style={{ background: "none", border: "none", color: T.dim, fontSize: 12.5, textDecoration: "underline", padding: 0 }}
                >
                  Privacy Policy
                </button>
              </div>

              <button
                onClick={() => setShowWhatsNew(true)}
                style={{ display: "block", width: "100%", textAlign: "center", background: "none", border: "none", color: T.dim, fontSize: 11, marginTop: 12, opacity: 0.6, padding: 0 }}
              >
                v{APP_VERSION} · What's new
              </button>
            </div>
          </div>
        </div>
      )}

      {showTemplates && <Templates user={user} onClose={() => setShowTemplates(false)} />}
      {showTerms && <TermsViewer onClose={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacyPolicy user={user} onClose={() => setShowPrivacy(false)} />}
      {showWhatsNew && <WhatsNew onClose={() => setShowWhatsNew(false)} />}
      {autoWhatsNewEntries && <WhatsNew entries={autoWhatsNewEntries} onClose={closeAutoWhatsNew} />}
      {showHelpSupport && (
        <HelpSupport
          onClose={() => setShowHelpSupport(false)}
          onOpenFAQ={() => setShowFAQ(true)}
          onOpenInstallGuide={() => setShowInstallGuide(true)}
          onOpenSplits={() => setShowSplits(true)}
          onOpenFeedback={() => setShowFeedback(true)}
          onReplaySetup={() => setShowSetupReplay(true)}
          onReplayTutorial={() => { setShowHelpSupport(false); setShowMenu(false); tutorial.start(); }}
        />
      )}
      {showSetupReplay && (
        <SetupWizard
          onComplete={() => {
            setShowSetupReplay(false);
            if (adminSimulateNewUser) { setAdminSimulateNewUser(false); tutorial.start(); }
          }}
        />
      )}
      {showVersionHistory && <VersionHistory onClose={() => setShowVersionHistory(false)} />}
      {showFAQ && <FAQ onClose={() => setShowFAQ(false)} />}
      {showAdminHome && (
        <AdminHome
          onClose={() => setShowAdminHome(false)}
          unseenFeedbackCount={unseenFeedbackCount}
          onOpenExercises={() => setShowAdmin(true)}
          onOpenFeedback={() => { setShowAdminFeedback(true); markFeedbackViewed(user.id).then(() => setUnseenFeedbackCount(0)).catch(() => {}); }}
          onOpenPermissions={() => setShowAdminPermissions(true)}
          onSimulateNewUser={() => { setShowAdminHome(false); setShowMenu(false); setAdminSimulateNewUser(true); setShowSetupReplay(true); }}
          onOpenVersionHistory={() => setShowVersionHistory(true)}
          adminViewMode={adminViewMode}
          onSetAdminViewMode={setAdminViewMode}
        />
      )}
      {showAdmin && <AdminExercises user={user} onClose={() => setShowAdmin(false)} />}
      {showExerciseLibraryView && <ExerciseLibraryView muscleNameMode={muscleNameMode} isAdmin={effectiveIsAdmin} userId={user.id} onClose={() => setShowExerciseLibraryView(false)} />}
      {muscleDetail && (
        <MuscleSetsDetail
          muscle={muscleDetail.muscle}
          role={muscleDetail.role}
          entries={entries}
          nameMode={muscleNameMode}
          units={units}
          onClose={() => setMuscleDetail(null)}
        />
      )}
      {showAdminPermissions && <AdminPermissions currentUserId={user.id} onClose={() => setShowAdminPermissions(false)} />}
      {showAdminFeedback && <AdminFeedback onClose={() => setShowAdminFeedback(false)} />}
      {showDangerZone && <DangerZone user={user} onClose={() => setShowDangerZone(false)} onDataReset={onDataReset} />}
      {showInstallGuide && (
        <InstallGuide
          onClose={() => {
            setShowInstallGuide(false);
            setPref("installPromptSeen", true);
          }}
        />
      )}
      {showProfileEditor && (
        <ProfileEditor
          profile={profile}
          units={units}
          userId={user.id}
          onClose={() => setShowProfileEditor(false)}
          onSaved={setProfile}
        />
      )}
      {showMyCustomExercises && <MyCustomExercises user={user} onClose={() => setShowMyCustomExercises(false)} />}
      {showSplits && <Splits onClose={() => setShowSplits(false)} />}
      {showFeedback && <FeedbackModal user={user} context="settings" onClose={() => setShowFeedback(false)} />}
      {showAnnouncements && (
        <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 25, display: "flex", justifyContent: "center", overflowY: "auto" }}>
          <div style={{ width: "100%", maxWidth: 400, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}>
              <button onClick={() => setShowAnnouncements(false)} aria-label="Close" style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 13 }}>‹</button>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: T.text, textAlign: "center" }}>ANNOUNCEMENTS</div>
              <div style={{ width: 26 }} />
            </div>
            <div style={{ padding: 16, flex: 1 }}>
              {effectiveIsAdmin && (
                <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Post an announcement</div>
                  <textarea
                    value={newAnnouncement}
                    onChange={(e) => setNewAnnouncement(e.target.value)}
                    placeholder="What's new…"
                    rows={3}
                    style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "8px 10px", outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", marginBottom: 8 }}
                  />
                  <button onClick={submitAnnouncement} disabled={postingAnnouncement || !newAnnouncement.trim()} style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: T.accent, color: "#fff", fontSize: 13, fontWeight: 700, opacity: postingAnnouncement || !newAnnouncement.trim() ? 0.6 : 1 }}>
                    {postingAnnouncement ? "Posting…" : "Post to all users"}
                  </button>
                </div>
              )}
              {announcements === null && <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>Loading…</div>}
              {announcements !== null && announcements.length === 0 && (
                <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 20px", border: `1px dashed ${T.line}`, borderRadius: 12 }}>Nothing posted yet.</div>
              )}
              {announcements?.map((a) => (
                <div key={`${a.kind}-${a.id}`} style={{ background: T.surface, border: `1px solid ${a.kind === "personal" ? T.accent : T.line}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
                  {a.kind === "personal" && <div style={{ fontSize: 10, color: T.accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Just for you</div>}
                  <div style={{ color: T.text, fontSize: 14, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>{a.message}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: T.dim }}>{new Date(a.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</div>
                    {effectiveIsAdmin && a.kind === "global" && (
                      <button onClick={() => removeAnnouncement(a.id)} style={{ background: "none", border: "none", color: T.dim, fontSize: 11, textDecoration: "underline", padding: 0 }}>Delete</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {historyView && (
        <WorkoutHistory
          history={history || []}
          initialWorkoutId={historyView.initialWorkoutId}
          dateFilter={historyView.dateFilter}
          units={units}
          timeFormat={timeFormat}
          user={user}
          onClose={() => setHistoryView(null)}
          onDeleted={(id) => setHistory((prev) => (prev || []).filter((w) => w.id !== id))}
          onSetUpdated={(workoutId, weId, setNumber, patch) =>
            setHistory((prev) => (prev || []).map((w) => (
              w.id !== workoutId ? w : {
                ...w,
                workout_exercises: (w.workout_exercises || []).map((we) => (
                  we.id !== weId ? we : { ...we, sets: (we.sets || []).map((s) => (s.set_number !== setNumber ? s : { ...s, ...patch })) }
                )),
              }
            )))
          }
          onSetAdded={(workoutId, weId, newSet) =>
            setHistory((prev) => (prev || []).map((w) => (
              w.id !== workoutId ? w : {
                ...w,
                workout_exercises: (w.workout_exercises || []).map((we) => (
                  we.id !== weId ? we : { ...we, sets: [...(we.sets || []), newSet] }
                )),
              }
            )))
          }
          onSetRemoved={(workoutId, weId, setNumber) =>
            setHistory((prev) => (prev || []).map((w) => (
              w.id !== workoutId ? w : {
                ...w,
                workout_exercises: (w.workout_exercises || []).map((we) => (
                  we.id !== weId ? we : {
                    ...we,
                    sets: (we.sets || [])
                      .filter((s) => s.set_number !== setNumber)
                      .map((s) => (s.set_number > setNumber ? { ...s, set_number: s.set_number - 1 } : s)),
                  }
                )),
              }
            )))
          }
          onExerciseAdded={(workoutId, newWe) =>
            setHistory((prev) => (prev || []).map((w) => (
              w.id !== workoutId ? w : { ...w, workout_exercises: [...(w.workout_exercises || []), newWe] }
            )))
          }
          onExerciseRemoved={(workoutId, weId) =>
            setHistory((prev) => (prev || []).map((w) => (
              w.id !== workoutId ? w : { ...w, workout_exercises: (w.workout_exercises || []).filter((we) => we.id !== weId) }
            )))
          }
        />
      )}
    </div>
  );
}

const navBtn = { width: 28, height: 28, borderRadius: 999, border: `1px solid ${T.line}`, background: T.surface2, color: T.dim, fontSize: 14 };
const rangeArrowBtn = (disabled) => ({ width: 22, height: 22, borderRadius: 999, border: `1px solid ${T.line}`, background: T.surface2, color: disabled ? "#3A404B" : T.dim, fontSize: 12, cursor: disabled ? "default" : "pointer" });

function shiftMonth(setCalendarMonth, delta) {
  setCalendarMonth((prev) => {
    const next = new Date(prev);
    next.setMonth(next.getMonth() + delta);
    return next;
  });
}

// Builds a 7-wide grid (nulls for leading blanks) of { day, volume, isToday }
// for the given month, keyed against the byDate volume map.
function buildMonthGrid(monthDate, byDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = toLocalDateStr(new Date());

  const cells = Array(firstDay).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ day, date: dateStr, volume: byDate[dateStr] || 0, isToday: dateStr === todayStr });
  }
  return cells;
}
