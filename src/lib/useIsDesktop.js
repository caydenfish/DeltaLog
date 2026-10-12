import { useEffect, useState } from "react";

// Desktop layout (v1.18.0) kicks in at 1024px and up. Below that the app
// is exactly the phone layout it has always been. Tracked live, so
// resizing a browser window or rotating a tablet switches over cleanly.
export const DESKTOP_QUERY = "(min-width: 1024px)";

export function useIsDesktop() {
  const get = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(DESKTOP_QUERY).matches;
  const [isDesktop, setIsDesktop] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  return isDesktop;
}
