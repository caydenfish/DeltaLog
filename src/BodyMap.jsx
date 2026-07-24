import { FRONT_REGIONS, BACK_REGIONS, OUTLINE_FRONT, OUTLINE_BACK, VIEWBOX_FRONT, VIEWBOX_BACK } from "./lib/bodyMapData";
import { resolveRegions } from "./lib/bodyMapRegions";
import { statusColorFor, PLAN_NEUTRAL } from "./lib/planStatus";
import { getDetailedTaxonomyEntries } from "./lib/muscleNomenclature";

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

// Maps each real anatomical region slug (see lib/bodyMapData.js) to the
// broad generic-tier muscle group (lib/muscleColors.js's 8-value
// taxonomy) it belongs to -- needed for "My Plan" mode, where targets
// are set at the generic-bucket level (nobody sets a weekly target for
// "Upper Traps" specifically) but the body-map art is drawn at a finer
// anatomical resolution. Cosmetic slugs (knees, hands, ankles, feet,
// head, hair) are deliberately absent, same as bodyMapRegions.js.
const REGION_GENERIC = {
  chest: "Chest",
  obliques: "Core",
  abs: "Core",
  biceps: "Arms",
  triceps: "Arms",
  neck: "Neck",
  trapezius: "Back",
  deltoids: "Shoulders",
  adductors: "Legs",
  quadriceps: "Legs",
  tibialis: "Legs",
  calves: "Legs",
  forearm: "Arms",
  "upper-back": "Back",
  "lower-back": "Back",
  gluteal: "Legs",
  hamstring: "Legs",
};

// Plan mode's equivalent of intensity mode's buildRegionTotals, for when
// weekly-set-goal targets are tracked at Region resolution instead of
// Category's 8 fixed buckets (see muscleNomenclature.js's
// getMuscleGroupOptions, which -- same reasoning as there -- treats
// Region and Anatomy identically, both at Region tier, never Anatomy's
// finer scientific names). REGION_GENERIC above only has one answer per
// anatomical slug, which is right for Category mode but not for Region
// tier, where (same as intensity mode) a single visual patch can be
// shared by more than one taxonomy entry: "Lats" and "Upper Back" both
// shade the one back patch the SVG art has for it, so a Region-mode
// silhouette needs to know both keys contribute there. Built once per
// mode rather than per region -- cheap (a few dozen entries), and keeps
// Silhouette itself from repeating the taxonomy walk per region rendered.
function buildRegionKeyMap() {
  const map = {};
  for (const e of getDetailedTaxonomyEntries()) {
    for (const { view, slug } of resolveRegions(e.detailed)) {
      const key = `${view}:${slug}`;
      if (!map[key]) map[key] = new Set();
      map[key].add(e.detailed);
    }
  }
  return map;
}

// Four fixed, visually distinct steps rather than a continuous gradient —
// a continuous fade makes it hard to tell "this region is a little
// behind" from "this region is way behind" at a glance, which was the
// whole point of the color coding. Each region snaps to whichever step
// its share of the best-trained region's volume falls into. Deliberately
// spans different hues (gray -> gold -> orange -> red) rather than
// shades of one color — three shades of brownish-red read as nearly
// identical at small sizes on a phone screen, so the tiers need to
// differ in hue, not just brightness.
const TIERS = [
  { key: "none", label: "None", color: NEUTRAL, max: 0 },
  { key: "low", label: "Low", color: "#C9A227", max: 1 / 3 },
  { key: "moderate", label: "Moderate", color: "#E8752E", max: 2 / 3 },
  { key: "high", label: "High", color: T.accent, max: Infinity },
];

// Turns TIERS' fixed fractional cutoffs (1/3, 2/3, above) into the
// current data's actual set-count boundaries, so the legend reads real
// numbers ("1-4", "9-12") instead of the qualitative "Low/Moderate/High"
// words it used to -- maxTotal is the exact same value already driving
// tierFor()'s bucketing below, so the legend always matches precisely
// what's coloring the silhouette: the highest tier's top number is
// always the actual busiest region's real set count, and the lowest
// tier's numbers are always the smallest logged counts.
function intensityTierLegend(maxTotal) {
  const lowMax = Math.max(1, Math.floor(maxTotal / 3));
  const modMax = Math.max(lowMax + 1, Math.floor((maxTotal * 2) / 3));
  const hiMin = Math.min(maxTotal, modMax + 1);
  return [
    { key: "none", color: NEUTRAL, label: "0" },
    { key: "low", color: "#C9A227", label: lowMax === 1 ? "1" : `1–${lowMax}` },
    { key: "moderate", color: "#E8752E", label: modMax === lowMax + 1 ? `${modMax}` : `${lowMax + 1}–${modMax}` },
    { key: "high", color: T.accent, label: hiMin === maxTotal ? `${maxTotal}` : `${hiMin}–${maxTotal}` },
  ];
}

const PLAN_TIERS = [
  { key: "none", label: "Not started", color: PLAN_NEUTRAL },
  { key: "under", label: "Under target", color: "#E8752E" },
  { key: "met", label: "Target met", color: "#3BA55D" },
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
// both the front and back art independently. Also keeps a per-region
// labelsByRole breakdown (which exact detailed labels contributed, and
// how many sets each) -- the fixed SVG art has fewer distinct shapes
// than the Detailed taxonomy has labels (e.g. "Lats" and "Upper Back"
// are two different labels that both shade the same back patch, since
// there's only one shape there), so a region's total can genuinely
// include more than the one muscle someone associates with that part of
// the silhouette. The breakdown is what lets the tooltip say so instead
// of just showing an unexplained number.
function buildRegionTotals(primary, secondary) {
  const totals = {};
  function add(map, role) {
    for (const [label, count] of Object.entries(map)) {
      if (!count) continue;
      for (const { view, slug } of resolveRegions(label)) {
        const key = `${view}:${slug}`;
        if (!totals[key]) totals[key] = { primary: 0, secondary: 0, labelsByRole: { primary: {}, secondary: {} } };
        totals[key][role] += count;
        totals[key].labelsByRole[role][label] = (totals[key].labelsByRole[role][label] || 0) + count;
      }
    }
  }
  add(primary, "primary");
  add(secondary, "secondary");
  return totals;
}

// Combines a region's per-label breakdown down to whichever role(s) the
// Muscles criteria currently includes, so the tooltip's breakdown always
// adds up to exactly the same total number being displayed/colored.
function labelBreakdown(t, roleFilter) {
  const combined = {};
  const addFrom = (map) => { for (const [label, count] of Object.entries(map || {})) combined[label] = (combined[label] || 0) + count; };
  if (roleFilter !== "secondary") addFrom(t.labelsByRole?.primary);
  if (roleFilter !== "primary") addFrom(t.labelsByRole?.secondary);
  return combined;
}

// Collapses a region's { primary, secondary } split down to the single
// number intensity mode colors and sizes tiers against, per the Muscles
// criteria (Primary only / Secondary only / both combined -- the
// default, matching prior behavior for any caller that doesn't pass one,
// e.g. SetLogger's live heatmap and Templates' Coverage panel).
function roleTotal(t, roleFilter) {
  if (roleFilter === "primary") return t.primary;
  if (roleFilter === "secondary") return t.secondary;
  return t.primary + t.secondary;
}

function Silhouette({ view, regions, outline, viewBox, totals, maxTotal, mode, targets, rollingTotals, roleFilter, planNameMode, regionKeyMap }) {
  return (
    <svg viewBox={viewBox} width="100%" style={{ maxWidth: 150, display: "block", margin: "0 auto" }}>
      <path d={outline} fill="none" stroke={OUTLINE_STROKE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {regions.map((region) => {
        if (mode === "plan") {
          let total = 0, target = 0, hasKeys = false, label;
          if (planNameMode === "generic" || !planNameMode) {
            const generic = REGION_GENERIC[region.slug];
            hasKeys = !!generic;
            target = generic ? (targets?.[generic] || 0) : 0;
            total = generic ? (rollingTotals?.[generic] || 0) : 0;
            label = generic ? `${generic} — ${total}/${target} sets this week` : displayName(view, region.slug);
          } else {
            const keys = regionKeyMap?.[`${view}:${region.slug}`];
            hasKeys = !!(keys && keys.size > 0);
            if (hasKeys) {
              const parts = [];
              for (const k of keys) {
                const t = rollingTotals?.[k] || 0;
                const g = targets?.[k] || 0;
                total += t;
                target += g;
                parts.push(`${k} ${t}/${g}`);
              }
              label = keys.size > 1
                ? `${displayName(view, region.slug)} — ${total}/${target} sets this week (${parts.join(", ")})`
                : `${[...keys][0]} — ${total}/${target} sets this week`;
            } else {
              label = displayName(view, region.slug);
            }
          }
          const color = hasKeys ? statusColorFor(total, target) : PLAN_NEUTRAL;
          return (
            <g key={region.slug}>
              {region.paths.map((d, i) => (
                <path key={i} d={d} fill={color} vectorEffect="non-scaling-stroke">
                  <title>{label}</title>
                </path>
              ))}
            </g>
          );
        }
        const key = `${view}:${region.slug}`;
        const t = totals[key] || { primary: 0, secondary: 0, labelsByRole: { primary: {}, secondary: {} } };
        const total = roleTotal(t, roleFilter);
        const tier = tierFor(total, maxTotal);
        const breakdown = labelBreakdown(t, roleFilter);
        const breakdownEntries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
        // Only worth spelling out when more than one label is actually
        // sharing this patch -- a region fed by just one muscle already
        // says everything the breakdown would, via displayName above.
        const breakdownText = breakdownEntries.length > 1
          ? ` — ${breakdownEntries.map(([label, count]) => `${label} ${count}`).join(", ")}`
          : "";
        return (
          <g key={region.slug}>
            {region.paths.map((d, i) => (
              <path key={i} d={d} fill={tier.color} vectorEffect="non-scaling-stroke">
                <title>{`${displayName(view, region.slug)} — ${total} set${total === 1 ? "" : "s"} (${tier.label})${breakdownText}`}</title>
              </path>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// Anatomical body-map heatmap: front + back silhouette, either shaded
// into one of four fixed volume tiers (mode="intensity", the default —
// see TIERS above) so it's obvious at a glance which regions are
// lagging relative to your other muscles, or (mode="plan") colored
// against your Weekly Set Goals targets instead — gray/orange/green
// per muscle group, same status-color logic as the Weekly Set Goals
// module itself (lib/planStatus.js). Purely visual/view-only either
// way — exact counts, tap-to-drill-in, and "what's lacking" all live in
// the Coverage breakdown list below it (BodyHeatmap.jsx). Intensity
// mode is always computed at the Detailed taxonomy tier regardless of
// the app's Muscle Names preference — that's the level of resolution
// the underlying art is actually drawn at (see lib/bodyMapData.js's
// adaptation notes). Plan mode's `planNameMode` ("generic" | "detailed"
// | "scientific", default "generic") controls which tier `targets`/
// `rollingTotals` are keyed at, matching whatever WeeklySetGoals.jsx's
// getMuscleGroupOptions is currently tracking -- generic mode resolves
// each region to its one Category bucket via REGION_GENERIC (unchanged
// from before); detailed/scientific mode instead aggregates every
// Region/Anatomy-tier key sharing that region (buildRegionKeyMap), since
// (same as intensity mode) the fixed SVG art has fewer shapes than the
// finer tiers have labels.
export default function BodyMap({ primary = {}, secondary = {}, mode = "intensity", targets, rollingTotals, roleFilter = "both", planNameMode = "generic" }) {
  const totals = mode === "plan" ? {} : buildRegionTotals(primary, secondary);
  const maxTotal = mode === "plan" ? 1 : Math.max(1, ...Object.values(totals).map((t) => roleTotal(t, roleFilter)));
  const regionKeyMap = mode === "plan" && planNameMode !== "generic" ? buildRegionKeyMap() : null;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <Silhouette view="front" regions={FRONT_REGIONS} outline={OUTLINE_FRONT} viewBox={VIEWBOX_FRONT} totals={totals} maxTotal={maxTotal} mode={mode} targets={targets} rollingTotals={rollingTotals} roleFilter={roleFilter} planNameMode={planNameMode} regionKeyMap={regionKeyMap} />
        <Silhouette view="back" regions={BACK_REGIONS} outline={OUTLINE_BACK} viewBox={VIEWBOX_BACK} totals={totals} maxTotal={maxTotal} mode={mode} targets={targets} rollingTotals={rollingTotals} roleFilter={roleFilter} planNameMode={planNameMode} regionKeyMap={regionKeyMap} />
      </div>
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
        {(mode === "plan" ? PLAN_TIERS : intensityTierLegend(maxTotal)).map((t) => (
          <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: t.color, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: 10.5, color: T.dim }}>{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
