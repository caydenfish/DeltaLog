import { useState, useEffect, useMemo } from "react";
import {
  fetchMuscleDetailed,
  fetchBodyMapRegionMuscles,
  addBodyMapRegionMuscle,
  removeBodyMapRegionMuscle,
} from "./lib/queries";
import { setBodyMapRegionCache } from "./lib/bodyMapRegions";
import { FRONT_REGIONS, BACK_REGIONS, OUTLINE_FRONT, OUTLINE_BACK, VIEWBOX_FRONT, VIEWBOX_BACK } from "./lib/bodyMapData";
import { InlineLoading } from "./LoadingSpinner";
import { IconX, IconSearch } from "./Icons";

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

const NEUTRAL = "#363C46";
const ASSIGNED = "#3BA55D";
const SELECTED = "#E8442E";
const OUTLINE_STROKE = "#4A5261";

// Friendly display name per region slug -- deltoids splits front/back
// into different real body parts, same special case BodyMap.jsx's own
// displayName() handles.
const SLUG_NAMES = {
  chest: "Chest",
  obliques: "Obliques",
  abs: "Abs",
  biceps: "Biceps",
  triceps: "Triceps",
  neck: "Neck",
  trapezius: "Traps",
  adductors: "Adductors",
  quadriceps: "Quads",
  tibialis: "Shins",
  calves: "Calves",
  forearm: "Forearms",
  "upper-back": "Upper back",
  "lower-back": "Lower back",
  gluteal: "Glutes",
  hamstring: "Hamstrings",
};
function displayName(view, slug) {
  if (slug === "deltoids") return view === "front" ? "Front / side delts" : "Rear delts";
  return SLUG_NAMES[slug] || slug;
}

// Which of the FRONT_REGIONS/BACK_REGIONS slugs are real muscles worth
// mapping -- excludes the cosmetic body parts (hands, feet, ankles,
// knees, head, hair) same as bodyMapRegions.js/REGION_GENERIC already do.
const REAL_SLUGS = new Set([
  "chest", "obliques", "abs", "biceps", "triceps", "neck", "trapezius", "deltoids",
  "adductors", "quadriceps", "tibialis", "forearm", "upper-back", "lower-back",
  "gluteal", "hamstring", "calves",
]);

// Admin tool: explicitly tells the app which muscle(s) each body-map
// silhouette region correlates to -- the editable version of what used
// to be a hardcoded JS map (lib/bodyMapRegions.js's REGION_MAP), backed
// by the body_map_region_muscles table (migration_070). Tap a region
// directly on the actual silhouette to select it, then add/remove which
// Detailed-tier muscles light it up from the panel below. Every
// add/remove re-fetches and pushes the fresh rows into the live
// app-wide cache (setBodyMapRegionCache) so the change takes effect on
// every body map in the app immediately, no reload needed.
export default function AdminBodyMapRegionEditor({ onClose }) {
  const [muscles, setMuscles] = useState(null); // [{key, label, generic_group}]
  const [rows, setRows] = useState(null); // [{view, slug, muscleKey, muscleLabel}]
  const [view, setView] = useState("front");
  const [selectedSlug, setSelectedSlug] = useState(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function reload() {
    return Promise.all([fetchMuscleDetailed(), fetchBodyMapRegionMuscles()]).then(([m, r]) => {
      setMuscles(m);
      setRows(r);
      setBodyMapRegionCache(r);
    });
  }

  useEffect(() => { reload().catch((err) => setError(err.message)); }, []);

  const regionsByKey = useMemo(() => {
    const map = new Map();
    for (const r of rows || []) {
      const key = `${r.view}:${r.slug}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    return map;
  }, [rows]);

  const regions = view === "front" ? FRONT_REGIONS : BACK_REGIONS;
  const outline = view === "front" ? OUTLINE_FRONT : OUTLINE_BACK;
  const viewBox = view === "front" ? VIEWBOX_FRONT : VIEWBOX_BACK;

  const selectedRows = selectedSlug ? (regionsByKey.get(`${view}:${selectedSlug}`) || []) : [];
  const selectedKeys = new Set(selectedRows.map((r) => r.muscleKey));

  const candidates = (muscles || [])
    .filter((m) => !selectedKeys.has(m.key))
    .filter((m) => !search.trim() || m.label.toLowerCase().includes(search.trim().toLowerCase()))
    .slice(0, 12);

  async function handleAdd(muscleKey) {
    if (!selectedSlug || busy) return;
    setBusy(true);
    try {
      await addBodyMapRegionMuscle(view, selectedSlug, muscleKey);
      await reload();
      setSearch("");
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function handleRemove(muscleKey) {
    if (!selectedSlug || busy) return;
    setBusy(true);
    try {
      await removeBodyMapRegionMuscle(view, selectedSlug, muscleKey);
      await reload();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  const loading = muscles === null || rows === null;

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 30, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 420, minHeight: "100vh", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8, position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 13 }}>&#8249;</button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.text, textAlign: "center" }}>BODY MAP REGIONS</div>
          <div style={{ width: 26 }} />
        </div>

        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><InlineLoading /></div>
        ) : (
          <div style={{ padding: 16, flex: 1, boxSizing: "border-box" }}>
            {error && <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: T.surface2, border: `1px solid ${T.accent}`, color: T.accent, fontSize: 13 }}>{error}</div>}

            <div style={{ color: T.dim, fontSize: 11.5, marginBottom: 14, lineHeight: 1.4 }}>
              Tap a region on the silhouette, then add or remove which muscles light it up. Takes effect everywhere immediately.
            </div>

            <div style={{ display: "flex", background: T.surface2, borderRadius: 10, padding: 3, gap: 3, marginBottom: 14 }}>
              {["front", "back"].map((v) => (
                <button
                  key={v}
                  onClick={() => { setView(v); setSelectedSlug(null); }}
                  aria-pressed={view === v}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 12.5, fontWeight: 600, border: "none", textTransform: "capitalize", background: view === v ? T.accent : "transparent", color: view === v ? "#fff" : T.dim }}
                >
                  {v}
                </button>
              ))}
            </div>

            <svg viewBox={viewBox} width="100%" style={{ maxWidth: 220, display: "block", margin: "0 auto 16px" }}>
              <path d={outline} fill="none" stroke={OUTLINE_STROKE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
              {regions.filter((r) => REAL_SLUGS.has(r.slug)).map((region) => {
                const assigned = (regionsByKey.get(`${view}:${region.slug}`) || []).length > 0;
                const isSelected = selectedSlug === region.slug;
                const fill = isSelected ? SELECTED : assigned ? ASSIGNED : NEUTRAL;
                return (
                  <g key={region.slug} onClick={() => setSelectedSlug(region.slug)} style={{ cursor: "pointer" }}>
                    {region.paths.map((d, i) => (
                      <path key={i} d={d} fill={fill} vectorEffect="non-scaling-stroke">
                        <title>{displayName(view, region.slug)}</title>
                      </path>
                    ))}
                  </g>
                );
              })}
            </svg>

            <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: ASSIGNED, display: "inline-block" }} />
                <span style={{ fontSize: 10.5, color: T.dim }}>Has muscles</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: NEUTRAL, display: "inline-block" }} />
                <span style={{ fontSize: 10.5, color: T.dim }}>Unassigned</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: SELECTED, display: "inline-block" }} />
                <span style={{ fontSize: 10.5, color: T.dim }}>Selected</span>
              </div>
            </div>

            {selectedSlug ? (
              <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 10 }}>{displayName(view, selectedSlug)}</div>

                <div style={{ fontSize: 10.5, color: T.dim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Muscles ({selectedRows.length})</div>
                {selectedRows.length === 0 ? (
                  <div style={{ color: T.dim, fontSize: 12.5, fontStyle: "italic", marginBottom: 14 }}>No muscles assigned yet.</div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                    {selectedRows.map((r) => (
                      <div key={r.muscleKey} style={{ display: "flex", alignItems: "center", gap: 5, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 999, padding: "5px 6px 5px 10px" }}>
                        <span style={{ fontSize: 12.5, color: T.text }}>{r.muscleLabel || r.muscleKey}</span>
                        <button onClick={() => handleRemove(r.muscleKey)} disabled={busy} aria-label={`Remove ${r.muscleLabel}`} style={{ background: "none", border: "none", color: T.dim, padding: 2, display: "flex" }}>
                          <IconX size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ fontSize: 10.5, color: T.dim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Add a muscle</div>
                <div style={{ position: "relative", marginBottom: 8 }}>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search muscles…"
                    style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "9px 12px 9px 32px", outline: "none", boxSizing: "border-box" }}
                  />
                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.dim, display: "flex" }}><IconSearch size={14} /></span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto" }}>
                  {candidates.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => handleAdd(m.key)}
                      disabled={busy}
                      style={{ width: "100%", textAlign: "left", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px", color: T.text, fontSize: 13 }}
                    >
                      {m.label} <span style={{ color: T.dim, fontSize: 11 }}>({m.generic_group})</span>
                    </button>
                  ))}
                  {candidates.length === 0 && (
                    <div style={{ color: T.dim, fontSize: 12, fontStyle: "italic", padding: "6px 2px" }}>No matches.</div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "20px 0" }}>Tap a region above to edit it.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
