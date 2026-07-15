import { useState } from "react";
import { T } from "./lib/theme";
import { getPrefs } from "./lib/prefs";
import { MUSCLE_COLORS } from "./lib/muscleColors";
import { getSplits } from "./lib/splits";
import { muscleLabel, getMuscleTaxonomyEntries, getDetailedTaxonomyEntries, scientificNameOf, detailedNameOf, genericBucket } from "./lib/muscleNomenclature";
import { IconStar, IconCheck } from "./Icons";
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
    if (q && !(l.name.toLowerCase().includes(q) || (l.aliases || []).some((a) => a.toLowerCase().includes(q)) || (l.muscle || "").toLowerCase().includes(q) || (l.equipment || "").toLowerCase().includes(q))) return false;
    if (muscleFilter?.length && !muscleFilter.some((m) => exerciseMatchesOption(l, m, mode))) return false;
    if (equipFilter?.length && !equipFilter.includes(l.equipment)) return false;
    if (performedFilter === "performed" && l.sessions === 0) return false;
    if (performedFilter === "not" && l.sessions > 0) return false;
    if (sourceFilter === "custom" && !l.isCustom) return false;
    return true;
  });
}

// Given the current muscleFilter and a split name, returns the group of
// option keys that split expands to at the active naming mode, and
// whether that group is already the exact active selection — used by
// both the caller's onApplySplit handler and this file's isActive check.
export function splitGroupFor(splitName, mode) {
  const buckets = getSplits()[splitName];
  return mode === "generic"
    ? buckets
    : mode === "detailed"
      ? getDetailedTaxonomyEntries().filter((e) => buckets.includes(e.generic)).map((e) => e.detailed)
      : getMuscleTaxonomyEntries().filter((e) => buckets.includes(e.generic)).map((e) => e.scientific);
}

export function ExerciseRow({ l, onClick, badge, onToggleFavorite, selectable, selected }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, background: selectable && selected ? "rgba(232,68,46,0.08)" : "transparent", borderRadius: 8 }}>
      <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: "9px 6px", borderRadius: 8 }}>
        {selectable && (
          <div aria-hidden="true" style={{
            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
            border: `1.5px solid ${selected ? T.accent : T.line}`,
            background: selected ? T.accent : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 12, fontWeight: 700,
          }}>
            {selected ? <IconCheck size={11} /> : ""}
          </div>
        )}
        {badge}
        <ExerciseThumb muscle={l.muscle} mediaUrl={l.mediaUrl} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: T.text, fontSize: 14 }}>{l.name}</div>
          <div style={{ color: T.dim, fontSize: 11 }}>{muscleLabel(l.muscle)} · {l.equipment}</div>
        </div>
        <div style={{ color: T.dim, fontSize: 11, textAlign: "right", flexShrink: 0 }}>
          {l.sessions > 0 ? `${l.sessions} session${l.sessions > 1 ? "s" : ""}` : "Not performed"}
        </div>
      </button>
      {onToggleFavorite && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(l.id); }}
          aria-label={l.isFavorite ? "Unfavorite" : "Favorite"}
          title={l.isFavorite ? "Unfavorite" : "Favorite"}
          style={{ background: "none", border: "none", color: l.isFavorite ? "#F2C94C" : T.dim, fontSize: 16, padding: "4px 6px", flexShrink: 0 }}
        >
          <IconStar size={15} filled={l.isFavorite} />
        </button>
      )}
    </div>
  );
}

// The full search + Filters panel + categorized (Selected/Favorites/
// Previously performed/Unperformed) results list used anywhere someone
// manually adds or replaces an exercise — the workout logger's Add
// Exercise sheet, its per-exercise Replace picker, and the template
// builder's Add Exercises panel all render the same component so they
// look and behave identically.
export default function ExercisePicker({ list, search, onSearchChange, muscleFilter, onToggleMuscle, onApplySplit, equipFilter, onToggleEquip, performedFilter, onSetPerformed, sourceFilter, onSetSource, showFilters, onToggleFilters, onPick, onToggleFavorite, footer, multiSelect, selectedIds, onToggleSelect, fillHeight }) {
  const rowClick = (l) => (multiSelect ? onToggleSelect(l) : onPick(l));
  const smallBtn = { background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 11, whiteSpace: "nowrap" };
  const chip = (active, color) => ({ padding: "5px 11px", borderRadius: 999, fontSize: 12, fontWeight: 600, border: `1px solid ${active ? (color || T.accent) : T.line}`, background: active ? `${color || T.accent}22` : T.surface, color: active ? T.text : T.dim });
  const activeCount = muscleFilter.length + equipFilter.length + (performedFilter !== "all" ? 1 : 0) + (sourceFilter !== "all" ? 1 : 0);
  const muscleNameMode = getPrefs().muscleNameMode;
  const [muscleQuery, setMuscleQuery] = useState("");
  const muscleQ = muscleQuery.toLowerCase();
  // Same options-per-mode approach as the generator: Generic mode offers
  // the 8 broad buckets, Detailed/Scientific offer the full granular
  // taxonomy so this filter shows the same level of detail the person
  // has chosen in Preferences, not a fixed 8 regardless of that setting.
  // Unlike the generator's target picker, Full Body/Neck stay included --
  // someone browsing to add exercises manually might genuinely want to
  // filter for a neck or full-body movement.
  const muscleOptions = muscleNameMode === "generic"
    ? Object.keys(MUSCLE_COLORS).map((m) => ({ key: m, label: m, color: MUSCLE_COLORS[m] }))
    : muscleNameMode === "detailed"
      ? getDetailedTaxonomyEntries().map((e) => ({ key: e.detailed, label: e.detailed, color: MUSCLE_COLORS[e.generic] }))
      : getMuscleTaxonomyEntries().map((e) => ({ key: e.scientific, label: e.scientific, color: MUSCLE_COLORS[e.generic] }));
  return (
    <div style={fillHeight ? { display: "flex", flexDirection: "column", height: "100%", minHeight: 0 } : undefined}>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input
          autoComplete="off"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search exercises, muscles, equipment..."
          style={{ flex: 1, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "8px 10px", outline: "none", boxSizing: "border-box" }}
        />
        <button onClick={onToggleFilters} style={{ ...smallBtn, color: activeCount > 0 ? T.text : T.dim, borderColor: activeCount > 0 ? T.accent : T.line }}>
          Filters{activeCount > 0 ? ` (${activeCount})` : ""}
        </button>
      </div>

      {showFilters && (
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Split</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
            {Object.keys(getSplits()).map((splitName) => {
              const buckets = getSplits()[splitName];
              const group = muscleNameMode === "generic" ? buckets : muscleNameMode === "detailed"
                ? getDetailedTaxonomyEntries().filter((e) => buckets.includes(e.generic)).map((e) => e.detailed)
                : getMuscleTaxonomyEntries().filter((e) => buckets.includes(e.generic)).map((e) => e.scientific);
              const active = group.length > 0 && group.length === muscleFilter.length && group.every((m) => muscleFilter.includes(m));
              return (
                <button key={splitName} onClick={() => onApplySplit(splitName)} style={chip(active)}>{splitName}</button>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Muscle group</div>
          {muscleNameMode !== "generic" && (
            <input
              autoComplete="off"
              value={muscleQuery}
              onChange={(e) => setMuscleQuery(e.target.value)}
              placeholder="Search muscle groups…"
              style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 12, padding: "6px 9px", outline: "none", boxSizing: "border-box", marginBottom: 6 }}
            />
          )}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
            {muscleOptions.filter((o) => !muscleQ || o.label.toLowerCase().includes(muscleQ)).map((o) => (
              <button key={o.key} onClick={() => onToggleMuscle(o.key)} style={chip(muscleFilter.includes(o.key), o.color)}>{o.label}</button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Equipment</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
            {EQUIPMENT_LIST.map((eq) => (
              <button key={eq} onClick={() => onToggleEquip(eq)} style={chip(equipFilter.includes(eq))}>{eq}</button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>History</div>
          <div style={{ display: "flex", gap: 5 }}>
            {[["all", "All"], ["performed", "Performed"], ["not", "Not performed"]].map(([k, label]) => (
              <button key={k} onClick={() => onSetPerformed(k)} style={chip(performedFilter === k)}>{label}</button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, marginTop: 8 }}>Source</div>
          <div style={{ display: "flex", gap: 5 }}>
            {[["all", "All"], ["custom", "Custom"]].map(([k, label]) => (
              <button key={k} onClick={() => onSetSource(k)} style={chip(sourceFilter === k)}>{label}</button>
            ))}
          </div>
        </div>
      )}

      <div style={fillHeight ? { flex: 1, minHeight: 0, overflowY: "auto", marginBottom: 4 } : { maxHeight: "42vh", overflowY: "auto", marginBottom: 4 }}>
        {list.length === 0 && <div style={{ fontSize: 13, color: T.dim, padding: "8px 6px" }}>No matches.</div>}
        {(() => {
          const selected = multiSelect && selectedIds ? list.filter((l) => selectedIds.has(l.id)) : [];
          const remaining = selected.length > 0 ? list.filter((l) => !selectedIds.has(l.id)) : list;
          const favorites = remaining.filter((l) => l.isFavorite);
          const performed = remaining.filter((l) => !l.isFavorite && l.sessions > 0);
          const unperformed = remaining.filter((l) => !l.isFavorite && !(l.sessions > 0));
          return (
            <>
              {selected.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: T.accent, textTransform: "uppercase", letterSpacing: 1, padding: "6px 4px 4px" }}>Selected ({selected.length})</div>
                  {selected.map((l) => <ExerciseRow key={l.name} l={l} onClick={() => rowClick(l)} onToggleFavorite={onToggleFavorite} selectable={multiSelect} selected />)}
                  <div style={{ height: 1, background: T.line, margin: "6px 4px 4px" }} />
                </>
              )}
              {favorites.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, padding: "6px 4px 4px" }}>Favorites</div>
                  {favorites.map((l) => <ExerciseRow key={l.name} l={l} onClick={() => rowClick(l)} onToggleFavorite={onToggleFavorite} selectable={multiSelect} selected={selectedIds && selectedIds.has(l.id)} />)}
                </>
              )}
              {performed.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, padding: "6px 4px 4px" }}>Previously performed</div>
                  {performed.map((l) => <ExerciseRow key={l.name} l={l} onClick={() => rowClick(l)} onToggleFavorite={onToggleFavorite} selectable={multiSelect} selected={selectedIds && selectedIds.has(l.id)} />)}
                </>
              )}
              {unperformed.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, padding: "10px 4px 4px" }}>Unperformed</div>
                  {unperformed.map((l) => <ExerciseRow key={l.name} l={l} onClick={() => rowClick(l)} onToggleFavorite={onToggleFavorite} selectable={multiSelect} selected={selectedIds && selectedIds.has(l.id)} />)}
                </>
              )}
            </>
          );
        })()}
      </div>
      {footer}
    </div>
  );
}
