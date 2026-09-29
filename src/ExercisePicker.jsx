import { useState, useRef } from "react";
import { muscleLabel, muscleLabelsFor, muscleColor, scientificNameOf, detailedNameOf, genericBucket, muscleOptionsForMode, expandSplit, isSplitActive, CATEGORIES } from "./lib/muscleTaxonomy";
import { T } from "./lib/theme";
import { getPrefs, setPref } from "./lib/prefs";
import { getSplits } from "./lib/splits";
import { IconStar, IconCheck, IconSearch, IconX, IconClock, IconBody, IconBarbell, IconRefresh, IconSuperset, IconPencil, IconFilter, IconChevronLeft, IconChevronRight } from "./Icons";
import ExerciseThumb from "./ExerciseThumb";

// The equipment filter's fixed set of buckets — see deriveEquipmentBucket
// in lib/queries.js for how a raw equipment list gets mapped onto one of these.
export const EQUIPMENT_LIST = ["Barbell", "Dumbbell", "Cable", "Machine", "Kettlebell", "Bodyweight", "Other"];

// Whether library item `l` matches a muscle-group filter option `key` at
// the given naming mode. In Generic mode this is additive: `l` matches
// if its flat rolled-up bucket (l.muscle) equals `key` directly, OR if
// any of its individual raw primary muscles' own generic bucket equals
// `key` -- so a multi-bucket compound exercise (e.g. an incline press
// tagged Chest/Shoulders/Triceps at the primary-muscle level, but with a
// coarse/legacy l.muscle of "Full Body") still surfaces under every
// generic bucket it actually trains, rather than being findable only
// under whichever single bucket its stored muscle_group happens to say.
// Nothing is removed from the exercise's own bucket by this -- if
// l.muscle really is "Full Body", it still matches the Full Body option
// too. In Detailed mode `key` is a detailed label, matched via
// detailedNameOf so every scientific entry that rolls up to that
// label counts as a match, which is what lets "Biceps Femoris (Long
// Head)" and "(Short Head)" both count toward one "Hamstrings" button
// instead of splitting it into duplicates. In Scientific mode `key` is
// the exact anatomical name, matched via scientificNameOf. Both non-
// generic modes match against l's raw (un-collapsed) primary/secondary
// muscle tags, since l.muscle and l.primaryMuscles/secondaryMuscles are
// already rolled up to buckets.
export function exerciseMatchesOption(l, key, mode) {
  const raws = [...(l.rawPrimaryMuscles || []), ...(l.rawSecondaryMuscles || [])];
  if (mode === "generic") return l.muscle === key || (l.rawPrimaryMuscles || []).some((raw) => genericBucket(raw) === key);
  if (mode === "detailed") return raws.some((raw) => detailedNameOf(raw) === key);
  return raws.some((raw) => scientificNameOf(raw) === key);
}

// Filters a hydrated exercise library array against the same search text
// + muscle/equipment/performed/source filters the picker's Filters panel
// exposes, mirroring SetLogger's filteredLibrary(). `exclude` is a Set of
// names to leave out (already-picked exercises).
export function filterLibrary(library, { search, muscleFilter, equipFilter, performedFilter, sourceFilter, exclude }) {
  const q = (search || "").toLowerCase();
  const ex = exclude || new Set();
  const mode = getPrefs().muscleNameMode;
  return (library || []).filter((l) => {
    if (ex.has(l.name)) return false;
    // Muscle text is matched at the person's own tier only, so a Region-
    // mode search for "upper chest" finds incline presses, and an
    // Anatomy name typed in Region mode doesn't match anything hidden.
    if (q && !(l.name.toLowerCase().includes(q) || (l.aliases || []).some((a) => a.toLowerCase().includes(q)) || (l.muscle || "").toLowerCase().includes(q) || muscleLabelsFor(l.rawPrimaryMuscles, mode).some((m) => m.toLowerCase().includes(q)) || (l.equipment || "").toLowerCase().includes(q))) return false;
    if (muscleFilter?.length && !muscleFilter.some((m) => exerciseMatchesOption(l, m, mode))) return false;
    if (equipFilter?.length && !equipFilter.includes(l.equipment)) return false;
    if (performedFilter === "performed" && l.sessions === 0) return false;
    if (performedFilter === "not" && l.sessions > 0) return false;
    if (sourceFilter === "custom" && !l.isCustom) return false;
    return true;
  });
}

// A split's option keys at the given tier, honoring its Region
// carve-outs. Thin re-export so existing callers keep working.
export function splitGroupFor(splitName, mode) {
  return expandSplit(splitName, mode);
}

// ============================================================================
// Exercise picker (v1.13.3). Shared by the workout logger's Add and
// Replace sheets, the template builder, and program setup.
//
// Two browse layouts, chosen with the toggle beside the search box and
// remembered in prefs (pickerLayout):
//   "tiles" - a tile hub (Favorites, Recent, Muscle, Equipment,
//             Movement, Splits, My Custom) that drills into value tiles,
//             then a results list with refinement chips.
//   "rail"  - a left rail of the same entries with the values and
//             results side by side, no landing screen.
// Typing in search skips both and shows flat results. `replaceFor` (the
// exercise being swapped) opens on same-movement / same-muscle
// alternatives first. Callers' own filter state (the Filters panel,
// e.g. a program day's split) still applies to `list` upstream.
//
// All muscle text is at the person's Muscle Names tier.
// ============================================================================

const GOLD = "#F2C94C";
const SOFT = "#B8BDC7";
const CONDENSED = "'Barlow Condensed', sans-serif";
const ONE_LINE = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

const EQUIP_ABBR = { Barbell: "BB", Dumbbell: "DB", Cable: "CB", Machine: "MC", Kettlebell: "KB", Bodyweight: "BW", Other: "OT" };

function timeAgo(iso) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} wk ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} yr ago`;
}

function lastSetText(l) {
  if (l.lastTop) {
    const w = Number(l.lastTop.weight) || 0;
    const wt = w > 0 ? String(Math.round(w * 10) / 10) : "BW";
    return `${wt} × ${l.lastTop.reps}`;
  }
  return l.sessions > 0 ? "Done" : "New";
}

// Row subtitle: primary muscles at the person's tier, capped at two.
function primaryMuscleText(l) {
  const labels = muscleLabelsFor(l.rawPrimaryMuscles, getPrefs().muscleNameMode);
  if (labels.length === 0) return muscleLabel(l.muscle, "generic");
  return labels.length > 2 ? `${labels.slice(0, 2).join(", ")} +${labels.length - 2}` : labels.join(", ");
}

function inCategory(l, cat) {
  return l.muscle === cat || (l.rawPrimaryMuscles || []).some((raw) => genericBucket(raw) === cat);
}

function patternLabel(p) {
  return p ? p.charAt(0).toUpperCase() + p.slice(1) : "";
}

function byUsage(a, b) {
  const ta = a.lastPerformedAt || "";
  const tb = b.lastPerformedAt || "";
  if (ta !== tb) return tb.localeCompare(ta);
  return a.name.localeCompare(b.name);
}

// One exercise, as a card: thumb (photo, else equipment code in the
// muscle's color), name, muscles and equipment, last top set and when.
export function ExerciseRow({ l, onClick, badge, onToggleFavorite, selectable, selected, compact }) {
  const performed = l.sessions > 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, background: selectable && selected ? `${T.accent}14` : T.surface, border: `1px solid ${selectable && selected ? `${T.accent}80` : T.line}`, borderRadius: 12, paddingRight: onToggleFavorite ? 2 : 0 }}>
      <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, minHeight: compact ? 58 : 64, textAlign: "left", background: "none", border: "none", padding: compact ? "8px 10px" : "10px 12px", borderRadius: 12 }}>
        {selectable && (
          <div aria-hidden="true" style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, boxSizing: "border-box", border: `2px solid ${selected ? T.accent : "#4A505B"}`, background: selected ? T.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            {selected ? <IconCheck size={13} /> : null}
          </div>
        )}
        {badge}
        {!compact && (l.mediaUrl ? (
          <ExerciseThumb muscle={l.muscle} mediaUrl={l.mediaUrl} size={40} />
        ) : (
          <div aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 10, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: CONDENSED, fontWeight: 700, fontSize: 15, color: muscleColor(l.muscle) }}>
            {EQUIP_ABBR[l.equipment] || "—"}
          </div>
        ))}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontFamily: CONDENSED, fontSize: compact ? 18 : 19, fontWeight: 600, color: performed ? T.text : "#C9CCD2", ...ONE_LINE }}>{l.name}</div>
          <div style={{ fontSize: compact ? 12 : 13, color: T.dim, ...ONE_LINE }}>
            {compact ? `${l.equipment} · ${lastSetText(l)}${l.lastPerformedAt ? ` · ${timeAgo(l.lastPerformedAt)}` : ""}` : `${primaryMuscleText(l)} · ${l.equipment}`}
          </div>
        </div>
        {!compact && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: performed ? T.text : T.dim, whiteSpace: "nowrap" }}>{lastSetText(l)}</div>
            <div style={{ fontSize: 12, color: T.dim, whiteSpace: "nowrap" }}>{l.lastPerformedAt ? timeAgo(l.lastPerformedAt) : performed ? "" : "Not performed"}</div>
          </div>
        )}
      </button>
      {onToggleFavorite && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(l.id); }}
          aria-label={l.isFavorite ? "Unfavorite" : "Favorite"}
          style={{ width: 44, height: 44, background: "none", border: "none", color: l.isFavorite ? GOLD : "#5A606B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <IconStar size={17} filled={l.isFavorite} />
        </button>
      )}
    </div>
  );
}

function SectionHeader({ label, count, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px 2px" }}>
      <div style={{ fontFamily: CONDENSED, fontSize: 15, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: color || SOFT }}>{label}</div>
      {count != null && <div style={{ fontSize: 12, color: T.dim }}>{count}</div>}
    </div>
  );
}

function Chip({ label, active, color, onClick, square }) {
  const c = color || T.accent;
  return (
    <button onClick={onClick} style={{ flexShrink: 0, height: 36, padding: "0 14px", borderRadius: square ? 10 : 999, border: `1px solid ${active ? c : T.line}`, background: active ? `${c}2E` : T.surface, color: active ? T.text : SOFT, fontSize: 14, fontWeight: active ? 600 : 500, whiteSpace: "nowrap" }}>
      {label}
    </button>
  );
}

function ChipRow({ children }) {
  return <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>{children}</div>;
}

// A browse tile. `color` tints it (muscle groups, Favorites gold).
function Tile({ title, sub, count, icon, color, onClick, hero, children }) {
  const tint = color ? `${color}1F` : T.surface;
  const edge = color ? `${color}59` : T.line;
  return (
    <button onClick={onClick} style={{ gridColumn: hero ? "1 / -1" : "auto", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: hero ? 12 : 14, minHeight: hero ? 0 : 112, padding: 14, borderRadius: 16, background: tint, border: `1px solid ${edge}`, textAlign: "left", minWidth: 0, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%" }}>
        {icon ? (
          <div style={{ width: 36, height: 36, borderRadius: 10, background: color ? `${color}26` : T.surface2, display: "flex", alignItems: "center", justifyContent: "center", color: color || T.text, flexShrink: 0 }}>{icon}</div>
        ) : (
          <div style={{ width: 12, height: 12, borderRadius: 6, background: color || T.dim }} />
        )}
        {hero && <div style={{ flex: 1, fontFamily: CONDENSED, fontSize: 24, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: color || T.text, ...ONE_LINE }}>{title}</div>}
        {count != null && <div style={{ fontFamily: CONDENSED, fontSize: 18, fontWeight: 600, color: hero ? color : T.dim }}>{count}</div>}
      </div>
      {!hero && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%", minWidth: 0 }}>
          <div style={{ fontFamily: CONDENSED, fontSize: 21, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: T.text, ...ONE_LINE }}>{title}</div>
          {sub && <div style={{ fontSize: 13, color: SOFT, ...ONE_LINE }}>{sub}</div>}
        </div>
      )}
      {children}
    </button>
  );
}

const TILE_GRID = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 };

function LayoutToggle({ layout, onChange }) {
  const btn = (key, label, d) => (
    <button key={key} onClick={() => onChange(key)} aria-label={label} aria-pressed={layout === key} style={{ width: 38, height: 38, borderRadius: 8, border: "none", background: layout === key ? T.line : "transparent", color: layout === key ? T.text : T.dim, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
    </button>
  );
  return (
    <div role="group" aria-label="Picker layout" style={{ display: "flex", gap: 2, padding: 3, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, flexShrink: 0 }}>
      {btn("tiles", "Tile layout", "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z")}
      {btn("rail", "Rail layout", "M4 4h5v16H4zM13 6h7M13 12h7M13 18h7")}
    </div>
  );
}

const NODES = [
  { key: "favorites", label: "Favorites", railLabel: "Favorites", icon: (s) => <IconStar size={s} filled /> },
  { key: "recent", label: "Recent", railLabel: "Recent", icon: (s) => <IconClock size={s} /> },
  { key: "muscle", label: "Muscle Group", railLabel: "Muscle", icon: (s) => <IconBody size={s} /> },
  { key: "equipment", label: "Equipment", railLabel: "Equipment", icon: (s) => <IconBarbell size={s} /> },
  { key: "movement", label: "Movement", railLabel: "Movement", icon: (s) => <IconRefresh size={s} /> },
  { key: "splits", label: "Splits", railLabel: "Splits", icon: (s) => <IconSuperset size={s} /> },
  { key: "custom", label: "My Custom", railLabel: "Custom", icon: (s) => <IconPencil size={s} /> },
];
const VALUE_NODES = new Set(["muscle", "equipment", "movement", "splits"]);
const RECENT_LIMIT = 20;

export default function ExercisePicker({ list, search, onSearchChange, muscleFilter, onToggleMuscle, onApplySplit, equipFilter, onToggleEquip, performedFilter, onSetPerformed, sourceFilter, onSetSource, showFilters, onToggleFilters, onPick, onToggleFavorite, footer, multiSelect, selectedIds, onToggleSelect, fillHeight, replaceFor }) {
  const mode = getPrefs().muscleNameMode;
  const [layout, setLayoutState] = useState(() => (getPrefs().pickerLayout === "rail" ? "rail" : "tiles"));
  const [node, setNode] = useState(null); // tiles: null = hub. rail: selected rail entry.
  const [value, setValue] = useState(null); // selected value within a value node
  const [sub, setSub] = useState(null); // refinement chip (region/anatomy key or Category)
  const [equipChip, setEquipChip] = useState(null);
  const [browseAll, setBrowseAll] = useState(false); // replace mode: left the suggestions
  const [muscleQuery, setMuscleQuery] = useState("");
  const seen = useRef({});

  const items = list || [];
  for (const l of items) seen.current[l.id] = l;
  const q = (search || "").trim();
  const rowClick = (l) => (multiSelect ? onToggleSelect(l) : onPick(l));
  const isSel = (l) => !!(selectedIds && selectedIds.has(l.id));

  function setLayout(next) {
    setLayoutState(next);
    setPref("pickerLayout", next);
    // Keep the person's place across layouts where it maps directly.
    if (next === "rail" && !node) setNode(items.some((l) => l.isFavorite) ? "favorites" : "muscle");
  }

  function openNode(key) {
    setNode(key);
    setValue(null);
    setSub(null);
    setEquipChip(null);
  }
  function openValue(v) {
    setValue(v);
    setSub(null);
    setEquipChip(null);
  }

  // ---- counts and value lists --------------------------------------------
  const favorites = items.filter((l) => l.isFavorite);
  const recent = items.filter((l) => l.lastPerformedAt).sort(byUsage).slice(0, RECENT_LIMIT);
  const customs = items.filter((l) => l.isCustom);
  const patterns = [...new Set(items.map((l) => l.pattern).filter(Boolean))].sort();
  const splitNames = Object.keys(getSplits());

  const matchesSplit = (l, name) => expandSplit(name, mode).some((k) => exerciseMatchesOption(l, k, mode));
  const valuesFor = (nodeKey) => {
    if (nodeKey === "muscle") {
      return CATEGORIES.map((c) => {
        const n = items.filter((l) => inCategory(l, c.key)).length;
        const regions = mode === "generic" ? "" : muscleOptionsForMode(mode).filter((o) => o.category === c.key).map((o) => o.label).slice(0, 4).join(" · ");
        return { key: c.key, label: c.key, color: c.color, count: n, sub: regions || `${n} exercises` };
      }).filter((v) => v.count > 0);
    }
    if (nodeKey === "equipment") return EQUIPMENT_LIST.map((e) => ({ key: e, label: e, count: items.filter((l) => l.equipment === e).length, sub: EQUIP_ABBR[e] })).filter((v) => v.count > 0).map((v) => ({ ...v, sub: `${v.count} exercises` }));
    if (nodeKey === "movement") return patterns.map((p) => ({ key: p, label: patternLabel(p), count: items.filter((l) => l.pattern === p).length })).map((v) => ({ ...v, sub: `${v.count} exercises` }));
    if (nodeKey === "splits") return splitNames.map((n) => ({ key: n, label: n, count: items.filter((l) => matchesSplit(l, n)).length })).filter((v) => v.count > 0).map((v) => ({ ...v, sub: `${v.count} exercises` }));
    return [];
  };

  // ---- results for the current node/value/chips ---------------------------
  function baseFor(nodeKey, v) {
    if (nodeKey === "favorites") return favorites;
    if (nodeKey === "recent") return recent;
    if (nodeKey === "custom") return customs;
    if (!v) return [];
    if (nodeKey === "muscle") return items.filter((l) => inCategory(l, v));
    if (nodeKey === "equipment") return items.filter((l) => l.equipment === v);
    if (nodeKey === "movement") return items.filter((l) => l.pattern === v);
    if (nodeKey === "splits") return items.filter((l) => matchesSplit(l, v));
    return [];
  }
  const base = baseFor(node, value);
  // Refinement chips: inside a muscle group, its Regions/Anatomy (never
  // in Category mode) plus equipment; everywhere else, muscle groups.
  const subOptions = node === "muscle" && value
    ? (mode === "generic" ? [] : muscleOptionsForMode(mode).filter((o) => o.category === value && base.some((l) => exerciseMatchesOption(l, o.key, mode))).map((o) => ({ key: o.key, label: o.label, color: o.color })))
    : VALUE_NODES.has(node) && value
    ? CATEGORIES.filter((c) => base.some((l) => inCategory(l, c.key))).map((c) => ({ key: c.key, label: c.key, color: c.color }))
    : [];
  const equipOptions = node === "muscle" && value ? EQUIPMENT_LIST.filter((e) => base.some((l) => l.equipment === e)) : [];
  let results = base;
  if (sub) results = results.filter((l) => (node === "muscle" ? exerciseMatchesOption(l, sub, mode) : inCategory(l, sub)));
  if (equipChip) results = results.filter((l) => l.equipment === equipChip);

  // ---- renderers ----------------------------------------------------------
  function rowsOf(arr, compact) {
    return arr.map((l) => (
      <ExerciseRow key={l.id || l.name} l={l} compact={compact} onClick={() => rowClick(l)} onToggleFavorite={onToggleFavorite} selectable={multiSelect} selected={isSel(l)} />
    ));
  }

  // Favorites / Performed / Not yet performed, most recently used first.
  function sectioned(arr, compact) {
    const favs = arr.filter((l) => l.isFavorite).sort(byUsage);
    const done = arr.filter((l) => !l.isFavorite && l.sessions > 0).sort(byUsage);
    const fresh = arr.filter((l) => !l.isFavorite && !(l.sessions > 0)).sort((a, b) => a.name.localeCompare(b.name));
    if (arr.length === 0) return <div style={{ fontSize: 14, color: T.dim, padding: "16px 4px" }}>No matches.</div>;
    return (
      <>
        {favs.length > 0 && <><SectionHeader label="Favorites" count={favs.length} color={GOLD} />{rowsOf(favs, compact)}</>}
        {done.length > 0 && <><SectionHeader label="Performed" count={done.length} />{rowsOf(done, compact)}</>}
        {fresh.length > 0 && <><SectionHeader label="Not yet performed" count={fresh.length} color={T.dim} />{rowsOf(fresh, compact)}</>}
      </>
    );
  }

  // Favorites grouped under their muscle group (rail's Favorites view).
  function groupedByCategory(arr, compact) {
    if (arr.length === 0) return <div style={{ fontSize: 14, color: T.dim, padding: "16px 4px" }}>Star an exercise to pin it here.</div>;
    return CATEGORIES.map((c) => {
      const inCat = arr.filter((l) => l.muscle === c.key).sort(byUsage);
      if (inCat.length === 0) return null;
      return (
        <div key={c.key} style={{ display: "contents" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 2px 2px" }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: c.color }} />
            <div style={{ fontFamily: CONDENSED, fontSize: 14, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: SOFT }}>{c.key}</div>
          </div>
          {rowsOf(inCat, compact)}
        </div>
      );
    });
  }

  function chipsBlock(compact) {
    if (!VALUE_NODES.has(node) || !value) return null;
    if (subOptions.length === 0 && equipOptions.length === 0) return null;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: compact ? "0 0 8px" : "0 0 10px" }}>
        {subOptions.length > 1 && (
          <ChipRow>
            <Chip label={node === "muscle" ? "All" : "All muscles"} active={!sub} onClick={() => setSub(null)} />
            {subOptions.map((o) => <Chip key={o.key} label={o.label} color={o.color} active={sub === o.key} onClick={() => setSub(sub === o.key ? null : o.key)} />)}
          </ChipRow>
        )}
        {equipOptions.length > 1 && (
          <ChipRow>
            <Chip square label="Any equipment" active={!equipChip} onClick={() => setEquipChip(null)} />
            {equipOptions.map((e) => <Chip square key={e} label={e} active={equipChip === e} onClick={() => setEquipChip(equipChip === e ? null : e)} />)}
          </ChipRow>
        )}
      </div>
    );
  }

  function nodeCount(key) {
    if (key === "favorites") return favorites.length;
    if (key === "recent") return recent.length;
    if (key === "custom") return customs.length;
    return valuesFor(key).length;
  }
  function nodeSub(key) {
    if (key === "recent") return "Most recently done";
    if (key === "muscle") return mode === "generic" ? "By muscle group" : mode === "detailed" ? "Group, then region" : "Group, then muscle";
    if (key === "equipment") return "Barbell, dumbbell, cable";
    if (key === "movement") return "Squat, hinge, press, pull";
    if (key === "splits") return splitNames.slice(0, 3).join(", ");
    if (key === "custom") return "Exercises you made";
    return "";
  }

  function tilesView() {
    if (!node) {
      return (
        <div style={TILE_GRID}>
          <Tile hero title="Favorites" color={GOLD} icon={<IconStar size={20} filled />} count={favorites.length} onClick={() => openNode("favorites")}>
            {favorites.length > 0 ? (
              <div style={{ display: "flex", gap: 6, overflow: "hidden", width: "100%" }}>
                {favorites.sort(byUsage).slice(0, 3).map((l) => <div key={l.id} style={{ flexShrink: 0, padding: "6px 10px", borderRadius: 999, background: T.surface, fontSize: 13, color: T.text, whiteSpace: "nowrap" }}>{l.name}</div>)}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: SOFT }}>Tap the star on any exercise to pin it here</div>
            )}
          </Tile>
          {NODES.filter((n) => n.key !== "favorites" && (n.key !== "custom" || customs.length > 0) && (n.key !== "movement" || patterns.length > 0)).map((n) => (
            <Tile key={n.key} title={n.label} sub={nodeSub(n.key)} icon={n.icon(20)} count={nodeCount(n.key)} onClick={() => openNode(n.key)} />
          ))}
        </div>
      );
    }
    const meta = NODES.find((n) => n.key === node);
    const back = () => (VALUE_NODES.has(node) && value ? openValue(null) : openNode(null));
    const valueMeta = value ? valuesFor(node).find((v) => v.key === value) : null;
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <button onClick={back} aria-label="Back" style={{ width: 40, height: 40, borderRadius: 10, background: T.surface, border: `1px solid ${T.line}`, color: T.text, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <IconChevronLeft size={18} />
          </button>
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
            {valueMeta && <div style={{ fontSize: 12, color: T.dim, letterSpacing: 0.6, textTransform: "uppercase", ...ONE_LINE }}>{meta.label}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              {valueMeta?.color && <div style={{ width: 10, height: 10, borderRadius: 5, background: valueMeta.color, flexShrink: 0 }} />}
              <div style={{ fontFamily: CONDENSED, fontSize: 22, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: node === "favorites" ? GOLD : T.text, ...ONE_LINE }}>{valueMeta ? valueMeta.label : meta.label}</div>
            </div>
          </div>
        </div>
        {VALUE_NODES.has(node) && !value ? (
          <div style={TILE_GRID}>
            {valuesFor(node).map((v) => (
              <Tile key={v.key} title={v.label} sub={v.sub} color={v.color} count={node === "muscle" ? v.count : null} icon={v.color ? null : node === "equipment" ? <span style={{ fontFamily: CONDENSED, fontWeight: 700, fontSize: 15 }}>{EQUIP_ABBR[v.key]}</span> : meta.icon(18)} onClick={() => openValue(v.key)} />
            ))}
          </div>
        ) : (
          <>
            {chipsBlock(false)}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {node === "recent" ? (recent.length ? rowsOf(recent) : <div style={{ fontSize: 14, color: T.dim, padding: "16px 4px" }}>Nothing logged yet.</div>) : sectioned(results)}
            </div>
          </>
        )}
      </>
    );
  }

  function railView() {
    const active = node || (favorites.length ? "favorites" : "muscle");
    const values = VALUE_NODES.has(active) ? valuesFor(active) : [];
    const current = VALUE_NODES.has(active) ? value || values[0]?.key || null : null;
    // Rail shows a value immediately (no empty state), so resolve results
    // against the defaulted value when none has been picked yet.
    let railResults = baseFor(active, current);
    if (sub) railResults = railResults.filter((l) => (active === "muscle" ? exerciseMatchesOption(l, sub, mode) : inCategory(l, sub)));
    if (equipChip) railResults = railResults.filter((l) => l.equipment === equipChip);
    return (
      <div style={{ display: "flex", gap: 10, minHeight: 0, flex: 1 }}>
        <div style={{ width: 76, flexShrink: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          {NODES.filter((n) => n.key !== "custom" || customs.length > 0).map((n) => {
            const on = n.key === active;
            const gold = n.key === "favorites";
            return (
              <button key={n.key} onClick={() => openNode(n.key)} aria-pressed={on} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, height: 64, borderRadius: 12, border: "none", background: on ? (gold ? `${GOLD}1F` : T.surface2) : "transparent", color: gold ? GOLD : on ? T.text : T.dim }}>
                {n.icon(20)}
                <span style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap" }}>{n.railLabel}</span>
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {values.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, marginBottom: 4 }}>
              {values.map((v) => {
                const on = v.key === current;
                const c = v.color || T.accent;
                return (
                  <button key={v.key} onClick={() => openValue(v.key)} style={{ display: "flex", alignItems: "center", gap: 6, height: 40, padding: "0 10px", borderRadius: 10, border: `1px solid ${on ? c : T.line}`, background: on ? `${c}2E` : T.surface, color: on ? T.text : SOFT, fontSize: 13, fontWeight: 600, minWidth: 0 }}>
                    {v.color && <span style={{ width: 8, height: 8, borderRadius: 4, background: v.color, flexShrink: 0 }} />}
                    <span style={ONE_LINE}>{v.label}</span>
                  </button>
                );
              })}
            </div>
          )}
          {node === active && value ? chipsBlock(true) : null}
          {active === "favorites" ? groupedByCategory(favorites, true) : active === "recent" ? (recent.length ? rowsOf(recent, true) : <div style={{ fontSize: 14, color: T.dim, padding: "16px 4px" }}>Nothing logged yet.</div>) : sectioned(railResults, true)}
        </div>
      </div>
    );
  }

  // Replace mode landing: alternatives for the exercise being swapped.
  function replaceView() {
    const r = replaceFor;
    const rLabels = new Set(muscleLabelsFor(r.rawPrimaryMuscles, mode));
    const others = items.filter((l) => l.id !== r.id);
    const sameMove = r.pattern ? others.filter((l) => l.pattern === r.pattern && l.muscle === r.muscle).sort(byUsage).slice(0, 6) : [];
    const moveIds = new Set(sameMove.map((l) => l.id));
    const sameMuscle = others
      .filter((l) => !moveIds.has(l.id) && (muscleLabelsFor(l.rawPrimaryMuscles, mode).some((m) => rLabels.has(m)) || (rLabels.size === 0 && l.muscle === r.muscle)))
      .sort(byUsage)
      .slice(0, 8);
    const primary = [...rLabels].slice(0, 2).join(", ") || muscleLabel(r.muscle, "generic");
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, background: T.surface2, marginBottom: 6 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: `${muscleColor(r.muscle)}26`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: CONDENSED, fontWeight: 700, fontSize: 16, color: muscleColor(r.muscle), flexShrink: 0 }}>{EQUIP_ABBR[r.equipment] || "—"}</div>
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 12, color: T.dim, letterSpacing: 0.6, textTransform: "uppercase" }}>Swapping out</div>
            <div style={{ fontFamily: CONDENSED, fontSize: 20, fontWeight: 600, color: T.text, ...ONE_LINE }}>{r.name}</div>
            <div style={{ fontSize: 13, color: SOFT, ...ONE_LINE }}>{primary}{r.pattern ? ` · ${patternLabel(r.pattern)}` : ""}</div>
          </div>
        </div>
        {sameMove.length > 0 && <><SectionHeader label="Same movement" count={patternLabel(r.pattern)} />{rowsOf(sameMove)}</>}
        {sameMuscle.length > 0 && <><SectionHeader label="Same muscle" count={primary} />{rowsOf(sameMuscle)}</>}
        {sameMove.length === 0 && sameMuscle.length === 0 && <div style={{ fontSize: 14, color: T.dim, padding: "12px 4px" }}>No close alternatives found.</div>}
        <button onClick={() => setBrowseAll(true)} style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 52, borderRadius: 12, background: "transparent", border: `1px dashed #4A505B`, fontFamily: CONDENSED, fontSize: 18, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: SOFT }}>
          Browse all exercises <IconChevronRight size={16} />
        </button>
      </>
    );
  }

  // ---- advanced Filters panel (unchanged behavior, restyled) -------------
  const activeCount = (muscleFilter?.length || 0) + (equipFilter?.length || 0) + (performedFilter && performedFilter !== "all" ? 1 : 0) + (sourceFilter && sourceFilter !== "all" ? 1 : 0);
  const muscleQ = muscleQuery.toLowerCase();
  const muscleOptions = muscleOptionsForMode(mode);
  const label = (t) => <div style={{ fontFamily: CONDENSED, fontSize: 13, fontWeight: 600, letterSpacing: 1.1, textTransform: "uppercase", color: SOFT, margin: "10px 0 6px" }}>{t}</div>;
  const filtersPanel = showFilters && onToggleFilters && (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "4px 12px 12px", marginBottom: 10 }}>
      {onApplySplit && <>{label("Split")}<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{splitNames.map((n) => <Chip key={n} label={n} active={isSplitActive(n, muscleFilter || [], mode)} onClick={() => onApplySplit(n)} />)}</div></>}
      {onToggleMuscle && (
        <>
          {label("Muscle")}
          {mode !== "generic" && (
            <input autoComplete="off" value={muscleQuery} onChange={(e) => setMuscleQuery(e.target.value)} placeholder="Search muscles" style={{ width: "100%", height: 40, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, color: T.text, fontSize: 15, padding: "0 12px", outline: "none", boxSizing: "border-box", marginBottom: 6 }} />
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxHeight: 160, overflowY: "auto" }}>
            {muscleOptions.filter((o) => !muscleQ || o.label.toLowerCase().includes(muscleQ)).map((o) => <Chip key={o.key} label={o.label} color={o.color} active={(muscleFilter || []).includes(o.key)} onClick={() => onToggleMuscle(o.key)} />)}
          </div>
        </>
      )}
      {onToggleEquip && <>{label("Equipment")}<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{EQUIPMENT_LIST.map((e) => <Chip square key={e} label={e} active={(equipFilter || []).includes(e)} onClick={() => onToggleEquip(e)} />)}</div></>}
      {onSetPerformed && <>{label("History")}<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{[["all", "All"], ["performed", "Performed"], ["not", "Not performed"]].map(([k, t]) => <Chip key={k} label={t} active={performedFilter === k} onClick={() => onSetPerformed(k)} />)}</div></>}
      {onSetSource && <>{label("Source")}<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{[["all", "All"], ["custom", "Custom"]].map(([k, t]) => <Chip key={k} label={t} active={sourceFilter === k} onClick={() => onSetSource(k)} />)}</div></>}
    </div>
  );

  // ---- selection tray (multi-select) --------------------------------------
  const trayItems = multiSelect && selectedIds ? [...selectedIds].map((id) => seen.current[id]).filter(Boolean) : [];

  const inReplace = replaceFor && !browseAll && !q;
  const body = q
    ? <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{sectioned(items)}</div>
    : inReplace
    ? <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{replaceView()}</div>
    : layout === "rail"
    ? railView()
    : tilesView();

  return (
    <div style={fillHeight ? { display: "flex", flexDirection: "column", height: "100%", minHeight: 0 } : undefined}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <label style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, height: 46, padding: "0 12px", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, color: T.dim, boxSizing: "border-box" }}>
          <IconSearch size={17} />
          <input autoComplete="off" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search exercises" aria-label="Search exercises" style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: T.text, fontSize: 16 }} />
          {q && <button onClick={() => onSearchChange("")} aria-label="Clear search" style={{ width: 28, height: 28, border: "none", background: "none", color: T.dim, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}><IconX size={14} /></button>}
        </label>
        {onToggleFilters && (
          <button onClick={onToggleFilters} aria-label="Filters" style={{ position: "relative", width: 46, height: 46, borderRadius: 12, background: T.surface, border: `1px solid ${activeCount ? T.accent : T.line}`, color: activeCount ? T.text : T.dim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <IconFilter size={17} />
            {activeCount > 0 && <span style={{ position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, background: T.accent, color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{activeCount}</span>}
          </button>
        )}
        <LayoutToggle layout={layout} onChange={setLayout} />
      </div>
      {filtersPanel}
      <div style={fillHeight ? { flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column" } : { maxHeight: "52vh", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {body}
        <div style={{ marginTop: 8 }}>{footer}</div>
      </div>
      {trayItems.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 10, marginTop: 6, borderTop: `1px solid ${T.line}` }}>
          <div style={{ fontFamily: CONDENSED, fontSize: 14, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: SOFT }}>{trayItems.length} selected</div>
          <ChipRow>
            {trayItems.map((l) => (
              <div key={l.id} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 4px 0 10px", borderRadius: 999, background: T.surface2, fontSize: 13, color: T.text, whiteSpace: "nowrap" }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: muscleColor(l.muscle) }} />
                {l.short || l.name}
                <button onClick={() => onToggleSelect(l)} aria-label={`Remove ${l.name}`} style={{ width: 28, height: 28, border: "none", background: "none", color: T.dim, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}><IconX size={12} /></button>
              </div>
            ))}
          </ChipRow>
        </div>
      )}
    </div>
  );
}
