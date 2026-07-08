import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { fetchProfile, fetchActiveWorkout, fetchMuscleTaxonomy } from "./lib/queries";
import { setMuscleTaxonomyCache } from "./lib/muscleNomenclature";
import { getPrefs } from "./lib/prefs";
import Auth from "./Auth";
import ResetPassword from "./ResetPassword";
import Onboarding from "./Onboarding";
import TermsGate from "./TermsGate";
import SetupWizard from "./SetupWizard";
import Home from "./Home";
import SetLogger from "./SetLogger";
import { TutorialProvider } from "./TutorialContext";
import TutorialOverlay from "./TutorialOverlay";
import AppSplash from "./AppSplash";
import SharedWorkoutView from "./SharedWorkoutView";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [profile, setProfile] = useState(undefined); // undefined = loading, null = not set up yet
  const [mode, setMode] = useState("home"); // "home" | "workout"
  const [resumeWorkout, setResumeWorkout] = useState(undefined); // undefined = not checked, null = none, object = found
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [setupSeen, setSetupSeen] = useState(() => getPrefs().setupWizardSeen);
  // A ?shared=CODE link should render the read-only shared-workout view
  // immediately, before any auth check — the whole point is that someone
  // without an account (or logged into a different one) can open it.
  // Cleared once they tap through, so signing in afterward lands on Home
  // as normal instead of bouncing back to the shared view.
  const [sharedCode, setSharedCode] = useState(() => new URLSearchParams(window.location.search).get("shared"));

  // Muscle labels (muscleLabel/genericBucket) are read synchronously
  // during render all over the app, so the admin-editable taxonomy is
  // loaded once into an in-memory cache here rather than fetched
  // per-component. Public data, no session required — also needed for
  // the signed-out shared-workout view.
  useEffect(() => {
    fetchMuscleTaxonomy().then(setMuscleTaxonomyCache).catch(() => {});
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      setSession(newSession);
      setMode("home");
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(undefined); return; }
    let cancelled = false;
    fetchProfile(session.user.id).then((p) => { if (!cancelled) setProfile(p); });
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
    if (resumeWorkout) setMode("workout");
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
  if (session === undefined) {
    content = null;
  } else if (!session) {
    content = <Auth />;
  } else if (passwordRecovery) {
    content = <ResetPassword onDone={() => setPasswordRecovery(false)} />;
  } else if (profile === undefined) {
    content = null;
  } else if (!profileComplete) {
    content = <Onboarding user={session.user} profile={profile} onComplete={() => fetchProfile(session.user.id).then(setProfile)} />;
  } else if (!profile.terms_accepted_at) {
    content = <TermsGate user={session.user} onAccepted={() => fetchProfile(session.user.id).then(setProfile)} />;
  } else if (!setupSeen) {
    content = <SetupWizard onComplete={() => setSetupSeen(true)} />;
  } else if (resumeWorkout === undefined) {
    content = null;
  } else {
    content = (
      <TutorialProvider>
        {mode === "workout" ? (
          <SetLogger
            user={session.user}
            resumeWorkout={resumeWorkout}
            onFinished={() => { setResumeWorkout(null); setMode("home"); }}
          />
        ) : (
          <Home
            user={session.user}
            onStartWorkout={() => { setResumeWorkout(null); setMode("workout"); }}
            onDataReset={() => setProfile(null)}
          />
        )}
        <TutorialOverlay />
      </TutorialProvider>
    );
  }

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
        </>
      )}
    </>
  );
}
