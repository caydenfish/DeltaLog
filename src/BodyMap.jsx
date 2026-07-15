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

// Four fixed, visually distinct steps rather than a continuous gradient —
// a continuous fade makes it hard to tell "this region is a little
// behind" from "this region is way behind" at a glance, which was the
// whole point of the color coding. Each region snaps to whichever step
// its share of the best-trained region's volume falls into.
const TIERS = [
  { key: "none", label: "None", color: NEUTRAL, max: 0 },
  { key: "low", label: "Low", color: "#7A3A2E", max: 1 / 3 },
  { key: "moderate", label: "Moderate", color: "#C24230", max: 2 / 3 },
  { key: "high", label: "High", color: T.accent, max: Infinity },
];

function tierFor(total, max) {
  if (!total) return TIERS[0];
  const frac = total / (max || 1);
  if (frac <= TIERS[1].max) return TIERS[1];
  if (frac <= TIERS[2].max) return TIERS[2];
  return TIERS[3];
}

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

function Silhouette({ view, regions, outline, viewBox, totals, maxTotal }) {
  return (
    <svg viewBox={viewBox} width="100%" style={{ maxWidth: 150, display: "block", margin: "0 auto" }}>
      <path d={outline} fill="none" stroke={OUTLINE_STROKE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {regions.map((region) => {
        const key = `${view}:${region.slug}`;
        const t = totals[key] || { primary: 0, secondary: 0 };
        const total = t.primary + t.secondary;
        const tier = tierFor(total, maxTotal);
        return (
          <g key={region.slug}>
            {region.paths.map((d, i) => (
              <path key={i} d={d} fill={tier.color} vectorEffect="non-scaling-stroke">
                <title>{`${displayName(view, region.slug)} — ${total} set${total === 1 ? "" : "s"} (${tier.label})`}</title>
              </path>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// Anatomical body-map heatmap: front + back silhouette, each muscle
// region shaded into one of four fixed volume tiers (see TIERS above) so
// it's obvious at a glance which regions are lagging, without the noise
// of a continuous gradient. Purely visual/view-only now — exact counts,
// tap-to-drill-in, and "what's lacking" all live in the Coverage
// breakdown list below it (BodyHeatmap.jsx), which is now the only place
// selection/interaction happens (the old white selection outline here is
// gone along with the tap handling). Always computed at the Detailed
// taxonomy tier regardless of the app's Muscle Names preference — that's
// the level of resolution the underlying art is actually drawn at (see
// lib/bodyMapData.js's adaptation notes).
export default function BodyMap({ primary = {}, secondary = {} }) {
  const totals = buildRegionTotals(primary, secondary);
  const maxTotal = Math.max(1, ...Object.values(totals).map((t) => t.primary + t.secondary));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <Silhouette view="front" regions={FRONT_REGIONS} outline={OUTLINE_FRONT} viewBox={VIEWBOX_FRONT} totals={totals} maxTotal={maxTotal} />
        <Silhouette view="back" regions={BACK_REGIONS} outline={OUTLINE_BACK} viewBox={VIEWBOX_BACK} totals={totals} maxTotal={maxTotal} />
      </div>
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
        {TIERS.map((t) => (
          <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: t.color, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: 10.5, color: T.dim }}>{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
