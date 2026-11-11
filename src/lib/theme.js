// Themes (v1.25.0). Every color in the app is authored against Iron (the
// original dark palette). A theme is a map from Iron hexes to its own,
// applied once at load: each `T` (shared or file-local) goes through
// themed() and each hardcoded hex through tc(). Switching saves the choice
// and reloads, which keeps module-level style constants correct without a
// refactor.
//
// Adding a theme: add an entry to THEMES with an id, name, blurb, `light`
// (true if the page is light, which flips line-art illustrations and the
// heatmap ramp), `preview` (the swatches the picker draws) and `map`
// (Iron hex -> new hex for each key in IRON_KEYS; anything unmapped stays
// Iron). It shows up in setup and Settings automatically.
//
// Stored per device in localStorage (not the synced prefs blob) so the
// first paint is right and a server sync can never flip it mid-session.

const THEME_KEY = "dl_theme";
const CHOSEN_KEY = "dl_theme_chosen";

// The Iron hexes a theme can remap, with what each one is for.
export const IRON_KEYS = {
  "#121418": "bg",
  "#1B1E23": "surface",
  "#24282E": "surface2",
  "#2F343B": "line",
  "#3B4049": "line2 / muted",
  "#4A4F57": "control border",
  "#575B61": "dashed border",
  "#1D2025": "inset",
  "#E6E3D9": "text",
  "#8F949C": "dim",
  "#A5A6A3": "soft text",
  "#BEBDB6": "label",
  "#CFCDC5": "strong label",
  "#C4A35A": "accent",
  "#8A6F33": "accent deep (borders)",
  "#D8BF83": "gold text (PRs)",
  "#3A3220": "gold tint",
  "#3F6E55": "spruce",
  "#6A9E80": "green",
  "#82AD93": "green text",
  "#1F3329": "green tint",
  "#D0614C": "danger",
  "#E08A78": "danger text",
  "#D9894A": "amber",
  "#363C46": "body map neutral",
  "#5A606B": "gray",
  "#5B6270": "gray",
  "#4A5261": "gray",
  "#6A6A64": "gray",
};

export const THEMES = [
  {
    id: "iron",
    name: "Iron",
    blurb: "Graphite, bone and gold",
    light: false,
    preview: { bg: "#121418", surface: "#1B1E23", line: "#2F343B", text: "#E6E3D9", dim: "#8F949C", accent: "#C4A35A", onAccent: "#121418", track: "#24282E", green: "#3F6E55" },
    map: {},
  },
  {
    id: "chalk",
    name: "Chalk",
    blurb: "Bone, black and bronze",
    light: true,
    preview: { bg: "#D9D5CA", surface: "#E4E0D6", line: "#BFB9AB", text: "#15171B", dim: "#4F5257", accent: "#6E5420", onAccent: "#D9D5CA", track: "#CDC8BB", green: "#335C46" },
    map: {
      "#121418": "#D9D5CA",
      "#1B1E23": "#E4E0D6",
      "#24282E": "#CDC8BB",
      "#2F343B": "#BFB9AB",
      "#3B4049": "#B2AC9D",
      "#4A4F57": "#9B9587",
      "#575B61": "#8E887B",
      "#1D2025": "#DEDAD0",
      "#E6E3D9": "#15171B",
      "#8F949C": "#4F5257",
      "#A5A6A3": "#45484C",
      "#BEBDB6": "#35383C",
      "#CFCDC5": "#2B2E32",
      "#C4A35A": "#6E5420",
      "#8A6F33": "#A8894A",
      "#D8BF83": "#634B1A",
      "#3A3220": "#D6C9A6",
      "#3F6E55": "#3F6E55",
      "#6A9E80": "#335C46",
      "#82AD93": "#2A5039",
      "#1F3329": "#C3D2C6",
      "#D0614C": "#9E3A27",
      "#E08A78": "#8E3322",
      "#D9894A": "#8A4719",
      "#363C46": "#BDB7A9",
      "#5A606B": "#8F897C",
      "#5B6270": "#8F897C",
      "#4A5261": "#A39D8F",
      "#6A6A64": "#7D786C",
    },
  },
];

const LEGACY = { dark: "iron", light: "chalk" }; // pre-release ids

function readTheme() {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    const id = LEGACY[raw] || raw;
    return THEMES.some((t) => t.id === id) ? id : "iron";
  } catch {
    return "iron";
  }
}

export const THEME = readTheme();
export const THEME_META = THEMES.find((t) => t.id === THEME);
export const IS_LIGHT = THEME_META.light;
const MAP = THEME_META.map;

// Maps one Iron color to the active theme. Use for hardcoded hexes.
export function tc(hex) {
  if (typeof hex !== "string") return hex;
  return MAP[hex.toUpperCase()] || hex;
}

// Maps every value of a palette object to the active theme.
export function themed(obj) {
  const out = {};
  for (const k of Object.keys(obj)) out[k] = tc(obj[k]);
  return out;
}

export const T = themed({
  bg: "#121418",
  surface: "#1B1E23",
  surface2: "#24282E",
  line: "#2F343B",
  text: "#E6E3D9",
  dim: "#8F949C",
  accent: "#C4A35A",
  green: "#6A9E80",
  danger: "#D0614C",
  accentDeep: "#8A6F33",
  spruce: "#3F6E55",
});

export function themeChosen() {
  try {
    return localStorage.getItem(CHOSEN_KEY) === "1";
  } catch {
    return true; // storage blocked: never trap anyone on the picker
  }
}

// Saves the choice and reloads if it changed. Returns true when a reload
// is under way, so callers can skip work that would be thrown away.
export function setTheme(id, { reload = true } = {}) {
  const next = THEMES.some((t) => t.id === id) ? id : "iron";
  try {
    localStorage.setItem(THEME_KEY, next);
    localStorage.setItem(CHOSEN_KEY, "1");
  } catch {
    // ignore
  }
  if (reload && next !== THEME) {
    window.location.reload();
    return true;
  }
  return false;
}
