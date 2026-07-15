import { useState, useEffect, useMemo } from "react";
import { supabase } from "./lib/supabaseClient";
import { fetchWorkoutHistory, fetchStreak, fetchProfile, saveProfile, fetchUnseenFeedbackCount, markFeedbackViewed, fetchAnnouncements, postAnnouncement, updateAnnouncement, setAnnouncementArchived, deleteAnnouncement, markAnnouncementsViewed, fetchMyNotifications, markNotificationsRead, dismissNotification, fetchDismissedAnnouncementIds, dismissAnnouncementForUser, fetchPollVotes, castPollVote } from "./lib/queries";
import { getPrefs, setPref, getHomeModules, setHomeModules, getChartRange, setChartRange } from "./lib/prefs";
import { RANGES } from "./lib/ranges";
import { CHANGELOG } from "./lib/changelog";
import { versionsSince } from "./lib/versionCheck";
import { computeMuscleSetCounts, summarizeHistory, summarizeWeightHistory, summarizeWorkoutDuration, bucketWeightHistory, bucketDailyVolume, bucketSeries, groupWorkoutsByDate } from "./lib/volume";
import { muscleLabel, subscribeTaxonomy, getTaxonomyVersion } from "./lib/muscleNomenclature";
import { toDisplay } from "./lib/weight";
import { InlineLoading } from "./LoadingSpinner";
import { toLocalDateStr } from "./lib/time";
import BodyHeatmap from "./BodyHeatmap";
import MuscleSetsDetail from "./MuscleSetsDetail";
import HomeChartCard, { RangeSwitcher } from "./HomeChartCard";
import WeeklySetGoals, { WeeklySetGoalsEditor } from "./WeeklySetGoals";
import ProgramView from "./ProgramView";
import HomeModulesEditor from "./HomeModulesEditor";
import Logo from "./Logo";
import { IconBell, IconMenu, IconPlus, IconArchive, IconPencil, IconX } from "./Icons";
import Templates from "./Templates";
import FAQ from "./FAQ";
import AdminExercises from "./AdminExercises";
import AdminFeedback from "./AdminFeedback";
import AdminHome from "./AdminHome";
import SplitsManager from "./SplitsManager";
import ExerciseLibraryView from "./ExerciseLibraryView";
import AdminRoles from "./AdminRoles";
import AdminUserActivity from "./AdminUserActivity";
import AdminReferralSources from "./AdminReferralSources";
import DangerZone from "./DangerZone";
import InstallGuide from "./InstallGuide";
import ProfileEditor from "./ProfileEditor";
import WorkoutHistory from "./WorkoutHistory";
import Preferences from "./Preferences";
import FeedbackModal from "./FeedbackModal";
import TermsViewer from "./TermsViewer";
import PrivacyPolicy from "./PrivacyPolicy";
import WhatsNew from "./WhatsNew";
import WhatsNext from "./WhatsNext";
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

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// Renders one announcement's poll: a question plus tappable options, each
// showing a live percentage bar and vote count. `votes` is the raw list of
// { user_id, option_id } rows for this announcement. Voting is disabled
// once the announcement is archived, since archived posts are read-only
// history rather than an active poll.
function AnnouncementPoll({ poll, votes, userId, disabled, onVote }) {
  const counts = {};
  for (const opt of poll.options) counts[opt.id] = 0;
  for (const v of votes || []) counts[v.option_id] = (counts[v.option_id] || 0) + 1;
  const total = (votes || []).length;
  const myVote = (votes || []).find((v) => v.user_id === userId)?.option_id || null;

  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{poll.question}</div>
      {poll.options.map((opt) => {
        const count = counts[opt.id] || 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const mine = myVote === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => !disabled && onVote(opt.id)}
            disabled={disabled}
            style={{ position: "relative", textAlign: "left", padding: "8px 10px", borderRadius: 8, border: `1px solid ${mine ? T.accent : T.line}`, background: T.surface2, color: T.text, fontSize: 12, overflow: "hidden", cursor: disabled ? "default" : "pointer" }}
          >
            <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: "rgba(255,255,255,0.08)" }} />
            <div style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span>{opt.label}{mine ? " · your vote" : ""}</span>
              <span style={{ color: T.dim, flexShrink: 0 }}>{pct}% ({count})</span>
            </div>
          </button>
        );
      })}
      <div style={{ fontSize: 10, color: T.dim }}>{total} vote{total === 1 ? "" : "s"}</div>
    </div>
  );
}

// Builds the "last workout" summary shown at the top of the dashboard:
// days since, which muscle groups it hit, and a plain-language recovery
// note. This is general training guidance (48-72hr recovery windows are a
// common rule of thumb), not a personalized or medical recommendation.
function buildLastWorkoutInsight(history) {
  if (!history || history.length === 0) {
    return { daysSince: null, muscles: [], tip: "No workouts logged yet — start one to get going.", status: "none" };
  }
  const last = history[history.length - 1];
  const completedDate = new Date(last.completed_at);
  const today = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysSince = Math.floor((today.setHours(0, 0, 0, 0) - new Date(completedDate).setHours(0, 0, 0, 0)) / msPerDay);

  const muscles = [...new Set((last.workout_exercises || []).map((we) => we.exercises?.muscle_group).filter(Boolean))];

  let tip, status;
  if (daysSince <= 0) { tip = "You already trained today. Nice work — recovery starts now."; status = "today"; }
  else if (daysSince === 1) { tip = `Trained yesterday. Most muscle groups want 48-72 hours before hitting them hard again — a different focus today keeps things moving.`; status = "recovering"; }
  else if (daysSince <= 3) { tip = "You're likely recovered from your last session. Good day to train."; status = "ready"; }
  else { tip = `It's been ${daysSince} days. Consistency matters more than any single session — get back in when you can.`; status = "overdue"; }

  return { daysSince, muscles, tip, status };
}

export default function Home({ user, onStartWorkout, onResumeWorkout, activeWorkout, onDataReset, onProgramWorkoutStarted }) {
  // Each chart that has a Training Range keeps its own independent
  // selection (e.g. Bodyweight pinned to 90 Days while Volume stays at
  // 30 Days) instead of one range controlling all of them -- see
  // getChartRange/setChartRange in lib/prefs.js.
  function useModuleRange(chartId) {
    const [rangeKey, setRangeKeyState] = useState(() => getChartRange(chartId));
    function setRangeKey(key) {
      setRangeKeyState(key);
      setChartRange(chartId, key);
    }
    return [rangeKey, setRangeKey];
  }
  const [volumeRange, setVolumeRange] = useModuleRange("volume");
  const [weightRange, setWeightRange] = useModuleRange("weight");
  const [workoutTimeRange, setWorkoutTimeRange] = useModuleRange("workoutTime");
  const [muscleRange, setMuscleRange] = useModuleRange("muscleBreakdown");
  // Reorderable/toggleable home dashboard modules (pencil icon, top left).
  const [homeModules, setHomeModulesState] = useState(() => getHomeModules());
  const [showHomeModulesEditor, setShowHomeModulesEditor] = useState(false);
  function updateHomeModules(next) {
    setHomeModulesState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      setHomeModules(resolved);
      return resolved;
    });
  }
  // The date a person tapped on the Volume/Weight/Workout Time charts —
  // shared across all three so selecting one date highlights it
  // everywhere at once, and surfaced together in the Selected Day
  // summary card below the range row. Cleared (back to the normal
  // aggregate charts) on any scroll or on a tap outside a chart, rather
  // than sitting there indefinitely.
  const [lockedTs, setLockedTs] = useState(null);
  function handleHomeScroll() {
    setLockedTs(null);
  }
  // Ticks once a second while a workout is active so the Resume Workout
  // button's elapsed-time readout visibly moves, rather than showing a
  // number frozen at whatever it was when Home last mounted -- the
  // whole point is to be a nagging reminder that time is passing.
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    if (!activeWorkout?.started_at) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeWorkout?.started_at]);
  const activeWorkoutElapsed = (() => {
    if (!activeWorkout?.started_at) return "";
    const totalSec = Math.max(0, Math.floor((nowTick - new Date(activeWorkout.started_at).getTime()) / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  })();
  const [history, setHistory] = useState(null); // null = loading
  const [streak, setStreak] = useState(0);
  const [error, setError] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [settingsQuery, setSettingsQuery] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showProgramView, setShowProgramView] = useState(false);
  const [showWeeklySetGoals, setShowWeeklySetGoals] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showWhatsNext, setShowWhatsNext] = useState(false);
  const [autoWhatsNewEntries, setAutoWhatsNewEntries] = useState(null);
  const [showHelpSupport, setShowHelpSupport] = useState(false);
  const [showSetupReplay, setShowSetupReplay] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showAdminFeedback, setShowAdminFeedback] = useState(false);
  const [showAdminHome, setShowAdminHome] = useState(false);
  const [showExerciseLibraryView, setShowExerciseLibraryView] = useState(false);
  const [showAdminRoles, setShowAdminRoles] = useState(false);
  const [showAdminUserActivity, setShowAdminUserActivity] = useState(false);
  const [showAdminReferralSources, setShowAdminReferralSources] = useState(false);
  const [showSplitsManager, setShowSplitsManager] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [historyView, setHistoryView] = useState(null); // null | { initialWorkoutId? }
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [unseenFeedbackCount, setUnseenFeedbackCount] = useState(0);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [announcements, setAnnouncements] = useState(null); // null = not loaded yet
  const [unseenAnnouncements, setUnseenAnnouncements] = useState(false);
  const [pollVotes, setPollVotes] = useState({}); // announcementId -> [{ user_id, option_id }]
  const [composeAnnouncement, setComposeAnnouncement] = useState(null); // null | { id, message, poll: null | { question, options: string[] } }
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [showArchivedAnnouncements, setShowArchivedAnnouncements] = useState(false);
  const [archivedAnnouncements, setArchivedAnnouncements] = useState(null); // null = not loaded yet
  const [units, setUnitsState] = useState(() => getPrefs().units);
  const [restDefault, setRestDefaultState] = useState(() => getPrefs().restSeconds);
  const [warmupRestDefault, setWarmupRestDefaultState] = useState(() => getPrefs().warmupRestSeconds);
  const [warmupRestEnabled, setWarmupRestEnabledState] = useState(() => getPrefs().warmupRestEnabled);
  const [restTimerSoundEnabled, setRestTimerSoundEnabledState] = useState(() => getPrefs().restTimerSoundEnabled);
  const [restTimerSound, setRestTimerSoundState] = useState(() => getPrefs().restTimerSound);
  const [restTimerVibrationEnabled, setRestTimerVibrationEnabledState] = useState(() => getPrefs().restTimerVibrationEnabled);
  const [restTimerVibration, setRestTimerVibrationState] = useState(() => getPrefs().restTimerVibration);
  const [restTimerNotificationEnabled, setRestTimerNotificationEnabledState] = useState(() => getPrefs().restTimerNotificationEnabled);
  const [muscleNameMode, setMuscleNameModeState] = useState(() => getPrefs().muscleNameMode);
  // The taxonomy fetch (App.jsx) and the session/profile chain that
  // gates Home mounting both start at boot with no ordering guarantee.
  // If Home computes the muscle breakdown before taxonomy finishes
  // loading, this forces a recompute once it does, instead of being
  // stuck showing labels derived from the small hardcoded fallback.
  const [taxonomyVersion, setTaxonomyVersion] = useState(getTaxonomyVersion);
  useEffect(() => subscribeTaxonomy(() => setTaxonomyVersion(getTaxonomyVersion())), []);
  const [muscleDetail, setMuscleDetail] = useState(null); // { muscle } when the sets drill-down sheet is open
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
  // Settings search: a section stays visible if the query is empty or
  // found in its keyword string. Deliberately simple substring matching —
  // this is a short static page, not a search index.
  function settingsMatch(keywords) {
    const q = settingsQuery.trim().toLowerCase();
    return !q || keywords.toLowerCase().includes(q);
  }

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
    if (getPrefs().installPromptSeen || !getPrefs().setupWizardSeen) return;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (standalone) { setPref("installPromptSeen", true); return; }
    const t = setTimeout(() => setShowInstallGuide(true), 500);
    return () => clearTimeout(t);
  }, []);

  function setUnits(u) { setUnitsState(u); setPref("units", u); }
  function setRestDefault(s) { setRestDefaultState(s); setPref("restSeconds", s); }
  function setWarmupRestDefault(s) { setWarmupRestDefaultState(s); setPref("warmupRestSeconds", s); }
  function setWarmupRestEnabled(v) { setWarmupRestEnabledState(v); setPref("warmupRestEnabled", v); }
  function setRestTimerSoundEnabled(v) { setRestTimerSoundEnabledState(v); setPref("restTimerSoundEnabled", v); }
  function setRestTimerSound(v) { setRestTimerSoundState(v); setPref("restTimerSound", v); }
  function setRestTimerVibrationEnabled(v) { setRestTimerVibrationEnabledState(v); setPref("restTimerVibrationEnabled", v); }
  function setRestTimerVibration(v) { setRestTimerVibrationState(v); setPref("restTimerVibration", v); }
  function setRestTimerNotificationEnabled(v) { setRestTimerNotificationEnabledState(v); setPref("restTimerNotificationEnabled", v); }
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
  const isRealCreator = !!profile?.is_creator;
  // Lets an admin preview the app as a regular user without a second
  // account. Toggled from the Admin menu; persisted so it survives a
  // refresh. The Admin menu entry itself always stays reachable off
  // `isRealAdmin`, never off this, so flipping to "normal" can't lock
  // the admin out of flipping back.
  const effectiveIsAdmin = isRealAdmin && adminViewMode === "admin";
  const [showProfileEditor, setShowProfileEditor] = useState(false);

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
    Promise.all([fetchAnnouncements(), fetchMyNotifications(user.id), fetchDismissedAnnouncementIds(user.id)])
      .then(([rows, notifs, dismissedIds]) => {
        if (cancelled) return;
        const dismissed = new Set(dismissedIds);
        const visibleRows = rows.filter((r) => !dismissed.has(r.id));
        const lastViewed = profile?.announcements_last_viewed_at;
        const hasUnseenGlobal = visibleRows.length > 0 && (!lastViewed || new Date(visibleRows[0].created_at) > new Date(lastViewed));
        const hasUnreadPersonal = notifs.some((n) => !n.read_at);
        setUnseenAnnouncements(hasUnseenGlobal || hasUnreadPersonal);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [profile?.announcements_last_viewed_at, user.id]);

  function loadAnnouncementsPanel() {
    Promise.all([fetchAnnouncements(), fetchMyNotifications(user.id), fetchDismissedAnnouncementIds(user.id)])
      .then(([rows, notifs, dismissedIds]) => {
        const dismissed = new Set(dismissedIds);
        const merged = [
          ...rows.filter((r) => !dismissed.has(r.id)).map((r) => ({ ...r, kind: "global" })),
          ...notifs.map((n) => ({ ...n, kind: "personal" })),
        ].sort((a, b) => b.created_at.localeCompare(a.created_at));
        setAnnouncements(merged);
        loadPollVotes(rows.filter((r) => r.poll).map((r) => r.id));
      })
      .catch(() => setAnnouncements([]));
  }

  function loadArchivedAnnouncements() {
    setArchivedAnnouncements(null);
    fetchAnnouncements({ includeArchived: true })
      .then((rows) => {
        const archived = rows.filter((r) => r.archived);
        setArchivedAnnouncements(archived);
        loadPollVotes(archived.filter((r) => r.poll).map((r) => r.id));
      })
      .catch(() => setArchivedAnnouncements([]));
  }

  function loadPollVotes(ids) {
    if (ids.length === 0) return;
    fetchPollVotes(ids)
      .then((votes) => {
        setPollVotes((prev) => {
          const next = { ...prev };
          for (const id of ids) next[id] = votes.filter((v) => v.announcement_id === id);
          return next;
        });
      })
      .catch(() => {});
  }

  function openAnnouncements() {
    setShowAnnouncements(true);
    if (announcements === null) loadAnnouncementsPanel();
    setUnseenAnnouncements(false);
    markAnnouncementsViewed(user.id).then(() => setProfile((p) => (p ? { ...p, announcements_last_viewed_at: new Date().toISOString() } : p))).catch(() => {});
    markNotificationsRead(user.id).catch(() => {});
  }

  function toggleArchivedAnnouncementsView() {
    const next = !showArchivedAnnouncements;
    setShowArchivedAnnouncements(next);
    if (next && archivedAnnouncements === null) loadArchivedAnnouncements();
  }

  // Opens the compose sheet. Pass an existing announcement to edit it in
  // place, or nothing to start a fresh post.
  function openComposeAnnouncement(existing = null) {
    setComposeAnnouncement({
      id: existing?.id || null,
      message: existing?.message || "",
      poll: existing?.poll ? { question: existing.poll.question, options: existing.poll.options.map((o) => o.label) } : null,
    });
  }

  function closeComposeAnnouncement() {
    setComposeAnnouncement(null);
  }

  function addPollToCompose() {
    setComposeAnnouncement((c) => (c ? { ...c, poll: { question: "", options: ["", ""] } } : c));
  }

  function removePollFromCompose() {
    setComposeAnnouncement((c) => (c ? { ...c, poll: null } : c));
  }

  function updateComposePollQuestion(question) {
    setComposeAnnouncement((c) => (c ? { ...c, poll: { ...c.poll, question } } : c));
  }

  function updateComposePollOption(idx, label) {
    setComposeAnnouncement((c) => {
      if (!c) return c;
      const options = [...c.poll.options];
      options[idx] = label;
      return { ...c, poll: { ...c.poll, options } };
    });
  }

  function addComposePollOption() {
    setComposeAnnouncement((c) => (c ? { ...c, poll: { ...c.poll, options: [...c.poll.options, ""] } } : c));
  }

  function removeComposePollOption(idx) {
    setComposeAnnouncement((c) => (c ? { ...c, poll: { ...c.poll, options: c.poll.options.filter((_, i) => i !== idx) } } : c));
  }

  async function submitComposeAnnouncement() {
    if (!composeAnnouncement) return;
    const message = composeAnnouncement.message.trim();
    if (!message) return;

    let poll = null;
    if (composeAnnouncement.poll) {
      const question = composeAnnouncement.poll.question.trim();
      const options = composeAnnouncement.poll.options.map((o) => o.trim()).filter(Boolean);
      if (!question || options.length < 2) return; // guarded against in the UI too
      poll = { question, options: options.map((label, i) => ({ id: String(i + 1), label })) };
    }

    setSavingAnnouncement(true);
    try {
      if (composeAnnouncement.id) {
        await updateAnnouncement(composeAnnouncement.id, { message, poll });
      } else {
        await postAnnouncement(user.id, message, poll);
      }
      closeComposeAnnouncement();
      loadAnnouncementsPanel();
      if (showArchivedAnnouncements) loadArchivedAnnouncements();
    } catch (err) {
      setError(err.message);
    }
    setSavingAnnouncement(false);
  }

  async function archiveAnnouncementRow(a, archived) {
    try {
      await setAnnouncementArchived(a.id, archived);
      loadAnnouncementsPanel();
      if (showArchivedAnnouncements) loadArchivedAnnouncements();
    } catch (err) {
      setError(err.message);
    }
  }

  async function castAnnouncementVote(announcementId, optionId) {
    // Optimistic update so the tap feels instant, then reconciled by the
    // upsert — re-voting replaces this user's prior pick either way.
    setPollVotes((prev) => {
      const existing = (prev[announcementId] || []).filter((v) => v.user_id !== user.id);
      return { ...prev, [announcementId]: [...existing, { announcement_id: announcementId, user_id: user.id, option_id: optionId }] };
    });
    try {
      await castPollVote(announcementId, user.id, optionId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeAnnouncement(id) {
    try {
      await deleteAnnouncement(id);
      setAnnouncements((prev) => (prev || []).filter((a) => !(a.kind === "global" && a.id === id)));
      setArchivedAnnouncements((prev) => (prev || []).filter((a) => a.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  // Dismiss just hides the item from this person's own view -- for a
  // personal notification that's a straight delete (they're the only
  // one who could ever see it); for a global announcement it can't
  // touch the shared row, so it records a per-user dismissal instead.
  async function dismissAnnouncementItem(a) {
    try {
      if (a.kind === "personal") {
        await dismissNotification(a.id);
      } else {
        await dismissAnnouncementForUser(a.id, user.id);
      }
      setAnnouncements((prev) => (prev || []).filter((x) => !(x.kind === a.kind && x.id === a.id)));
    } catch (err) {
      setError(err.message);
    }
  }

  function filterHistoryByRange(rangeKey) {
    if (!history) return [];
    const def = RANGES.find((r) => r.key === rangeKey) || RANGES[1];
    if (!def.days) return history;
    const cutoff = isoDaysAgo(def.days);
    return history.filter((w) => w.completed_at >= cutoff);
  }

  const volumeFilteredHistory = useMemo(() => filterHistoryByRange(volumeRange), [history, volumeRange]);
  const weightFilteredHistory = useMemo(() => filterHistoryByRange(weightRange), [history, weightRange]);
  const workoutTimeFilteredHistory = useMemo(() => filterHistoryByRange(workoutTimeRange), [history, workoutTimeRange]);
  const muscleFilteredHistory = useMemo(() => filterHistoryByRange(muscleRange), [history, muscleRange]);

  const { entries, dailyVolume: muscleDailyVolumeLb } = useMemo(
    () => summarizeHistory(muscleFilteredHistory),
    [muscleFilteredHistory]
  );
  const { dailyVolume: volumeDailyVolumeLb } = useMemo(
    () => summarizeHistory(volumeFilteredHistory),
    [volumeFilteredHistory]
  );
  const dailyVolume = useMemo(
    () => bucketDailyVolume(volumeDailyVolumeLb.map((d) => ({ ...d, volume: Math.round(toDisplay(d.volume, units)) })), volumeRange),
    [volumeDailyVolumeLb, units, volumeRange]
  );
  const { primary, secondary, fullBodySets } = useMemo(() => computeMuscleSetCounts(entries, muscleNameMode), [entries, muscleNameMode, taxonomyVersion]);
  // Computed directly from the raw workout data for the selected range,
  // not derived from the muscle-group breakdown above — that path silently
  // drops sets from any exercise it can't categorize (e.g. a deleted
  // custom exercise), which would quietly undercount the total.
  const totalSetsInRange = useMemo(
    () => muscleFilteredHistory.reduce(
      (total, w) => total + (w.workout_exercises || []).reduce((s, we) => s + (we.sets || []).filter((set) => !set.is_warmup).length, 0),
      0
    ),
    [muscleFilteredHistory]
  );
  const weightHistory = useMemo(
    () => bucketWeightHistory(summarizeWeightHistory(weightFilteredHistory), weightRange),
    [weightFilteredHistory, weightRange]
  );
  const workoutTimeData = useMemo(
    () => bucketSeries(summarizeWorkoutDuration(workoutTimeFilteredHistory), workoutTimeRange, "minutes", "sum"),
    [workoutTimeFilteredHistory, workoutTimeRange]
  );

  // The chart-lock summary card (below) needs to know each metric's
  // current range to label the selected bucket correctly, since they can
  // now differ per chart.


  // The calendar always reflects real training history, independent of
  // whatever range the volume chart above happens to be showing.
  const { byDate: calendarByDate, workoutsByDate } = useMemo(() => groupWorkoutsByDate(history || []), [history]);
  const monthGrid = useMemo(() => buildMonthGrid(calendarMonth, calendarByDate), [calendarMonth, calendarByDate]);
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
      <div style={{ width: "100%", maxWidth: 400, background: T.bg, minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 100px" }} onScroll={handleHomeScroll} onClick={() => setLockedTs(null)}>
          {/* Header — pinned while the rest of the page scrolls beneath it */}
          <div style={{ padding: "20px 0 8px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", position: "sticky", top: 0, background: T.bg, zIndex: 5 }}>
            <div>
              <button onClick={() => setShowHomeModulesEditor(true)} aria-label="Customize home" style={ghostIconBtn}>
                <IconPencil size={19} />
              </button>
            </div>
            <Logo size={64} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <button onClick={openAnnouncements} aria-label="Announcements" style={{ ...ghostIconBtn, position: "relative" }}>
                <IconBell size={19} />
                {unseenAnnouncements && (
                  <span style={{ position: "absolute", top: 4, right: 4, width: 9, height: 9, borderRadius: 999, background: T.accent, border: `2px solid ${T.bg}` }} />
                )}
              </button>
              <button onClick={() => setShowMenu(true)} aria-label="Settings" style={{ ...ghostIconBtn, position: "relative" }}>
                <IconMenu size={20} />
                {unseenFeedbackCount > 0 && (
                  <span style={{ position: "absolute", top: 4, right: 4, width: 9, height: 9, borderRadius: 999, background: T.accent, border: `2px solid ${T.bg}` }} />
                )}
              </button>
            </div>
          </div>

          {history === null ? (
            <InlineLoading label="Loading your history…" padding="40px 0" />
          ) : (
            <>
              {homeModules.find((m) => m.id === "insight")?.enabled && (
                <div style={{
                  background: T.surface, border: `1px solid ${T.line}`, borderLeft: `3px solid ${insight.status === "overdue" ? T.accent : insight.status === "today" || insight.status === "ready" ? T.green : T.line}`,
                  borderRadius: 12, padding: "12px 14px", marginTop: 8, marginBottom: 8, display: "flex", alignItems: "center", gap: 12,
                }}>
                  <div style={{ flexShrink: 0, textAlign: "center", minWidth: 46 }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, lineHeight: 1, color: insight.status === "overdue" ? T.accent : T.text }}>
                      {insight.daysSince === null ? "—" : insight.daysSince}
                    </div>
                    <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase", letterSpacing: 0.5 }}>day{insight.daysSince === 1 ? "" : "s"} ago</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, borderLeft: `1px solid ${T.line}`, paddingLeft: 12 }}>
                    {insight.muscles.length > 0 && (
                      <div style={{ fontSize: 12, color: T.text, fontWeight: 600, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {insight.muscles.map((m) => muscleLabel(m, muscleNameMode)).join(" · ")}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: T.dim, lineHeight: 1.4 }}>{insight.tip}</div>
                  </div>
                </div>
              )}

              <div>
                {lockedTs != null && (() => {
                  const volPoint = dailyVolume.find((d) => d.ts === lockedTs);
                  const weightPoint = weightHistory.find((d) => d.ts === lockedTs);
                  const timePoint = workoutTimeData.find((d) => d.ts === lockedTs);
                  return (
                    <div style={{ background: T.surface2, border: `1px solid ${T.accent}`, borderRadius: 12, padding: 12, marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                          {new Date(lockedTs).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                        </div>
                        <button onClick={() => setLockedTs(null)} aria-label="Clear selected day" style={{ background: "none", border: "none", color: T.dim, padding: 2, display: "flex" }}><IconX size={13} /></button>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <div style={{ flex: 1, textAlign: "center" }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: T.accent }}>{volPoint ? volPoint.volume.toLocaleString() : "—"}</div>
                          <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 0.5 }}>Volume{volPoint ? ` (${units})` : ""}</div>
                        </div>
                        <div style={{ flex: 1, textAlign: "center", borderLeft: `1px solid ${T.line}`, borderRight: `1px solid ${T.line}` }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: T.green }}>{weightPoint ? weightPoint.weight.toLocaleString() : "—"}</div>
                          <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 0.5 }}>Bodyweight{weightPoint ? ` (${units})` : ""}</div>
                        </div>
                        <div style={{ flex: 1, textAlign: "center" }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#3B82F6" }}>{timePoint ? timePoint.minutes.toLocaleString() : "—"}</div>
                          <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 0.5 }}>Time{timePoint ? " (min)" : ""}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: T.dim, marginTop: 6, textAlign: "center" }}>Values only line up across charts if their Training Ranges overlap this date</div>
                    </div>
                  );
                })()}

                {homeModules.filter((m) => m.enabled).map((m) => {
                  switch (m.id) {
                    case "myPlan":
                      return <WeeklySetGoals key={m.id} userId={user.id} history={history} />;
                    case "volume":
                      return (
                        <HomeChartCard
                          key={m.id}
                          title="Volume over time"
                          data={dailyVolume}
                          dataKey="volume"
                          color={T.accent}
                          range={volumeRange}
                          onRangeChange={setVolumeRange}
                          tooltipLabel="Volume"
                          valueFormatter={(v) => `${v.toLocaleString()} ${units}`}
                          emptyMessage="No completed workouts in this range yet."
                          lockedTs={lockedTs}
                          onLock={setLockedTs}
                        />
                      );
                    case "weight":
                      return (
                        <HomeChartCard
                          key={m.id}
                          title="Bodyweight over time"
                          data={weightHistory}
                          dataKey="weight"
                          color={T.green}
                          range={weightRange}
                          onRangeChange={setWeightRange}
                          tooltipLabel="Bodyweight"
                          valueFormatter={(v) => `${v.toLocaleString()} ${units}`}
                          emptyMessage="No bodyweight logged in this range. Add it after a workout or in Settings."
                          lockedTs={lockedTs}
                          onLock={setLockedTs}
                        />
                      );
                    case "workoutTime":
                      return (
                        <HomeChartCard
                          key={m.id}
                          title="Workout time"
                          data={workoutTimeData}
                          dataKey="minutes"
                          color="#3B82F6"
                          range={workoutTimeRange}
                          onRangeChange={setWorkoutTimeRange}
                          tooltipLabel="Workout time"
                          valueFormatter={(v) => `${v.toLocaleString()} min`}
                          emptyMessage="No completed workouts in this range yet."
                          lockedTs={lockedTs}
                          onLock={setLockedTs}
                        />
                      );
                    case "muscleBreakdown":
                      return (
                        <div key={m.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                            <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, flexShrink: 0 }}>Muscle breakdown</div>
                            <RangeSwitcher range={muscleRange} onChange={setMuscleRange} />
                          </div>
                          <div style={{ textAlign: "right", fontSize: 11, color: T.dim, marginBottom: 8 }}>{totalSetsInRange} set{totalSetsInRange === 1 ? "" : "s"}</div>
                          {Object.keys(primary).length === 0 && Object.keys(secondary).length === 0 ? (
                            <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "12px 0" }}>Nothing logged in this range yet.</div>
                          ) : (
                          <BodyHeatmap primary={primary} secondary={secondary} fullBodySets={fullBodySets} entries={entries} onSelectMuscle={(muscle) => setMuscleDetail({ muscle })} userId={user.id} fullHistory={history} />
                          )}
                        </div>
                      );
                    case "calendar":
                      return (
                        <div key={m.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                            <button onClick={() => shiftMonth(setCalendarMonth, -1)} style={navBtn}>‹</button>
                            <div style={{ textAlign: "center" }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                                {calendarMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
                              </div>
                              {streak > 0 && (
                                <div style={{ fontSize: 10, color: T.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginTop: 1 }}>
                                  {streak} day streak
                                </div>
                              )}
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
                              const hasWorkout = cell.volume > 0;
                              const clickable = cell.volume > 0;
                              return (
                                <button
                                  key={i}
                                  onClick={() => clickable && handleDayClick(cell.date)}
                                  disabled={!clickable}
                                  title={cell.volume > 0 ? `${Math.round(toDisplay(cell.volume, units)).toLocaleString()} ${units} — tap for details` : undefined}
                                  style={{
                                    aspectRatio: "1", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 10, color: hasWorkout ? "#fff" : T.dim,
                                    background: hasWorkout ? T.accent : T.surface2,
                                    opacity: 1,
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
                      );
                    default:
                      return null;
                  }
                })}
              </div>
            </>
          )}
        </div>

        {/* Start workout */}
        <div style={{ position: "sticky", bottom: 0, borderTop: `1px solid ${T.line}`, background: T.surface, padding: 16 }}>
          {activeWorkout ? (
            <button onClick={onResumeWorkout} style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "none", background: T.accent, color: "#fff", fontSize: 17, fontWeight: 700, letterSpacing: 0.3, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span>Resume Workout</span>
              <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.85, fontVariantNumeric: "tabular-nums" }}>{activeWorkoutElapsed}</span>
            </button>
          ) : (
            <button onClick={onStartWorkout} style={{ width: "100%", padding: "16px 0", borderRadius: 14, border: "none", background: T.accent, color: "#fff", fontSize: 17, fontWeight: 700, letterSpacing: 0.3 }}>
              Start Workout
            </button>
          )}
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
              {/* Workouts */}
              {(settingsMatch("templates workouts reusable build manage") || settingsMatch("exercise library browse muscle scientific detailed generic nicknames equipment pattern custom exercises edit delete") || settingsMatch("program generator training block multi-week progression deload science coach") || settingsMatch("weekly set goals my plan targets muscle group individual uniform one for all")) && (
              <>
              <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Workouts</div>
              {settingsMatch("weekly set goals my plan targets muscle group individual uniform one for all") && (
              <button
                onClick={() => setShowWeeklySetGoals(true)}
                style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}
              >
                <div>
                  <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>Weekly Set Goals</div>
                  <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>Set a weekly target per muscle group, or one number for all of them</div>
                </div>
                <div style={{ color: T.dim, fontSize: 16 }}>›</div>
              </button>
              )}
              {settingsMatch("program generator training block multi-week progression deload science coach") && (
              <button
                onClick={() => setShowProgramView(true)}
                style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}
              >
                <div>
                  <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>Program</div>
                  <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>Build a multi-week program with science-backed progression</div>
                </div>
                <div style={{ color: T.dim, fontSize: 16 }}>›</div>
              </button>
              )}
              {settingsMatch("templates workouts reusable build manage") && (
              <button
                onClick={() => setShowTemplates(true)}
               
                style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}
              >
                <div>
                  <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>Templates</div>
                  <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>Build or manage reusable workouts</div>
                </div>
                <div style={{ color: T.dim, fontSize: 16 }}>›</div>
              </button>
              )}

              {settingsMatch("exercise library browse muscle scientific detailed generic nicknames equipment pattern custom exercises edit delete") && (
              <button
                onClick={() => setShowExerciseLibraryView(true)}
                style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}
              >
                <div>
                  <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>Exercise Library</div>
                  <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>Browse every exercise, including your own custom ones</div>
                </div>
                <div style={{ color: T.dim, fontSize: 16 }}>›</div>
              </button>
              )}
              </>
              )}

              {/* Profile & Preferences */}
              {settingsMatch("profile gender age date of birth weight height preferences units weight lb kg pounds kilograms time format 12h 24h clock muscle names generic detailed scientific training focus rep range hypertrophy strength endurance dots percentile deltalog default set entry manual plate calculator logging type big plates bumpers squats deadlifts rest timer seconds") && (
              <>
              <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Profile & Preferences</div>
              <div style={{ marginBottom: 20 }}>
                {settingsMatch("profile gender age date of birth weight height") && (
                <button
                  onClick={() => setShowProfileEditor(true)}
                  style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}
                >
                  <div>
                    <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>Profile</div>
                    <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>Gender, age, weight, height — used for strength scoring and insights</div>
                  </div>
                  <div style={{ color: T.dim, fontSize: 16 }}>›</div>
                </button>
                )}
                <Preferences
                  value={{ units, muscleNameMode, scoreDisplay, weightEntryMode, restSeconds: restDefault, warmupRestSeconds: warmupRestDefault, warmupRestEnabled, restTimerSoundEnabled, restTimerSound, restTimerVibrationEnabled, restTimerVibration, restTimerNotificationEnabled, plate55Scope, trainingIdeology, timeFormat }}
                  filterQuery={settingsQuery}
                  onChange={(key, val) => {
                    if (key === "units") setUnits(val);
                    else if (key === "muscleNameMode") setMuscleNameMode(val);
                    else if (key === "scoreDisplay") setScoreDisplay(val);
                    else if (key === "weightEntryMode") setWeightEntryMode(val);
                    else if (key === "restSeconds") setRestDefault(val);
                    else if (key === "warmupRestSeconds") setWarmupRestDefault(val);
                    else if (key === "warmupRestEnabled") setWarmupRestEnabled(val);
                    else if (key === "restTimerSoundEnabled") setRestTimerSoundEnabled(val);
                    else if (key === "restTimerSound") setRestTimerSound(val);
                    else if (key === "restTimerVibrationEnabled") setRestTimerVibrationEnabled(val);
                    else if (key === "restTimerVibration") setRestTimerVibration(val);
                    else if (key === "restTimerNotificationEnabled") setRestTimerNotificationEnabled(val);
                    else if (key === "plate55Scope") setPlate55Scope(val);
                    else if (key === "trainingIdeology") setTrainingIdeology(val);
                    else if (key === "timeFormat") setTimeFormat(val);
                  }}
                />
              </div>
              </>
              )}

              {/* Guides & Support */}
              {settingsMatch("guides support faq community feedback splits push pull legs") && (
              <>
              <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Guides & Support</div>
              <button
                onClick={() => setShowHelpSupport(true)}
                style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}
              >
                <div>
                  <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>Guides & Support</div>
                  <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>FAQ, community, and feedback</div>
                </div>
                <div style={{ color: T.dim, fontSize: 16 }}>›</div>
              </button>
              </>
              )}

              {/* Admin */}
              {isRealAdmin && settingsMatch("admin custom exercises feedback bugs simulate new user version history changelog exercise library muscle groups roles permissions creator admin view normal user activity usage last opened last logged churn") && (
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

              <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 12 }}>
                <button
                  onClick={() => setShowWhatsNew(true)}
                  style={{ background: "none", border: "none", color: T.dim, fontSize: 11, opacity: 0.6, padding: 0 }}
                >
                  v{APP_VERSION} · What's new
                </button>
                <div style={{ color: T.dim, fontSize: 11, opacity: 0.4 }}>·</div>
                <button
                  onClick={() => setShowWhatsNext(true)}
                  style={{ background: "none", border: "none", color: T.dim, fontSize: 11, opacity: 0.6, padding: 0 }}
                >
                  What's next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTemplates && <Templates user={user} onClose={() => setShowTemplates(false)} />}
      {showWeeklySetGoals && <WeeklySetGoalsEditor userId={user.id} onClose={() => setShowWeeklySetGoals(false)} />}
      {showProgramView && (
        <ProgramView
          user={user}
          onClose={() => setShowProgramView(false)}
          onWorkoutStarted={() => { setShowProgramView(false); setShowMenu(false); onProgramWorkoutStarted(); }}
        />
      )}
      {showTerms && <TermsViewer onClose={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacyPolicy user={user} onClose={() => setShowPrivacy(false)} />}
      {showWhatsNew && <WhatsNew onClose={() => setShowWhatsNew(false)} />}
      {showWhatsNext && <WhatsNext onClose={() => setShowWhatsNext(false)} />}
      {autoWhatsNewEntries && <WhatsNew entries={autoWhatsNewEntries} onClose={closeAutoWhatsNew} />}
      {showHelpSupport && (
        <HelpSupport
          onClose={() => setShowHelpSupport(false)}
          onOpenFAQ={() => setShowFAQ(true)}
          onOpenInstallGuide={() => setShowInstallGuide(true)}
          onOpenFeedback={() => setShowFeedback(true)}
          onReplaySetup={() => setShowSetupReplay(true)}
        />
      )}
      {showSetupReplay && (
        <SetupWizard onComplete={() => setShowSetupReplay(false)} onClose={() => setShowSetupReplay(false)} />
      )}
      {showVersionHistory && <VersionHistory onClose={() => setShowVersionHistory(false)} />}
      {showFAQ && <FAQ onClose={() => setShowFAQ(false)} />}
      {showAdminHome && (
        <AdminHome
          onClose={() => setShowAdminHome(false)}
          unseenFeedbackCount={unseenFeedbackCount}
          isCreator={isRealCreator}
          onOpenExercises={() => setShowAdmin(true)}
          onOpenFeedback={() => { setShowAdminFeedback(true); markFeedbackViewed(user.id).then(() => setUnseenFeedbackCount(0)).catch(() => {}); }}
          onOpenRoles={() => setShowAdminRoles(true)}
          onOpenUserActivity={() => setShowAdminUserActivity(true)}
          onOpenReferralSources={() => setShowAdminReferralSources(true)}
          onOpenSplits={() => setShowSplitsManager(true)}
          onSimulateNewUser={() => { setShowAdminHome(false); setShowMenu(false); setShowSetupReplay(true); }}
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
          entries={entries}
          nameMode="detailed"
          units={units}
          onClose={() => setMuscleDetail(null)}
        />
      )}
      {showHomeModulesEditor && (
        <HomeModulesEditor modules={homeModules} onChange={updateHomeModules} onClose={() => setShowHomeModulesEditor(false)} />
      )}
      {showAdminRoles && <AdminRoles currentUserId={user.id} onClose={() => setShowAdminRoles(false)} />}
      {showAdminUserActivity && isRealCreator && <AdminUserActivity onClose={() => setShowAdminUserActivity(false)} />}
      {showAdminReferralSources && <AdminReferralSources onClose={() => setShowAdminReferralSources(false)} />}
      {showSplitsManager && <SplitsManager onClose={() => setShowSplitsManager(false)} />}
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
      {showFeedback && <FeedbackModal user={user} context="settings" onClose={() => setShowFeedback(false)} />}
      {showAnnouncements && (
        <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 25, display: "flex", justifyContent: "center", overflowY: "auto" }}>
          <div style={{ width: "100%", maxWidth: 400, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}>
              <button onClick={() => setShowAnnouncements(false)} aria-label="Close" style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 13 }}>‹</button>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: T.text, textAlign: "center" }}>ANNOUNCEMENTS</div>
              {effectiveIsAdmin ? (
                <button onClick={() => openComposeAnnouncement()} aria-label="New announcement" style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.line}`, background: T.surface, color: T.dim, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <IconPlus size={16} />
                </button>
              ) : (
                <div style={{ width: 32 }} />
              )}
            </div>
            <div style={{ padding: 16, flex: 1 }}>
              {effectiveIsAdmin && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                  <button onClick={toggleArchivedAnnouncementsView} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: T.dim, fontSize: 12, padding: 0 }}>
                    <IconArchive size={13} />
                    {showArchivedAnnouncements ? "Back to active" : "View archived"}
                  </button>
                </div>
              )}

              {showArchivedAnnouncements ? (
                <>
                  {archivedAnnouncements === null && <InlineLoading />}
                  {archivedAnnouncements !== null && archivedAnnouncements.length === 0 && (
                    <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 20px", border: `1px dashed ${T.line}`, borderRadius: 12 }}>Nothing archived.</div>
                  )}
                  {archivedAnnouncements?.map((a) => (
                    <div key={a.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, marginBottom: 10, opacity: 0.85 }}>
                      <div style={{ color: T.text, fontSize: 14, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>{a.message}</div>
                      {a.poll && <AnnouncementPoll poll={a.poll} votes={pollVotes[a.id]} userId={user.id} disabled onVote={() => {}} />}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                        <div style={{ fontSize: 11, color: T.dim }}>{new Date(a.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</div>
                        <div style={{ display: "flex", gap: 12 }}>
                          <button onClick={() => archiveAnnouncementRow(a, false)} style={{ background: "none", border: "none", color: T.dim, fontSize: 11, textDecoration: "underline", padding: 0 }}>Unarchive</button>
                          <button onClick={() => removeAnnouncement(a.id)} style={{ background: "none", border: "none", color: T.dim, fontSize: 11, textDecoration: "underline", padding: 0 }}>Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {announcements === null && <InlineLoading />}
                  {announcements !== null && announcements.length === 0 && (
                    <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 20px", border: `1px dashed ${T.line}`, borderRadius: 12 }}>Nothing posted yet.</div>
                  )}
                  {announcements?.map((a) => (
                    <div key={`${a.kind}-${a.id}`} style={{ background: T.surface, border: `1px solid ${a.kind === "personal" ? T.accent : T.line}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
                      {a.kind === "personal" && <div style={{ fontSize: 10, color: T.accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Just for you</div>}
                      <div style={{ color: T.text, fontSize: 14, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>{a.message}</div>
                      {a.kind === "global" && a.poll && (
                        <AnnouncementPoll poll={a.poll} votes={pollVotes[a.id]} userId={user.id} disabled={false} onVote={(optionId) => castAnnouncementVote(a.id, optionId)} />
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                        <div style={{ fontSize: 11, color: T.dim }}>{new Date(a.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</div>
                        <div style={{ display: "flex", gap: 12 }}>
                          {effectiveIsAdmin && a.kind === "global" && (
                            <>
                              <button onClick={() => openComposeAnnouncement(a)} style={{ background: "none", border: "none", color: T.dim, fontSize: 11, textDecoration: "underline", padding: 0 }}>Edit</button>
                              <button onClick={() => archiveAnnouncementRow(a, true)} style={{ background: "none", border: "none", color: T.dim, fontSize: 11, textDecoration: "underline", padding: 0 }}>Archive</button>
                              <button onClick={() => removeAnnouncement(a.id)} style={{ background: "none", border: "none", color: T.dim, fontSize: 11, textDecoration: "underline", padding: 0 }}>Delete</button>
                            </>
                          )}
                          <button onClick={() => dismissAnnouncementItem(a)} style={{ background: "none", border: "none", color: T.dim, fontSize: 11, textDecoration: "underline", padding: 0 }}>Dismiss</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {composeAnnouncement && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.8)", zIndex: 30, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 420, maxHeight: "88vh", overflowY: "auto", background: T.bg, borderTop: `1px solid ${T.line}`, borderRadius: "20px 20px 0 0", padding: 20, boxSizing: "border-box" }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 19, fontWeight: 700, color: T.text, marginBottom: 12 }}>
              {composeAnnouncement.id ? "Edit announcement" : "New announcement"}
            </div>
            <textarea
              value={composeAnnouncement.message}
              onChange={(e) => setComposeAnnouncement((c) => ({ ...c, message: e.target.value }))}
              placeholder="What's new…"
              rows={4}
              style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "8px 10px", outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", marginBottom: 12 }}
            />

            {composeAnnouncement.poll ? (
              <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>Poll</div>
                  <button onClick={removePollFromCompose} style={{ background: "none", border: "none", color: T.dim, fontSize: 11, textDecoration: "underline", padding: 0 }}>Remove poll</button>
                </div>
                <input
                  value={composeAnnouncement.poll.question}
                  onChange={(e) => updateComposePollQuestion(e.target.value)}
                  placeholder="Ask a question…"
                  style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "8px 10px", outline: "none", boxSizing: "border-box", marginBottom: 8 }}
                />
                {composeAnnouncement.poll.options.map((opt, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input
                      value={opt}
                      onChange={(e) => updateComposePollOption(i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                      style={{ flex: 1, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "8px 10px", outline: "none", boxSizing: "border-box" }}
                    />
                    {composeAnnouncement.poll.options.length > 2 && (
                      <button onClick={() => removeComposePollOption(i)} aria-label="Remove option" style={{ width: 34, borderRadius: 8, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 14 }}>×</button>
                    )}
                  </div>
                ))}
                <button onClick={addComposePollOption} style={{ background: "none", border: `1px dashed ${T.line}`, borderRadius: 8, color: T.dim, fontSize: 12, padding: "6px 0", width: "100%" }}>+ Add option</button>
              </div>
            ) : (
              <button onClick={addPollToCompose} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: "10px 0", borderRadius: 10, border: `1px dashed ${T.line}`, background: "none", color: T.dim, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                <IconPlus size={13} /> Add a poll
              </button>
            )}

            <button
              onClick={submitComposeAnnouncement}
              disabled={
                savingAnnouncement ||
                !composeAnnouncement.message.trim() ||
                (composeAnnouncement.poll && (!composeAnnouncement.poll.question.trim() || composeAnnouncement.poll.options.filter((o) => o.trim()).length < 2))
              }
              style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: T.accent, color: "#fff", fontSize: 13, fontWeight: 700, opacity: savingAnnouncement ? 0.6 : 1, marginBottom: 8 }}
            >
              {savingAnnouncement ? "Saving…" : composeAnnouncement.id ? "Save changes" : "Post to all users"}
            </button>
            <button onClick={closeComposeAnnouncement} style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 13, fontWeight: 600 }}>Cancel</button>
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
          onBodyWeightUpdated={(workoutId, bodyWeight) =>
            setHistory((prev) => {
              const updated = (prev || []).map((w) => (
                w.id !== workoutId ? w : { ...w, body_weight: bodyWeight }
              ));
              // Keep the profile's stored weight in sync with whichever
              // completed workout has the most recent body weight entry —
              // not just whichever one was just edited. Editing an older
              // entry shouldn't override a newer one, and clearing the
              // most recent entry should fall back to the next most
              // recent instead of leaving the profile stuck on a stale
              // value.
              const withWeight = updated.filter((w) => w.body_weight != null && w.completed_at);
              withWeight.sort((a, b) => b.completed_at.localeCompare(a.completed_at));
              const nextWeight = withWeight.length > 0 ? withWeight[0].body_weight : null;
              if (profile && nextWeight !== profile.weight) {
                saveProfile(user.id, {
                  gender: profile.gender,
                  dateOfBirth: profile.date_of_birth,
                  weight: nextWeight,
                  weightUnit: profile.weight_unit || getPrefs().units,
                }).then(() => setProfile((p) => (p ? { ...p, weight: nextWeight } : p))).catch(() => {});
              }
              return updated;
            })
          }
        />
      )}
    </div>
  );
}

const navBtn = { width: 28, height: 28, borderRadius: 999, border: `1px solid ${T.line}`, background: T.surface2, color: T.dim, fontSize: 14 };
const ghostIconBtn = { width: 38, height: 38, border: "none", background: "none", color: T.dim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0 };

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
