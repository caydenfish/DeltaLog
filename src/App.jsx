import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { fetchProfile, fetchActiveWorkout, fetchMuscleTaxonomy, fetchSplits, fetchSplitExclusions, logAppOpen } from "./lib/queries";
import { setMuscleTaxonomyCache } from "./lib/muscleNomenclature";
import { setSplitsCache, setSplitExclusionsCache } from "./lib/splits";
import { getPrefs } from "./lib/prefs";
import Auth from "./Auth";
import ResetPassword from "./ResetPassword";
import Onboarding from "./Onboarding";
import TermsGate from "./TermsGate";
import SetupWizard from "./SetupWizard";
import Home from "./Home";
import SetLogger from "./SetLogger";
import AppSplash from "./AppSplash";
import SharedWorkoutView from "./SharedWorkoutView";
import LoadingScreen from "./LoadingSpinner";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [profile, setProfile] = useState(undefined); // undefined = loading, null = not set up yet
  const [mode, setMode] = useState(null); // null = undecided, "home" | "workout"
  const [resumeWorkout, setResumeWorkout] = useState(undefined); // undefined = not checked, null = none, object = found
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [setupSeen, setSetupSeen] = useState(() => getPrefs().setupWizardSeen);
  // A ?shared=CODE link should render the read-only shared-workout view
  // immediately, before any auth check — the whole point is that someone
  // without an account (or logged into a different one) can open it.
  // Cleared once they tap through, so signing in afterward lands on Home
  // as normal instead of bouncing back to the shared view.
  const [sharedCode, setSharedCode] = useState(() => new URLSearchParams(window.location.search).get("shared"));
  // True once any loading gate below has held for longer than expected —
  // surfaces a manual reload option instead of leaving someone stuck on
  // a blank/loading screen with no way out short of force-quitting.
  const [stuck, setStuck] = useState(false);

  // Muscle labels (muscleLabel/genericBucket) are read synchronously
  // during render all over the app, so the admin-editable taxonomy is
  // loaded once into an in-memory cache here rather than fetched
  // per-component. Public data, no session required — also needed for
  // the signed-out shared-workout view. Splits (Push/Pull/Legs/etc) are
  // the same story — also admin-editable, also read synchronously in
  // render code (the generator, exercise picker filters, FAQ), so also
  // cached here rather than fetched per-component.
  useEffect(() => {
    fetchMuscleTaxonomy().then(setMuscleTaxonomyCache).catch(() => {});
    fetchSplits().then(setSplitsCache).catch(() => {});
    fetchSplitExclusions().then(setSplitExclusionsCache).catch(() => {});
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    let lastUserId;
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      setSession(newSession);
      // onAuthStateChange also fires for background token refreshes
      // (e.g. when the app regains focus after being backgrounded), not
      // just real sign-in/sign-out. Resetting mode unconditionally here
      // used to drop an already-settled app back into the loading gate
      // on every one of those refreshes — harmless if the resulting
      // refetch completes quickly, but if that request hangs (common on
      // mobile right as a fetch is in flight when the OS suspends the
      // app), there was no way back short of killing the app. Only
      // re-decide mode when the signed-in user actually changes.
      const newUserId = newSession?.user?.id || null;
      if (newUserId !== lastUserId) {
        lastUserId = newUserId;
        setMode(null);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    logAppOpen().catch(() => {});
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session) { setProfile(undefined); return; }
    let cancelled = false;
    fetchProfile(session.user.id)
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch(() => { if (!cancelled) setProfile(null); });
    return () => { cancelled = true; };
  }, [session]);

  // On every fresh load (including the page having been fully unloaded
  // and reloaded after being backgrounded on mobile), check whether the
  // person has a workout in progress. If so, drop them straight back
  // into it instead of Home — this is what makes leaving the browser
  // mid-workout safe.
  useEffect(() => {
    if (!session) { setResumeWorkout(undefined); return; }
    let cancelled = false;
    fetchActiveWorkout(session.user.id)
      .then((w) => { if (!cancelled) setResumeWorkout(w); })
      .catch(() => { if (!cancelled) setResumeWorkout(null); });
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    if (resumeWorkout === undefined) return;
    setMode((m) => (m === null ? (resumeWorkout ? "workout" : "home") : m));
  }, [resumeWorkout]);

  const profileComplete = profile && profile.gender && profile.date_of_birth && profile.first_name && profile.last_name;
  // True once we know exactly what to show — every async gate below has
  // resolved. The splash overlay stays up (covering whatever partial
  // content renders underneath) until this flips, then plays its
  // reveal animation. Kept as one flag rather than early-returning a
  // bare loading div at each gate, so the splash can sit on top of
  // real content that's already mid-mount instead of a blank screen.
  const ready = !(
    session === undefined ||
    (session && profile === undefined) ||
    (session && profileComplete && profile.terms_accepted_at && setupSeen && resumeWorkout === undefined)
  );

  let content = null;
  let loadingGate = false;
  if (session === undefined) {
    content = null; loadingGate = true;
  } else if (!session) {
    content = <Auth />;
  } else if (passwordRecovery) {
    content = <ResetPassword onDone={() => setPasswordRecovery(false)} />;
  } else if (profile === undefined) {
    content = null; loadingGate = true;
  } else if (!profileComplete) {
    content = <Onboarding user={session.user} profile={profile} onComplete={() => fetchProfile(session.user.id).then(setProfile)} />;
  } else if (!profile.terms_accepted_at) {
    content = <TermsGate user={session.user} onAccepted={() => fetchProfile(session.user.id).then(setProfile)} />;
  } else if (!setupSeen) {
    content = <SetupWizard onComplete={() => setSetupSeen(true)} />;
  } else if (resumeWorkout === undefined || mode === null) {
    content = <LoadingScreen />;
  } else {
    content = (
      <>
        {mode === "workout" ? (
          <SetLogger
            user={session.user}
            resumeWorkout={resumeWorkout}
            onFinished={() => { setResumeWorkout(null); setMode("home"); }}
            onGoHome={() => {
              // Unlike onFinished, the workout itself isn't touched — it's
              // still active on the server. Re-fetch it so Home knows to
              // offer "Resume workout" instead of losing track of it.
              setMode("home");
              fetchActiveWorkout(session.user.id).then(setResumeWorkout).catch(() => {});
            }}
          />
        ) : (
          <Home
            user={session.user}
            activeWorkout={resumeWorkout}
            onStartWorkout={() => { setResumeWorkout(null); setMode("workout"); }}
            onResumeWorkout={() => setMode("workout")}
            onDataReset={() => setProfile(null)}
            onProgramWorkoutStarted={() => {
              // The program-generated workout was already created server-side
              // (ProgramView calls startWorkout/addWorkoutExercise itself) --
              // refetch it the same way onGoHome does, then drop straight in.
              fetchActiveWorkout(session.user.id).then((w) => { setResumeWorkout(w); setMode("workout"); }).catch(() => {});
            }}
          />
        )}
      </>
    );
  }

  useEffect(() => {
    if (!loadingGate) { setStuck(false); return; }
    const t = setTimeout(() => setStuck(true), 9000);
    return () => clearTimeout(t);
  }, [loadingGate]);

  return (
    <>
      {sharedCode ? (
        <SharedWorkoutView
          code={sharedCode}
          onDone={() => {
            window.history.replaceState(null, "", window.location.pathname);
            setSharedCode(null);
          }}
        />
      ) : (
        <>
          {content}
          <AppSplash ready={ready} />
          {stuck && (
            <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: "0 24px 32px", display: "flex", justifyContent: "center", zIndex: 10000 }}>
              <button
                onClick={() => window.location.reload()}
                style={{ background: "#1A1D23", border: "1px solid #2C313B", color: "#8B919D", borderRadius: 999, padding: "10px 18px", fontSize: 13 }}
              >
                Taking longer than usual — tap to reload
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
