// Optional artwork for the intro and setup screens (v1.19.0).
//
// Drop licensed files into public/onboarding/ and point these at them,
// e.g. strength: "/onboarding/strength.svg". Anything left null simply
// isn't shown, so the flow looks complete with or without art.
// Single-color silhouettes work best: they're tinted to the theme with
// CSS (filter on light-on-dark), so export them as black on transparent.
export const ILLUSTRATIONS = {
  welcome: null,     // hero above the headline on the welcome screen
  strength: null,    // training goal card
  hypertrophy: null, // training goal card
  endurance: null,   // training goal card
  body: null,        // "Your body" step header
  finish: null,      // finish screen
};
