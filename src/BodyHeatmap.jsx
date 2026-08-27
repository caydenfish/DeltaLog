import { useState } from "react";
import { computeMuscleSetCounts } from "./lib/volume";
import { getDetailedTaxonomyEntries, genericBucket } from "./lib/muscleNomenclature";
import { MUSCLE_COLORS } from "./lib/muscleColors";
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
//
// Two tabs: Chart (a colored horizontal-bar view, sorted by volume, for
// reading the whole breakdown at a glance) and List (the original
// row-per-muscle disclosure with exact primary/secondary counts).
// `view`/`onViewChange`, if passed, persist which tab was last used
// (Home wires this to a pref, defaulting to "chart" the first time
// there's nothing persisted yet) -- so a fresh install opens on Chart,
// but switching to List sticks for next time.
function CoverageBreakdown({ primary, secondary, onSelectMuscle, view, onViewChange }) {
  const [open, setOpen] = useState(false);
  const [localTab, setLocalTab] = useState("chart");
  const tab = view || localTab;
  const setTab = onViewChange || setLocalTab;

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
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));

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
        <div style={{ marginTop: 4 }}>
          <div style={{ display: "flex", width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 9, padding: 3, gap: 3, boxSizing: "border-box", marginBottom: 10 }}>
            {[{ key: "chart", label: "Chart" }, { key: "list", label: "List" }].map((o) => (
              <button
                key={o.key}
                onClick={() => setTab(o.key)}
                aria-pressed={tab === o.key}
                style={{
                  flex: 1, background: tab === o.key ? T.accent : "transparent", border: "none", borderRadius: 7,
                  padding: "6px 0", fontSize: 11.5, fontWeight: 600, color: tab === o.key ? "#fff" : T.dim,
                }}
              >
                {o.label}
              </button>
            ))}
          </div>

          {tab === "chart" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {rows.map((r) => {
                const clickable = r.total > 0 && !!onSelectMuscle;
                const color = MUSCLE_COLORS[genericBucket(r.muscle)] || T.accent;
                const pct = Math.max(r.total > 0 ? 6 : 0, Math.round((r.total / maxTotal) * 100));
                return (
                  <button
                    key={r.muscle}
                    onClick={() => clickable && onSelectMuscle(r.muscle)}
                    disabled={!clickable}
                    style={{ width: "100%", background: "none", border: "none", padding: 0, textAlign: "left", cursor: clickable ? "pointer" : "default" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                      <span style={{ fontSize: 11.5, color: r.total > 0 ? T.text : T.dim, fontWeight: r.total > 0 ? 600 : 500 }}>{r.muscle}</span>
                      <span style={{ fontSize: 10.5, color: T.dim, flexShrink: 0, marginLeft: 8 }}>{r.total > 0 ? `${r.total} set${r.total === 1 ? "" : "s"}` : "—"}</span>
                    </div>
                    <div style={{ width: "100%", height: 7, borderRadius: 4, background: T.surface2, overflow: "hidden" }}>
                      {r.total > 0 && <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, background: color }} />}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
  coverageView, onCoverageViewChange, mapMaxWidth,
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
        <BodyMap primary={detailed.primary} secondary={detailed.secondary} roleFilter={roleFilter} maxWidth={mapMaxWidth} />
      )}

      {fullBodySets > 0 && (
        <div style={{ textAlign: "center", marginTop: 8, fontSize: 12, color: T.dim }}>
          + Full-body work: <span style={{ color: T.text, fontWeight: 700 }}>{fullBodySets}</span> set{fullBodySets === 1 ? "" : "s"}
        </div>
      )}

      {hasAnyData && <CoverageBreakdown primary={detailed.primary} secondary={detailed.secondary} onSelectMuscle={onSelectMuscle} view={coverageView} onViewChange={onCoverageViewChange} />}
    </div>
  );
}
