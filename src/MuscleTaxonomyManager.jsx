import { useState } from "react";
import {
  addMuscleGroup, updateMuscleGroupLabel, deleteMuscleGroup,
  addMuscleDetailed, updateMuscleDetailed, deleteMuscleDetailed,
  addMuscleTaxonomyEntry, updateMuscleTaxonomyEntry, deleteMuscleTaxonomyEntry, renameMuscleScientific,
} from "./lib/queries";
import { IconX } from "./Icons";

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

const smallBtn = { background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 11 };
const iconBtn = { background: "none", border: "none", color: T.dim, padding: "4px 6px", cursor: "pointer" };
const pillAddBtn = { width: 24, height: 24, borderRadius: "50%", border: `1px solid ${T.accent}`, background: "none", color: T.accent, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, cursor: "pointer", flexShrink: 0 };
const chevron = (open) => ({ display: "inline-block", transition: "transform 0.15s", transform: open ? "rotate(90deg)" : "rotate(0deg)", color: T.dim, fontSize: 12, width: 14 });
const moveSelect = { background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 6, color: T.dim, fontSize: 10.5, padding: "4px 6px", outline: "none", flexShrink: 0, maxWidth: 90 };

// One editable row shared by all three tiers -- a label (or an inline
// rename form), an optional "move to a different parent" select, a
// child count, and Edit/Delete. Kept as one component so every tier
// looks and behaves identically instead of three hand-copied blocks
// slowly drifting apart.
function TierRow({ label, background, childCount, editing, editValue, onEditValueChange, onStartEdit, onSaveEdit, onCancelEdit, onDelete, deleteLabel, moveOptions, moveValue, onMove, busy, expandControl, renameVia }) {
  if (editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, background, border: `1px solid ${T.accent}`, borderRadius: 8, padding: "6px 8px", boxSizing: "border-box" }}>
        {expandControl}
        <input
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          autoFocus
          style={{ flex: 1, minWidth: 0, background: T.surface2, border: "none", borderRadius: 6, color: T.text, fontSize: 12.5, padding: "5px 8px", outline: "none", boxSizing: "border-box" }}
        />
        <button disabled={busy || !editValue.trim()} onClick={onSaveEdit} style={{ ...smallBtn, color: T.green, borderColor: T.green, flexShrink: 0 }}>Save</button>
        <button onClick={onCancelEdit} style={{ ...smallBtn, flexShrink: 0 }}>Cancel</button>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background, border: `1px solid ${T.line}`, borderRadius: 8, padding: "6px 8px", boxSizing: "border-box" }}>
      {expandControl}
      <div style={{ flex: 1, minWidth: 0, color: T.text, fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
      {childCount != null && <span style={{ color: T.dim, fontSize: 10.5, flexShrink: 0 }}>{childCount}</span>}
      {moveOptions && (
        <select value={moveValue} onChange={(e) => onMove(e.target.value)} aria-label={`Move ${label}`} style={moveSelect}>
          {moveOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      )}
      <button onClick={onStartEdit} style={{ ...smallBtn, flexShrink: 0 }}>{renameVia ? "Rename" : "Edit"}</button>
      <button disabled={busy} onClick={onDelete} aria-label={`Delete ${deleteLabel || label}`} style={{ ...iconBtn, flexShrink: 0 }}><IconX size={12} /></button>
    </div>
  );
}

// Full tree-view CRUD for the three naming tiers: Category
// (muscle_groups) -> Region (muscle_detailed) -> Anatomy
// (muscle_taxonomy). Each tier is independently addable, editable,
// movable (re-parentable), and deletable -- deleting a tier that still
// has children is rejected by the DB's foreign key and the resulting
// error surfaces inline, rather than silently orphaning anything.
// Renaming a scientific name goes through renameMuscleScientific, which
// cascades the rename into every exercise already tagged with the old
// name -- a bare table update can't do that since exercises store the
// name as raw text, not a foreign key. Everything here writes straight
// to Supabase; there's no separate sync step.
export default function MuscleTaxonomyManager({ muscleGroups, muscleDetailed, taxonomy, onReload, onClose }) {
  const [expandedGenerics, setExpandedGenerics] = useState(() => new Set());
  const [expandedDetailed, setExpandedDetailed] = useState(() => new Set());
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Add-forms: which tier/parent is currently showing an inline "new" row.
  const [addingGenericOpen, setAddingGenericOpen] = useState(false);
  const [newGenericLabel, setNewGenericLabel] = useState("");
  const [addingDetailedUnder, setAddingDetailedUnder] = useState(null); // generic key
  const [newDetailedLabel, setNewDetailedLabel] = useState("");
  const [addingScientificUnder, setAddingScientificUnder] = useState(null); // detailed key
  const [newScientificName, setNewScientificName] = useState("");

  // Edit-forms: which single row (by key) is being renamed.
  const [editingGenericKey, setEditingGenericKey] = useState(null);
  const [editGenericLabel, setEditGenericLabel] = useState("");
  const [editingDetailedKey, setEditingDetailedKey] = useState(null);
  const [editDetailedLabel, setEditDetailedLabel] = useState("");
  const [editingScientificName, setEditingScientificName] = useState(null);
  const [editScientificValue, setEditScientificValue] = useState("");

  // A same-name-as-a-scientific-entry warning, pending confirmation.
  const [nameWarning, setNameWarning] = useState(null); // { parentKey, label }

  function toggle(setFn, key) {
    setFn((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function run(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onReload();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  function detailedUnder(genericKey) {
    return (muscleDetailed || []).filter((d) => d.generic_group === genericKey).sort((a, b) => a.label.localeCompare(b.label));
  }
  function scientificUnder(detailedKey) {
    return (taxonomy || []).filter((s) => s.detailed_key === detailedKey).sort((a, b) => a.scientific_name.localeCompare(b.scientific_name));
  }

  const sortedGenerics = [...(muscleGroups || [])].sort((a, b) => a.label.localeCompare(b.label));
  const sortedDetailed = [...(muscleDetailed || [])].sort((a, b) => a.label.localeCompare(b.label));

  // The single most common way this taxonomy gets corrupted: someone
  // needs to tag an exercise with a scientific name that isn't in the
  // list yet, types it into "Add Region entry" instead of adding it as
  // an Anatomy row under the right existing Region, and ends up with a
  // stray Region entry whose label IS a scientific name -- so
  // muscleLabel(..., "detailed") just returns that scientific string
  // back, looking exactly like Anatomy mode leaking into Region mode.
  // Catch the obvious case (exact match against an existing
  // scientific_name) before it's created, and flag any existing rows
  // with the same problem.
  function looksLikeScientificName(label) {
    return (taxonomy || []).some((s) => s.scientific_name.toLowerCase() === label.trim().toLowerCase());
  }
  const suspectDetailed = sortedDetailed.filter((d) => looksLikeScientificName(d.label));

  function createDetailed(genericKey, label) {
    const trimmed = label.trim();
    if (looksLikeScientificName(trimmed)) { setNameWarning({ parentKey: genericKey, label: trimmed }); return; }
    run(async () => { await addMuscleDetailed(trimmed, genericKey); setNewDetailedLabel(""); setAddingDetailedUnder(null); });
  }
  function confirmNameWarning() {
    const { parentKey, label } = nameWarning;
    run(async () => {
      await addMuscleDetailed(label, parentKey);
      setNewDetailedLabel(""); setAddingDetailedUnder(null); setNameWarning(null);
    });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.9)", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto", background: T.bg, borderTop: `1px solid ${T.line}`, borderRadius: "20px 20px 0 0", padding: 20, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: T.text }}>Muscle taxonomy</div>
          <button onClick={onClose} aria-label="Close" style={smallBtn}>Done</button>
        </div>
        <div style={{ color: T.dim, fontSize: 11.5, margin: "6px 0 16px", lineHeight: 1.4 }}>
          Category &rsaquo; Region &rsaquo; Anatomy. Deleting a row with children is blocked until you move or remove them first.
        </div>
        {error && <div style={{ margin: "0 0 12px", padding: 10, borderRadius: 8, background: T.surface2, border: `1px solid ${T.accent}`, color: T.accent, fontSize: 12.5 }}>{error}</div>}

        {suspectDetailed.length > 0 && (
          <div style={{ margin: "0 0 16px", padding: 12, borderRadius: 10, background: "rgba(232,68,46,0.1)", border: `1px solid ${T.accent}` }}>
            <div style={{ color: T.accent, fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>
              {suspectDetailed.length} Region {suspectDetailed.length === 1 ? "entry looks" : "entries look"} like a mistagged scientific name
            </div>
            <div style={{ color: T.dim, fontSize: 12, lineHeight: 1.5, marginBottom: 8 }}>
              These will show up as a raw scientific name instead of a real label. Expand the group below, move its Anatomy entry to the correct Region using the dropdown, then delete this row.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {suspectDetailed.map((d) => <div key={d.key} style={{ color: T.text, fontSize: 12.5, fontWeight: 600 }}>&bull; {d.label}</div>)}
            </div>
          </div>
        )}

        {sortedGenerics.map((g) => {
          const genOpen = expandedGenerics.has(g.key);
          const detailedChildren = detailedUnder(g.key);
          return (
            <div key={g.key} style={{ marginBottom: 6 }}>
              <TierRow
                label={g.label}
                background={T.surface}
                childCount={detailedChildren.length}
                editing={editingGenericKey === g.key}
                editValue={editGenericLabel}
                onEditValueChange={setEditGenericLabel}
                onStartEdit={() => { setEditingGenericKey(g.key); setEditGenericLabel(g.label); }}
                onSaveEdit={() => run(async () => { await updateMuscleGroupLabel(g.key, editGenericLabel); setEditingGenericKey(null); })}
                onCancelEdit={() => setEditingGenericKey(null)}
                onDelete={() => run(() => deleteMuscleGroup(g.key))}
                busy={busy}
                expandControl={
                  <button onClick={() => toggle(setExpandedGenerics, g.key)} style={{ ...iconBtn, padding: 0 }} aria-label={genOpen ? "Collapse" : "Expand"}>
                    <span style={chevron(genOpen)}>&rsaquo;</span>
                  </button>
                }
              />

              {genOpen && (
                <div style={{ marginLeft: 20, marginTop: 4, borderLeft: `1px solid ${T.line}`, paddingLeft: 10 }}>
                  {detailedChildren.map((d) => {
                    const detOpen = expandedDetailed.has(d.key);
                    const sciChildren = scientificUnder(d.key);
                    return (
                      <div key={d.key} style={{ marginBottom: 6 }}>
                        <TierRow
                          label={d.label}
                          background={T.surface2}
                          childCount={sciChildren.length}
                          editing={editingDetailedKey === d.key}
                          editValue={editDetailedLabel}
                          onEditValueChange={setEditDetailedLabel}
                          onStartEdit={() => { setEditingDetailedKey(d.key); setEditDetailedLabel(d.label); }}
                          onSaveEdit={() => run(async () => { await updateMuscleDetailed(d.key, { label: editDetailedLabel }); setEditingDetailedKey(null); })}
                          onCancelEdit={() => setEditingDetailedKey(null)}
                          onDelete={() => run(() => deleteMuscleDetailed(d.key))}
                          busy={busy}
                          moveOptions={sortedGenerics.map((gg) => ({ key: gg.key, label: gg.label }))}
                          moveValue={g.key}
                          onMove={(newGenericKey) => run(() => updateMuscleDetailed(d.key, { genericGroup: newGenericKey }))}
                          expandControl={
                            <button onClick={() => toggle(setExpandedDetailed, d.key)} style={{ ...iconBtn, padding: 0 }} aria-label={detOpen ? "Collapse" : "Expand"}>
                              <span style={chevron(detOpen)}>&rsaquo;</span>
                            </button>
                          }
                        />

                        {detOpen && (
                          <div style={{ marginLeft: 20, marginTop: 4, borderLeft: `1px solid ${T.line}`, paddingLeft: 10 }}>
                            {sciChildren.map((s) => (
                              <div key={s.scientific_name} style={{ marginBottom: 4 }}>
                                <TierRow
                                  label={s.scientific_name}
                                  background={T.surface2}
                                  editing={editingScientificName === s.scientific_name}
                                  editValue={editScientificValue}
                                  onEditValueChange={setEditScientificValue}
                                  onStartEdit={() => { setEditingScientificName(s.scientific_name); setEditScientificValue(s.scientific_name); }}
                                  onSaveEdit={() => run(async () => { await renameMuscleScientific(s.scientific_name, editScientificValue); setEditingScientificName(null); })}
                                  onCancelEdit={() => setEditingScientificName(null)}
                                  onDelete={() => run(() => deleteMuscleTaxonomyEntry(s.scientific_name))}
                                  busy={busy}
                                  renameVia="rpc"
                                  moveOptions={sortedDetailed.map((dd) => ({ key: dd.key, label: dd.label }))}
                                  moveValue={d.key}
                                  onMove={(newDetailedKey) => run(() => updateMuscleTaxonomyEntry(s.scientific_name, { detailedKey: newDetailedKey }))}
                                  expandControl={<span style={{ width: 14, flexShrink: 0 }} />}
                                />
                              </div>
                            ))}

                            {addingScientificUnder === d.key ? (
                              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                                <input
                                  value={newScientificName}
                                  onChange={(e) => setNewScientificName(e.target.value)}
                                  placeholder="Scientific name"
                                  autoFocus
                                  style={{ flex: 1, minWidth: 0, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 6, color: T.text, fontSize: 12, padding: "6px 8px", outline: "none", boxSizing: "border-box" }}
                                />
                                <button
                                  disabled={busy || !newScientificName.trim()}
                                  onClick={() => run(async () => { await addMuscleTaxonomyEntry(newScientificName, d.key); setNewScientificName(""); setAddingScientificUnder(null); })}
                                  style={{ ...smallBtn, color: T.accent, borderColor: T.accent, flexShrink: 0 }}
                                >Add</button>
                                <button onClick={() => { setAddingScientificUnder(null); setNewScientificName(""); }} style={{ ...smallBtn, flexShrink: 0 }}>Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => { setAddingScientificUnder(d.key); setNewScientificName(""); }} aria-label="Add scientific entry" style={{ ...pillAddBtn, marginTop: 4 }}>+</button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {addingDetailedUnder === g.key ? (
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <input
                        value={newDetailedLabel}
                        onChange={(e) => setNewDetailedLabel(e.target.value)}
                        placeholder="Region name (e.g. Lats)"
                        autoFocus
                        style={{ flex: 1, minWidth: 0, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 6, color: T.text, fontSize: 12.5, padding: "6px 8px", outline: "none", boxSizing: "border-box" }}
                      />
                      <button disabled={busy || !newDetailedLabel.trim()} onClick={() => createDetailed(g.key, newDetailedLabel)} style={{ ...smallBtn, color: T.accent, borderColor: T.accent, flexShrink: 0 }}>Add</button>
                      <button onClick={() => { setAddingDetailedUnder(null); setNewDetailedLabel(""); }} style={{ ...smallBtn, flexShrink: 0 }}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => { setAddingDetailedUnder(g.key); setNewDetailedLabel(""); }} aria-label="Add Region entry" style={{ ...pillAddBtn, marginTop: 4 }}>+</button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {addingGenericOpen ? (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input
              value={newGenericLabel}
              onChange={(e) => setNewGenericLabel(e.target.value)}
              placeholder="e.g. Adductors"
              autoFocus
              style={{ flex: 1, minWidth: 0, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "8px 10px", outline: "none", boxSizing: "border-box" }}
            />
            <button
              disabled={busy || !newGenericLabel.trim()}
              onClick={() => run(async () => { await addMuscleGroup(newGenericLabel); setNewGenericLabel(""); setAddingGenericOpen(false); })}
              style={{ ...smallBtn, padding: "8px 14px", color: T.accent, borderColor: T.accent, flexShrink: 0 }}
            >Add</button>
            <button onClick={() => { setAddingGenericOpen(false); setNewGenericLabel(""); }} style={{ ...smallBtn, padding: "8px 14px", flexShrink: 0 }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setAddingGenericOpen(true)} aria-label="Add Category" style={{ ...pillAddBtn, marginTop: 10 }}>+</button>
        )}
      </div>

      {nameWarning && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.9)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box" }}>
          <div style={{ width: "100%", maxWidth: 380, background: T.surface, border: `1px solid ${T.accent}`, borderRadius: 14, padding: 18, boxSizing: "border-box" }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 8 }}>That's already a scientific name</div>
            <div style={{ color: T.dim, fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
              "{nameWarning.label}" is already tagged as an Anatomy entry somewhere in this list. Creating a Region group with the same name usually means the app will show that scientific name back to people instead of a real label.
              <br /><br />
              If you're trying to tag an exercise with this scientific name, expand down to the correct Region below and use its own "+" to add the scientific name there instead.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setNameWarning(null)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 13, fontWeight: 600 }}>Cancel</button>
              <button
                onClick={confirmNameWarning}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${T.accent}`, background: "rgba(232,68,46,0.12)", color: T.accent, fontSize: 13, fontWeight: 700 }}
              >
                Add anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
