// Back gesture / back button support (v1.14.3).
//
// In an installed PWA, Android's back gesture is browser history "back".
// DeltaLog never pushed history entries, so back had nothing to go back
// to and closed the app. This keeps exactly one spare history entry
// ("guard") while anything is open (a sheet, a sub-screen, the workout
// screen) and turns a back press into "close the top-most thing":
//
//  - Screens register with useBackLayer(depth, onBack, priority):
//    `depth` is how many closeable layers they currently have open,
//    `onBack` closes their top-most one. Higher priority wins (overlays
//    inside a screen sit above the screen itself).
//  - When anything opens and no guard is armed, one entry is pushed.
//  - A back press consumes the guard; the top-most open layer closes,
//    and the guard is re-armed if something is still open.
//  - When everything is closed via the UI, the spare entry is removed
//    after a short pause, so back on Home exits the app as expected.
//
// iOS has no system back gesture for home-screen apps, so this mainly
// matters on Android; it's harmless everywhere else.
import { useEffect, useRef } from "react";

const owners = new Set(); // { priority, depthRef, onBackRef }
let armed = false;
let ignorePops = 0;
let cleanupTimer = null;
let listening = false;

function openOwners() {
  return [...owners].filter((o) => (o.depthRef.current || 0) > 0).sort((a, b) => b.priority - a.priority);
}

function sync() {
  clearTimeout(cleanupTimer);
  if (openOwners().length > 0) {
    if (!armed) {
      try { window.history.pushState({ deltalogBack: true }, ""); armed = true; } catch { /* ignore */ }
    }
  } else if (armed) {
    cleanupTimer = setTimeout(() => {
      if (openOwners().length === 0 && armed) {
        armed = false;
        ignorePops += 1;
        try { window.history.back(); } catch { ignorePops -= 1; }
      }
    }, 400);
  }
}

function onPopState() {
  if (ignorePops > 0) { ignorePops -= 1; return; }
  armed = false;
  const top = openOwners()[0];
  if (top) top.onBackRef.current();
  // Let React apply the close, then re-arm if anything is still open.
  setTimeout(sync, 60);
}

function ensureListener() {
  if (listening || typeof window === "undefined") return;
  window.addEventListener("popstate", onPopState);
  listening = true;
}

export function useBackLayer(depth, onBack, priority = 0) {
  const depthRef = useRef(depth);
  const onBackRef = useRef(onBack);
  depthRef.current = depth;
  onBackRef.current = onBack;

  useEffect(() => {
    ensureListener();
    const owner = { priority, depthRef, onBackRef };
    owners.add(owner);
    return () => { owners.delete(owner); sync(); };
  }, [priority]);

  useEffect(() => { sync(); }, [depth]);
}
