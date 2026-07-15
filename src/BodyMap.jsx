import { useState } from "react";
import { FRONT_REGIONS, BACK_REGIONS, OUTLINE_FRONT, OUTLINE_BACK, VIEWBOX_FRONT, VIEWBOX_BACK } from "./lib/bodyMapData";
import { resolveRegions } from "./lib/bodyMapRegions";

const T = {
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

// Untrained-region fill — a touch lighter than the card border so the
// silhouette's muscle segments stay visible even at zero volume.
const NEUTRAL = "#363C46";
const OUTLINE_STROKE = "#4A5261";
const DIM_ACCENT = "#5B2E28"; // floor of the intensity scale, so even a single logged set reads as visibly trained rather than washed out

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

function mixHex(hex1, hex2, t) {
  const c1 = parseInt(hex1.slice(1), 16);
  const c2 = parseInt(hex2.slice(1), 16);
  const r = Math.round(((c1 >> 16) & 255) + ((((c2 >> 16) & 255) - ((c1 >> 16) & 255)) * t));
  const g = Math.round(((c1 >> 8) & 255) + ((((c2 >> 8) & 255) - ((c1 >> 8) & 255)) * t));
  const b = Math.round((c1 & 255) + (((c2 & 255) - (c1 & 255)) * t));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function intensityColor(total, max) {
  if (!total) return NEUTRAL;
  const t = 0.3 + 0.7 * Math.min(1, total / (max || 1));
  return mixHex(DIM_ACCENT, T.accent, t);
}

// Sums primary/secondary set-count maps (already at the Detailed taxonomy
// tier -- see BodyHeatmap's call site) into per-region totals, keyed
// "view:slug" since a few slugs (deltoids, trapezius, etc.) exist on
// both the front and back art independently.
function buildRegionTotals(primary, secondary) {
  const totals = {};
  function add(map, role) {
    for (const [label, count] of Object.entries(map)) {
      if (!count) continue;
      for (const { view, slug } of resolveRegions(label)) {
        const key = `${view}:${slug}`;
        if (!totals[key]) totals[key] = { primary: 0, secondary: 0 };
        totals[key][role] += count;
      }
    }
  }
  add(primary, "primary");
  add(secondary, "secondary");
  return totals;
}

function Silhouette({ view, regions, outline, viewBox, totals, maxTotal, selected, onSelect }) {
  return (
    <svg viewBox={viewBox} width="100%" style={{ maxWidth: 150, display: "block", margin: "0 auto" }}>
      <path d={outline} fill="none" stroke={OUTLINE_STROKE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {regions.map((region) => {
        const key = `${view}:${region.slug}`;
        const t = totals[key] || { primary: 0, secondary: 0 };
        const total = t.primary + t.secondary;
        const isSelected = selected && selected.view === view && selected.slug === region.slug;
        return (
          <g
            key={region.slug}
            onClick={() => onSelect({ view, slug: region.slug, ...t, total })}
            style={{ cursor: "pointer" }}
          >
            {region.paths.map((d, i) => (
              <path
                key={i}
                d={d}
                fill={intensityColor(total, maxTotal)}
                stroke={isSelected ? T.text : "none"}
                strokeWidth={isSelected ? 3 : 0}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// Anatomical body-map heatmap: front + back silhouette, each muscle
// region tinted by how many sets it's taken (a dim red floor for any
// nonzero count up to full accent at the highest-volume region), tap a
// region to see its exact count below. Always computed at the Detailed
// taxonomy tier regardless of the app's Muscle Names preference — that's
// the level of resolution the underlying art is actually drawn at (see
// lib/bodyMapData.js's adaptation notes); Generic/Scientific-mode users
// still get this view, it just doesn't collapse or split any further
// than Detailed. `primary`/`secondary` here are Detailed-tier maps
// specifically (not whatever mode the caller's other chart views use).
export default function BodyMap({ primary = {}, secondary = {} }) {
  const [selected, setSelected] = useState(null);
  const totals = buildRegionTotals(primary, secondary);
  const maxTotal = Math.max(1, ...Object.values(totals).map((t) => t.primary + t.secondary));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <Silhouette view="front" regions={FRONT_REGIONS} outline={OUTLINE_FRONT} viewBox={VIEWBOX_FRONT} totals={totals} maxTotal={maxTotal} selected={selected} onSelect={setSelected} />
        <Silhouette view="back" regions={BACK_REGIONS} outline={OUTLINE_BACK} viewBox={VIEWBOX_BACK} totals={totals} maxTotal={maxTotal} selected={selected} onSelect={setSelected} />
      </div>
      <div style={{ textAlign: "center", marginTop: 10, fontSize: 12.5, minHeight: 18 }}>
        {selected ? (
          <span style={{ color: T.text }}>
            <span style={{ fontWeight: 700 }}>{displayName(selected.view, selected.slug)}</span>
            <span style={{ color: T.dim }}> — {selected.total} set{selected.total === 1 ? "" : "s"}{selected.total > 0 ? ` (${selected.primary} primary, ${selected.secondary} secondary)` : ""}</span>
          </span>
        ) : (
          <span style={{ color: T.dim }}>Tap a muscle to see its set count</span>
        )}
      </div>
    </div>
  );
}
