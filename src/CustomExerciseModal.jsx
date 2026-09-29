import { useState, useEffect } from "react";
import { muscleLabel, muscleLabelsFor, genericBucket, detailedNameOf, muscleOptionsForMode, muscleColor, CATEGORIES } from "./lib/muscleTaxonomy";
import { getPrefs } from "./lib/prefs";
import { fetchMuscleTaxonomy, deriveEquipmentBucket } from "./lib/queries";
import { EQUIPMENT_LIST } from "./ExercisePicker";
import { IconX, IconCheck, IconChevronDown } from "./Icons";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};



const selectStyle = {
  width: "100%",
  background: T.surface,
  border: `1px solid ${T.line}`,
  borderRadius: 10,
  color: T.text,
  fontSize: 15,
  padding: "12px 14px",
  outline: "none",
  boxSizing: "border-box",
  marginBottom: 18,
  appearance: "auto",
};

const inputStyle = {
  width: "100%",
  background: T.surface,
  border: `1px solid ${T.line}`,
  borderRadius: 10,
  color: T.text,
  fontSize: 15,
  padding: "12px 14px",
  outline: "none",
  boxSizing: "border-box",
  marginBottom: 18,
};

// Multi-select chip picker shared by the primary and secondary muscle
// fields. Adding/removing happens through an in-app picker sheet (grouped
// by region, searchable, tap to toggle) instead of a native OS <select> —
// the native picker renders wildly differently across iOS/Android and,
// for the long scientific taxonomy list especially, is painful to scan.
function MusclePicker({ label, values, onAdd, onRemove, options, renderLabel, groupFn }) {
  const [showSheet, setShowSheet] = useState(false);
  const display = renderLabel || ((m) => muscleLabel(m));

  function toggle(m) {
    if (values.includes(m)) onRemove(m);
    else onAdd(m);
  }

  return (
    <>
      <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {values.length === 0 && <div style={{ color: T.dim, fontSize: 12 }}>None yet.</div>}
        {values.map((m) => (
          <div key={m} style={{ display: "flex", alignItems: "center", gap: 6, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 999, padding: "4px 10px" }}>
            <span style={{ color: T.text, fontSize: 12 }}>{display(m)}</span>
            <button onClick={() => onRemove(m)} aria-label={`Remove ${m}`} style={{ background: "none", border: "none", color: T.dim, fontSize: 12, padding: 0 }}><IconX size={12} /></button>
          </div>
        ))}
      </div>
      <button
        onClick={() => setShowSheet(true)}
        style={{ width: "100%", textAlign: "left", background: T.surface2, border: `1px dashed ${T.line}`, borderRadius: 8, color: T.dim, fontSize: 13, padding: "9px 12px", marginBottom: 18 }}
      >
        + Add muscle
      </button>

      {showSheet && (
        <MuscleTagSheet
          title={label}
          options={options}
          values={values}
          onToggle={toggle}
          onClose={() => setShowSheet(false)}
          renderLabel={display}
          groupFn={groupFn}
        />
      )}
    </>
  );
}

// Muscle tagging sheet (v1.13.3), matching the exercise picker: tagged
// muscles as removable chips on top, the muscle groups as a 4-up tile
// grid with a count badge for what's tagged in each, and the open
// group's options below as checkbox rows (grouped by Region when the
// options are finer than Region). In Category mode the tiles themselves
// are the options. Search spans every group.
const CONDENSED = "'Barlow Condensed', sans-serif";
const ONE_LINE = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
function MuscleTagSheet({ title, options, values, onToggle, onClose, renderLabel, groupFn }) {
  const [search, setSearch] = useState("");
  const catOf = (m) => (groupFn ? groupFn(m) : genericBucket(m)) || "Other";
  const categoryLevel = (options || []).length > 0 && (options || []).every((m) => catOf(m) === m);
  const cats = CATEGORIES.filter((c) => (options || []).some((m) => catOf(m) === c.key));
  const [openCat, setOpenCat] = useState(() => (values[0] ? catOf(values[0]) : cats[0]?.key || null));
  const q = search.trim().toLowerCase();
  const shown = (options || []).filter((m) => (q ? renderLabel(m).toLowerCase().includes(q) : catOf(m) === openCat));
  // Sub-group by Region only when the options are finer than Region.
  const regionOf = (m) => detailedNameOf(m);
  const finer = shown.some((m) => regionOf(m) && regionOf(m) !== renderLabel(m) && regionOf(m) !== m);
  const groups = [];
  for (const m of [...shown].sort((a, b) => renderLabel(a).localeCompare(renderLabel(b)))) {
    const g = q ? catOf(m) : finer ? regionOf(m) : "";
    let grp = groups.find((x) => x.name === g);
    if (!grp) { grp = { name: g, items: [] }; groups.push(grp); }
    grp.items.push(m);
  }
  const countIn = (cat) => values.filter((v) => catOf(v) === cat).length;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, height: "88dvh", background: T.bg, borderTop: `1px solid ${T.line}`, borderTopLeftRadius: 20, borderTopRightRadius: 20, display: "flex", flexDirection: "column" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: T.line, margin: "10px auto 6px", flexShrink: 0 }} />
        <div style={{ padding: "4px 16px 10px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0, fontFamily: CONDENSED, fontSize: 22, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: T.text, ...ONE_LINE }}>{title}</div>
          <button onClick={onClose} style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "none", background: "#C93A26", color: "#fff", fontFamily: CONDENSED, fontSize: 17, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>Done</button>
        </div>
        {values.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 16px 10px", flexShrink: 0 }}>
            {values.map((v) => (
              <div key={v} style={{ display: "flex", alignItems: "center", gap: 4, height: 34, padding: "0 4px 0 12px", borderRadius: 999, background: `${muscleColor(v)}26`, border: `1px solid ${muscleColor(v)}`, fontSize: 13, color: T.text, whiteSpace: "nowrap" }}>
                {renderLabel(v)}
                <button onClick={() => onToggle(v)} aria-label={`Remove ${renderLabel(v)}`} style={{ width: 28, height: 28, border: "none", background: "none", color: T.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}><IconX size={12} /></button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, padding: "0 16px 12px", flexShrink: 0 }}>
          {cats.map((c) => {
            const n = countIn(c.key);
            const on = categoryLevel ? values.includes(c.key) : openCat === c.key && !q;
            return (
              <button key={c.key} onClick={() => (categoryLevel ? onToggle(c.key) : (setOpenCat(c.key), setSearch("")))} aria-pressed={on} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "space-between", height: 64, padding: "8px 9px", borderRadius: 12, background: on ? `${c.color}2E` : T.surface, border: `1px solid ${on ? c.color : T.line}`, minWidth: 0, textAlign: "left", boxSizing: "border-box" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: c.color }} />
                  {n > 0 && !categoryLevel && <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: c.color, color: T.bg, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</span>}
                  {categoryLevel && on && <IconCheck size={13} style={{ color: T.text }} />}
                </div>
                <span style={{ fontFamily: CONDENSED, fontSize: 15, fontWeight: 600, textTransform: "uppercase", color: on ? T.text : "#B8BDC7", width: "100%", ...ONE_LINE }}>{c.key}</span>
              </button>
            );
          })}
        </div>
        {!categoryLevel && (
          <>
            <div style={{ padding: "0 16px 10px", flexShrink: 0 }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search all muscles" aria-label="Search all muscles" style={{ width: "100%", height: 44, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, color: T.text, fontSize: 16, padding: "0 12px", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 6, borderTop: `1px solid ${T.line}`, paddingTop: 10 }}>
              {groups.length === 0 && <div style={{ color: T.dim, fontSize: 14, textAlign: "center", padding: "24px 0" }}>No muscles match.</div>}
              {groups.map((g) => (
                <div key={g.name || "all"} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {g.name && <div style={{ fontFamily: CONDENSED, fontSize: 14, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: "#B8BDC7", padding: "6px 4px 0" }}>{g.name}</div>}
                  {g.items.map((m) => {
                    const on = values.includes(m);
                    const c = muscleColor(m);
                    return (
                      <button key={m} onClick={() => onToggle(m)} aria-pressed={on} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 52, padding: "8px 12px", borderRadius: 12, background: on ? `${c}14` : T.surface, border: `1px solid ${on ? `${c}80` : T.line}`, textAlign: "left" }}>
                        <span style={{ width: 24, height: 24, borderRadius: 7, boxSizing: "border-box", border: `2px solid ${on ? c : "#4A505B"}`, background: on ? c : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: T.bg, flexShrink: 0 }}>{on && <IconCheck size={13} />}</span>
                        <span style={{ fontSize: 15, color: T.text, ...ONE_LINE }}>{renderLabel(m)}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </>
        )}
        {categoryLevel && <div style={{ flex: 1 }} />}
      </div>
    </div>
  );
}

// Full in-app picker: search box + grouped, tappable rows with a checkmark
// for anything already selected. Replaces the browser/OS native <select>,
// which renders as a clunky native wheel/list on mobile and can't be
// searched or multi-selected in place.
function MusclePickerSheet({ title, options, values, onToggle, onClose, renderLabel, groupFn, single }) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const filtered = (options || []).filter((m) => !q || renderLabel(m).toLowerCase().includes(q));

  const groups = {};
  const order = [];
  for (const m of filtered) {
    const g = (groupFn ? groupFn(m) : null) || "All muscles";
    if (!groups[g]) { groups[g] = []; order.push(g); }
    groups[g].push(m);
  }
  for (const g of order) groups[g].sort((a, b) => renderLabel(a).localeCompare(renderLabel(b)));

  function handleRowClick(m) {
    onToggle(m);
    if (single) onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 420, height: "80dvh", background: T.bg, borderTop: `1px solid ${T.line}`, borderTopLeftRadius: 20, borderTopRightRadius: 20, display: "flex", flexDirection: "column" }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: T.line, margin: "10px auto 6px", flexShrink: 0 }} />
        <div style={{ padding: "6px 16px 10px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: T.text }}>{title}</div>
          <button onClick={onClose} aria-label="Done" style={{ background: "none", border: `1px solid ${T.accent}`, color: T.text, borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700 }}><IconCheck size={12} /> Done</button>
        </div>
        <div style={{ padding: "10px 16px", flexShrink: 0 }}>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search muscles…"
            style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, color: T.text, fontSize: 14, padding: "10px 12px", outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
          {order.length === 0 && <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>No muscles match "{search}".</div>}
          {order.map((g) => (
            <div key={g} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, padding: "10px 4px 4px" }}>{g}</div>
              {groups[g].map((m) => {
                const active = values.includes(m);
                return (
                  <button
                    key={m}
                    onClick={() => handleRowClick(m)}
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: active ? "rgba(232,68,46,0.1)" : "none", border: "none", borderBottom: `1px solid ${T.line}`, color: T.text, fontSize: 15, padding: "12px 4px", textAlign: "left" }}
                  >
                    <span>{renderLabel(m)}</span>
                    <span style={{ width: 20, height: 20, borderRadius: 999, border: `1px solid ${active ? T.accent : T.line}`, background: active ? T.accent : "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {active && <IconCheck size={11} />}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Single-select version of the same in-app sheet. Originally built for
// "Muscle group" but generic enough to reuse for Equipment too -- same
// reasoning as MusclePicker above (native select renders as a clunky
// wheel on Android with no search), just closing itself the instant a
// row is tapped instead of needing a separate "Done" action.
function SingleSelectPicker({ label, value, onChange, options, renderLabel, groupFn }) {
  const [showSheet, setShowSheet] = useState(false);
  const display = renderLabel || ((m) => muscleLabel(m));

  return (
    <>
      <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <button
        onClick={() => setShowSheet(true)}
        style={{ ...selectStyle, textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
      >
        <span>{value ? display(value) : "Select…"}</span>
        <IconChevronDown size={13} style={{ color: T.dim }} />
      </button>

      {showSheet && (
        <MusclePickerSheet
          title={label}
          options={options}
          values={value ? [value] : []}
          onToggle={(m) => onChange(m)}
          onClose={() => setShowSheet(false)}
          renderLabel={display}
          groupFn={groupFn}
          single
        />
      )}
    </>
  );
}


// ---- library matching (v1.13.3) --------------------------------------
// Catches duplicates before they're created: by name as it's typed, and
// by muscles + equipment once tagged. Also the source of the suggested
// muscle tags (from the closest library match, at the person's tier).
const STOP_WORDS = new Set(["the", "a", "an", "with", "and", "on", "of", "to", "for"]);
function nameTokens(str) {
  return String(str || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/)
    .filter((t) => t && !STOP_WORDS.has(t))
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t));
}
function nameMatch(typed, ex) {
  const a = nameTokens(typed);
  if (a.length === 0) return null;
  let best = null;
  for (const candidate of [ex.name, ...(ex.aliases || [])]) {
    const b = nameTokens(candidate);
    if (b.length === 0) continue;
    if (a.join(" ") === b.join(" ")) return { kind: "same", score: 2 };
    const inter = a.filter((t) => b.includes(t)).length;
    const ratio = inter / Math.max(a.length, b.length);
    const contained = inter === Math.min(a.length, b.length) && Math.min(a.length, b.length) >= 2;
    if ((inter >= 2 && ratio >= 0.5) || contained) {
      if (!best || ratio > best.score) best = { kind: "similar", score: ratio };
    }
  }
  return best;
}

function MatchPanel({ title, items, onUse }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 14, background: "#4E8DE814", border: "1px solid #4E8DE866", marginBottom: 18 }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: T.text }}>{title}</div>
      {items.map(({ ex, tag, strong }) => (
        <div key={ex.id} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 56, padding: "8px 8px 8px 12px", borderRadius: 12, background: T.surface, border: `1px solid ${T.line}` }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ex.name}</span>
              {tag && <span style={{ flexShrink: 0, padding: "2px 6px", borderRadius: 6, background: strong ? "#4E8DE840" : T.surface2, color: strong ? "#CFE0FB" : "#B8BDC7", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{tag}</span>}
            </div>
            <div style={{ fontSize: 12, color: T.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {muscleLabelsFor(ex.rawPrimaryMuscles, getPrefs().muscleNameMode).slice(0, 2).join(", ") || muscleLabel(ex.muscle, "generic")} · {ex.equipment}{ex.sessions > 0 ? " · Performed" : ""}
            </div>
          </div>
          {onUse && <button onClick={() => onUse(ex)} style={{ flexShrink: 0, height: 40, padding: "0 12px", borderRadius: 10, background: T.surface2, border: "1px solid #4A505B", color: T.text, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>Use this</button>}
        </div>
      ))}
    </div>
  );
}

export default function CustomExerciseModal({ onClose, onCreate, onSave, initialExercise, initialName, scientificMode = false, library, onUseExisting }) {
  const isEdit = Boolean(initialExercise);
  const [name, setName] = useState(initialExercise?.name || initialName || "");
  const [muscle, setMuscle] = useState(initialExercise?.muscle_group || "Chest");
  const [primaryMuscles, setPrimaryMuscles] = useState([...(initialExercise?.primary_muscles || [])]);
  const [secondaryMuscles, setSecondaryMuscles] = useState([...(initialExercise?.secondary_muscles || [])]);
  const [equipment, setEquipment] = useState(initialExercise?.equipment ? deriveEquipmentBucket(initialExercise.equipment) : "Barbell");
  const [photoFile, setPhotoFile] = useState(null);
  const [existingMediaUrl, setExistingMediaUrl] = useState(initialExercise?.media_url || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [allMuscles, setAllMuscles] = useState(null); // flat list of every known muscle-group key, for the pickers
  const [taxonomy, setTaxonomy] = useState(null); // scientificMode only: [{scientific_name, detailed_name, generic_group}]
  const [rejected, setRejected] = useState(() => new Set()); // suggested tags the person dismissed
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  useEffect(() => {
    if (scientificMode) {
      fetchMuscleTaxonomy()
        .then((rows) => {
          setTaxonomy(rows);
          setAllMuscles(rows.map((r) => r.scientific_name));
        })
        .catch(() => { setTaxonomy([]); setAllMuscles([]); });
    } else {
      // Regular users tag primary/secondary muscles at whatever
      // precision they've chosen in Training Preferences (Category /
      // Region / Anatomy) — Region and Anatomy come straight from the
      // same client-cached taxonomy the rest of the app already uses
      // (no fetch needed, it's loaded once near app startup), so this
      // can never drift out of sync with what that setting actually
      // means elsewhere.
      const mode = getPrefs().muscleNameMode;
      setAllMuscles(muscleOptionsForMode(mode).map((o) => o.key));
    }
  }, [scientificMode]);

  // Scientific mode: the general "Muscle group" isn't picked separately
  // — it's derived from whichever primary muscle is tagged first, via
  // the taxonomy's generic_group, so the two can't drift out of sync.
  useEffect(() => {
    if (!scientificMode || !taxonomy) return;
    const first = primaryMuscles[0];
    const entry = first && taxonomy.find((t) => t.scientific_name === first);
    if (entry) setMuscle(entry.generic_group);
  }, [scientificMode, taxonomy, primaryMuscles]);

  // Non-scientific mode: primary muscles can now be tagged at any of the
  // three precisions (Category/Region/Anatomy, matching Training
  // Preferences), so deriving muscle_group needs the same genericBucket
  // resolution used everywhere else in the app that reduces a raw tag
  // back to its broad bucket — a plain "take it as-is" only worked back
  // when primary muscles were always Category-tier to begin with.
  useEffect(() => {
    if (scientificMode) return;
    const first = primaryMuscles[0];
    if (first) setMuscle(genericBucket(first));
  }, [scientificMode, primaryMuscles]);

  function taxonomyLabel(scientificName) {
    const entry = (taxonomy || []).find((t) => t.scientific_name === scientificName);
    return entry ? `${entry.scientific_name} (${entry.detailed_name})` : scientificName;
  }

  function taxonomyGroup(scientificName) {
    const entry = (taxonomy || []).find((t) => t.scientific_name === scientificName);
    return entry ? entry.generic_group : "Other";
  }

  // Groups Primary/Secondary muscle options by broad bucket regardless
  // of which precision they're actually at (Category/Region/Anatomy) —
  // genericBucket resolves any tier back to its bucket, so this works
  // the same whether options are "Legs" or "Quads" or "Quadriceps
  // Femoris".
  function groupByGeneric(m) {
    return genericBucket(m) || "Other";
  }

  // ---- duplicate checks + suggestions -----------------------------------
  const nameMode = getPrefs().muscleNameMode;
  const lib = !isEdit && Array.isArray(library) ? library : [];
  const nameMatches = name.trim().length >= 3
    ? lib.map((ex) => ({ ex, m: nameMatch(name, ex) })).filter((x) => x.m)
        .sort((a, b) => b.m.score - a.m.score || (b.ex.sessions || 0) - (a.ex.sessions || 0))
        .slice(0, 3)
        .map(({ ex, m }) => ({ ex, tag: m.kind === "same" ? "Same name" : "Similar", strong: m.kind === "same" }))
    : [];
  const tagsFor = (raws) => (scientificMode ? (raws || []).filter((r) => (allMuscles || []).includes(r)) : muscleLabelsFor(raws, nameMode).filter((k) => (allMuscles || []).includes(k)));
  const source = nameMatches.map((x) => x.ex).find((ex) => (ex.rawPrimaryMuscles || []).length > 0) || null;
  const suggestedPrimary = source ? tagsFor(source.rawPrimaryMuscles).filter((k) => !rejected.has(k)) : [];
  const suggestedSecondary = source ? tagsFor(source.rawSecondaryMuscles).filter((k) => !suggestedPrimary.includes(k) && !rejected.has(k)) : [];
  const showSuggestion = !isEdit && !suggestionDismissed && primaryMuscles.length === 0 && suggestedPrimary.length > 0;
  function acceptSuggestion() {
    setPrimaryMuscles(suggestedPrimary);
    setSecondaryMuscles(suggestedSecondary);
    setSuggestionDismissed(true);
  }
  // Same primary muscles (at the person's tier) and equipment as an
  // existing exercise: likely a renamed duplicate.
  const tagKey = (arr) => [...new Set(arr)].sort().join("|");
  const chosenKey = tagKey(scientificMode ? primaryMuscles : primaryMuscles.map((m) => muscleLabel(m, nameMode)));
  const shownIds = new Set(nameMatches.map((x) => x.ex.id));
  const muscleMatches = primaryMuscles.length > 0
    ? lib.filter((ex) => !shownIds.has(ex.id) && ex.equipment === equipment && tagKey(scientificMode ? ex.rawPrimaryMuscles || [] : muscleLabelsFor(ex.rawPrimaryMuscles, nameMode)) === chosenKey).slice(0, 3).map((ex) => ({ ex, tag: "Same muscles" }))
    : [];
  const hasMatches = nameMatches.length > 0 || muscleMatches.length > 0;

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (primaryMuscles.length === 0) {
      setError("Add at least one primary muscle so the muscle group can be derived.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { name: trimmed, muscle, primaryMuscles, secondaryMuscles, equipment, photoFile };
      if (isEdit) {
        await onSave({ ...payload, existingMediaUrl });
      } else {
        await onCreate(payload);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 50, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 400, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8, position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 13 }}>‹</button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 21, fontWeight: 700, color: T.text, textAlign: "center" }}>{isEdit ? "EDIT EXERCISE" : "NEW CUSTOM EXERCISE"}</div>
          <div style={{ width: 26 }} />
        </div>

        <div style={{ padding: 16, flex: 1 }}>
          <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Exercise name</div>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Step-ups" style={inputStyle} />

          {nameMatches.length > 0 && (
            <MatchPanel title="Already in the library?" items={nameMatches} onUse={onUseExisting ? (ex) => { onUseExisting(ex); onClose(); } : null} />
          )}

          {showSuggestion && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, borderRadius: 14, background: T.surface, border: `1px solid ${T.line}`, marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: T.text }}>Suggested muscles</div>
                  <div style={{ fontSize: 12, color: T.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>From your library · {source.name}</div>
                </div>
                <button onClick={() => setSuggestionDismissed(true)} aria-label="Dismiss suggestion" style={{ width: 36, height: 36, border: "none", background: "none", color: T.dim, display: "flex", alignItems: "center", justifyContent: "center" }}><IconX size={13} /></button>
                <button onClick={acceptSuggestion} style={{ flexShrink: 0, height: 40, padding: "0 14px", borderRadius: 10, background: T.text, color: T.bg, border: "none", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>Accept all</button>
              </div>
              {[["Primary", suggestedPrimary], ["Secondary", suggestedSecondary]].filter(([, arr]) => arr.length > 0).map(([lbl, arr]) => (
                <div key={lbl} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: T.dim }}>{lbl}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {arr.map((k) => (
                      <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 4px 0 12px", borderRadius: 999, border: `1px dashed ${muscleColor(k)}`, fontSize: 13, color: "#E4E3DE", whiteSpace: "nowrap" }}>
                        <span style={{ width: 8, height: 8, borderRadius: 4, background: muscleColor(k) }} />
                        {scientificMode ? taxonomyLabel(k) : muscleLabel(k)}
                        <button onClick={() => setRejected((prev) => new Set([...prev, k]))} aria-label="Reject suggestion" style={{ width: 28, height: 28, border: "none", background: "none", color: T.dim, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}><IconX size={12} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {scientificMode ? (
            <>
              <MusclePicker
                label="Primary muscles (scientific name)"
                values={primaryMuscles}
                onAdd={(m) => setPrimaryMuscles([...primaryMuscles, m])}
                onRemove={(m) => setPrimaryMuscles(primaryMuscles.filter((x) => x !== m))}
                options={allMuscles || []}
                renderLabel={taxonomyLabel}
                groupFn={taxonomyGroup}
              />

              <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Muscle group (auto)</div>
              <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, color: primaryMuscles.length ? T.text : T.dim, fontSize: 14, padding: "12px 14px", marginBottom: 18 }}>
                {primaryMuscles.length ? muscle : "Add a primary muscle to derive this"}
              </div>

              <MusclePicker
                label="Secondary muscles (scientific name)"
                values={secondaryMuscles}
                onAdd={(m) => setSecondaryMuscles([...secondaryMuscles, m])}
                onRemove={(m) => setSecondaryMuscles(secondaryMuscles.filter((x) => x !== m))}
                options={allMuscles || []}
                renderLabel={taxonomyLabel}
                groupFn={taxonomyGroup}
              />
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Muscle group (auto)</div>
              <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, color: primaryMuscles.length ? T.text : T.dim, fontSize: 14, padding: "12px 14px", marginBottom: 18 }}>
                {primaryMuscles.length ? muscleLabel(muscle, "generic") : "Add a primary muscle to derive this"}
              </div>

              <MusclePicker
                label="Primary muscles"
                values={primaryMuscles}
                onAdd={(m) => setPrimaryMuscles([...primaryMuscles, m])}
                onRemove={(m) => setPrimaryMuscles(primaryMuscles.filter((x) => x !== m))}
                options={allMuscles || []}
                groupFn={groupByGeneric}
              />

              <MusclePicker
                label="Secondary muscles"
                values={secondaryMuscles}
                onAdd={(m) => setSecondaryMuscles([...secondaryMuscles, m])}
                onRemove={(m) => setSecondaryMuscles(secondaryMuscles.filter((x) => x !== m))}
                options={allMuscles || []}
                groupFn={groupByGeneric}
              />
            </>
          )}

          <SingleSelectPicker
            label="Equipment"
            value={equipment}
            onChange={setEquipment}
            options={EQUIPMENT_LIST}
            renderLabel={(e) => e}
          />

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.dim, marginBottom: 18, cursor: "pointer" }}>
            <span style={{ padding: "10px 14px", borderRadius: 10, border: `1px dashed ${T.line}`, flexShrink: 0, flex: 1, textAlign: "center" }}>
              {photoFile ? <>Photo selected <IconCheck size={12} /></> : existingMediaUrl ? "Photo set — tap to replace" : "+ Add photo (optional)"}
            </span>
            <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} style={{ display: "none" }} />
          </label>

          {muscleMatches.length > 0 && (
            <MatchPanel title="Same muscles and equipment" items={muscleMatches} onUse={onUseExisting ? (ex) => { onUseExisting(ex); onClose(); } : null} />
          )}

          {error && <div style={{ color: T.accent, fontSize: 12.5, marginBottom: 12 }}>{error}</div>}

          {!isEdit && !scientificMode && (
            <div style={{ fontSize: 11, color: T.dim, lineHeight: 1.5 }}>
              Only visible to you unless an admin adds it to the shared library.
            </div>
          )}
          {!isEdit && scientificMode && (
            <div style={{ fontSize: 11, color: T.dim, lineHeight: 1.5 }}>
              Created directly into the shared library, visible to every user.
            </div>
          )}
        </div>

        <div style={{ position: "sticky", bottom: 0, borderTop: `1px solid ${T.line}`, background: T.bg, padding: 16 }}>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || saving}
            style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: !name.trim() || saving ? T.surface2 : T.accent, color: !name.trim() || saving ? T.dim : "#fff", fontSize: 15, fontWeight: 700 }}
          >
            {saving ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save changes" : hasMatches ? "Create anyway" : "Create & Add")}
          </button>
        </div>
      </div>
    </div>
  );
}
