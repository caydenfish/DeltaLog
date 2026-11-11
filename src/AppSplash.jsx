import { useEffect, useState } from "react";
import { themed } from "./lib/theme";
import Logo from "./Logo";

const T = themed({ bg: "#121418" });

// MIN_LOADING_MS keeps the splash from flashing by for a single frame on
// a fast/cached load. FADE_MS is the hand-off to the app.
const MIN_LOADING_MS = 550;
const FADE_MS = 320;

// Shown while App.jsx is still resolving session/profile/setup/resume
// state (v1.28.0): the logo sits still, glitching every few seconds
// (Logo `live`), then the whole splash fades out once `ready` flips. The
// old barbell-stretch / grid-horizon / split reveal is gone.
export default function AppSplash({ ready }) {
  const [phase, setPhase] = useState("loading"); // loading -> fade -> done
  const [mountedAt] = useState(() => Date.now());

  useEffect(() => {
    if (!ready || phase !== "loading") return;
    const wait = Math.max(0, MIN_LOADING_MS - (Date.now() - mountedAt));
    const t = setTimeout(() => setPhase("fade"), wait);
    return () => clearTimeout(t);
  }, [ready, phase, mountedAt]);

  useEffect(() => {
    if (phase !== "fade") return;
    const t = setTimeout(() => setPhase("done"), FADE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: T.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        opacity: phase === "fade" ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
    >
      <Logo size={168} live />
    </div>
  );
}
