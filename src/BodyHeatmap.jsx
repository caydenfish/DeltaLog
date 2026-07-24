import { useState } from "react";
import { computeMuscleSetCounts } from "./lib/volume";
import { getDetailedTaxonomyEntries } from "./lib/muscleNomenclature";
import { IconChevronUp, IconChevronDown } from "./Icons";
import BodyMap from "./BodyMap";

const T = {
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

const SETS_FILTER_OPTIONS = [
  { key: "working", label: "Working" },
  { key: "warmup", label: "Warm-up" },
  { key: "both", label: "Both" },
];

const ROLE_FILTER_OPTIONS = [
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "both", label: "Both" },
];

// One labeled row of 3 mutually-exclusive segmented buttons -- shared
// shape for both the Sets and Muscles criteria pickers below, just fed
// different option lists. Styled as a single bordered track (matching
// the Individual/One-for-all switcher in WeeklySetGoals.jsx) rather than
// 3 separate bordered buttons, so the group reads as one control instead
// of 3 small disconnected pills -- and stretches to the module's full
// width either way, via flex:1 on each segment.
function FilterRow({ label, options, value, onChange }) {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ fontSize: 9.5, color: T.dim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>{label}</div>
      <div style={{ display: "flex", width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 9, padding: 3, gap: 3, boxSizing: "border-box" }}>
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            aria-pressed={value === o.key}
            style={{
              flex: 1,
              minWidth: 0,
              background: value === o.key ? T.accent : "transparent",
              border: "none",
              borderRadius: 7,
              padding: "7px 0",
              fontSize: 11.5,
              fontWeight: 600,
              color: value === o.key ? "#fff" : T.dim,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// The old plain-language breakdown list, now living behind a disclosure
// below the chart instead of being a chart in its own right — it lists
// every muscle in the Detailed taxonomy, not just the ones with logged
// sets, specifically so a muscle group that's gotten nothing in this
// range still shows up (as "Not trained yet") instead of just silently
// not appearing anywhere. Tapping a trained row opens the same
// MuscleSetsDetail drill-in the body map used to. Always shows both the
// primary and secondary count regardless of the heatmap's own Muscles
// filter above -- this is the detailed reference view, so it stays
// unfiltered on that axis; the Sets criteria (working/warmup/both) still
// applies, since that genuinely changes what counts as a logged set.
function CoverageBreakdown({ primary, secondary, onSelectMuscle }) {
  const [open, setOpen] = useState(false);

  const known = new Set();
  const rows = [];
  for (const entry of getDetailedTaxonomyEntries()) {
    if (known.has(entry.detailed)) continue;
    known.add(entry.detailed);
    const p = primary[entry.detailed] || 0;
    const s = secondary[entry.detailed] || 0;
    rows.push({ muscle: entry.detailed, primary: p, secondary: s, total: p + s });
  }
  // Anything present in the counts but not in the taxonomy list (e.g. a
  // custom/legacy label) still deserves a row.
  for (const m of [...Object.keys(primary), ...Object.keys(secondary)]) {
    if (known.has(m)) continue;
    known.add(m);
    const p = primary[m] || 0;
    const s = secondary[m] || 0;
    rows.push({ muscle: m, primary: p, secondary: s, total: p + s });
  }

  rows.sort((a, b) => b.total - a.total || a.muscle.localeCompare(b.muscle));
  const trainedCount = rows.filter((r) => r.total > 0).length;

  return (
    <div style={{ marginTop: 10 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", color: T.dim, fontSize: 11.5, fontWeight: 600, padding: "6px 0", textTransform: "uppercase", letterSpacing: 0.5 }}
      >
        <span>Coverage breakdown ({trainedCount}/{rows.length})</span>
        {open ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
          {rows.map((r) => {
            const clickable = r.total > 0 && !!onSelectMuscle;
            return (
              <button
                key={r.muscle}
                onClick={() => clickable && onSelectMuscle(r.muscle)}
                disabled={!clickable}
                style={{
                  width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                  background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px",
                  textAlign: "left", cursor: clickable ? "pointer" : "default",
                }}
              >
                <span style={{ fontSize: 13, color: r.total > 0 ? T.text : T.dim, fontWeight: r.total > 0 ? 600 : 500 }}>{r.muscle}</span>
                {r.total > 0 ? (
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 12, color: T.text, fontWeight: 700 }}>{r.total} set{r.total === 1 ? "" : "s"}</div>
                    <div style={{ fontSize: 10.5, color: T.dim, marginTop: 1 }}>{r.primary} primary &middot; {r.secondary} secondary</div>
                  </div>
                ) : (
                  <span style={{ fontSize: 11.5, color: T.dim, fontStyle: "italic" }}>Not trained yet</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Reports which muscles were trained: an anatomical Body map (front +
// back silhouette, purely visual — see BodyMap.jsx) plus, below it, a
// Coverage breakdown disclosure listing every muscle with its exact
// primary/secondary counts (including untrained muscles, so it's obvious
// what's lacking) -- the only place tapping a muscle opens the
// MuscleSetsDetail drill-in, since the body map itself is view-only.
// `primary`/`secondary` (at the caller's naming mode) back the "nothing
// logged" empty-state check and the Coverage list's default totals.
// `entries` is the same raw volume-entry array the caller fed into
// computeMuscleSetCounts -- Body map needs its own pass at a fixed
// "detailed" tier regardless of the naming-mode preference, since that's
// the resolution the underlying anatomical art is drawn at.
// `fullBodySets`, if present, is shown separately since "Full Body"
// exercises (carries, complexes) don't map to one muscle region.
// `onSelectMuscle(muscle)`, if passed, wires the Coverage breakdown's
// rows to a drill-in sheet.
// `setsFilter`/`roleFilter` + their onChange callbacks are optional --
// when both onChange callbacks are supplied (currently only Home's
// dashboard module does), a Sets (Working/Warm-up/Both) and Muscles
// (Primary/Secondary/Both) picker renders above the map and both feed
// straight into the heatmap's coloring; omitted entirely otherwise (the
// in-workout live heatmap and the template builder's Coverage panel),
// which keeps their existing working-sets/both-roles behavior with no
// extra chrome.
export default function BodyHeatmap({
  primary = {}, secondary = {}, fullBodySets = 0, entries, onSelectMuscle,
  setsFilter = "working", roleFilter = "both", onSetsFilterChange, onRoleFilterChange,
}) {
  const showFilters = !!(onSetsFilterChange && onRoleFilterChange);

  const names = new Set([...Object.keys(primary), ...Object.keys(secondary)]);
  const hasAnyData = names.size > 0 || fullBodySets > 0;

  const detailed = entries ? computeMuscleSetCounts(entries, "detailed", setsFilter) : { primary: {}, secondary: {} };

  return (
    <div>
      {showFilters && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
          <FilterRow label="Sets" options={SETS_FILTER_OPTIONS} value={setsFilter} onChange={onSetsFilterChange} />
          <FilterRow label="Muscles" options={ROLE_FILTER_OPTIONS} value={roleFilter} onChange={onRoleFilterChange} />
        </div>
      )}

      {!hasAnyData ? (
        <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>Nothing logged in this range yet.</div>
      ) : (
        <BodyMap primary={detailed.primary} secondary={detailed.secondary} roleFilter={roleFilter} />
      )}

      {fullBodySets > 0 && (
        <div style={{ textAlign: "center", marginTop: 8, fontSize: 12, color: T.dim }}>
          + Full-body work: <span style={{ color: T.text, fontWeight: 700 }}>{fullBodySets}</span> set{fullBodySets === 1 ? "" : "s"}
        </div>
      )}

      {hasAnyData && <CoverageBreakdown primary={detailed.primary} secondary={detailed.secondary} onSelectMuscle={onSelectMuscle} />}
    </div>
  );
}
