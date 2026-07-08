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

// Full tree-view CRUD for the three naming tiers: generic (muscle_groups)
// -> detailed (muscle_detailed) -> scientific (muscle_taxonomy). Each
// tier is independently addable, editable, and deletable -- deleting a
// generic or detailed entry that still has children is rejected by the
// DB's foreign key (migration_040) and the resulting error surfaces
// inline, rather than silently orphaning anything. Renaming a scientific
// name goes through renameMuscleScientific (migration_041), which
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

  function toggleGeneric(key) {
    setExpandedGenerics((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }
  function toggleDetailed(key) {
    setExpandedDetailed((prev) => {
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

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.9)", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto", background: T.bg, borderTop: `1px solid ${T.line}`, borderRadius: "20px 20px 0 0", padding: 20, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: T.text }}>Muscle taxonomy</div>
          <button onClick={onClose} aria-label="Close" style={smallBtn}>Done</button>
        </div>
        <div style={{ color: T.dim, fontSize: 11.5, margin: "6px 0 16px", lineHeight: 1.4 }}>
          Generic &rsaquo; Detailed &rsaquo; Scientific. Deleting a row with children is blocked until you move or remove them first.
        </div>
        {error && <div style={{ margin: "0 0 12px", padding: 10, borderRadius: 8, background: T.surface2, border: `1px solid ${T.accent}`, color: T.accent, fontSize: 12.5 }}>{error}</div>}

        {sortedGenerics.map((g) => {
          const genOpen = expandedGenerics.has(g.key);
          const children = detailedUnder(g.key);
          return (
            <div key={g.key} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: "8px 10px", boxSizing: "border-box" }}>
                <button onClick={() => toggleGeneric(g.key)} style={{ ...iconBtn, padding: 0 }} aria-label={genOpen ? "Collapse" : "Expand"}>
                  <span style={chevron(genOpen)}>&rsaquo;</span>
                </button>
                {editingGenericKey === g.key ? (
                  <>
                    <input
                      value={editGenericLabel}
                      onChange={(e) => setEditGenericLabel(e.target.value)}
                      autoFocus
                      style={{ flex: 1, minWidth: 0, background: T.surface2, border: `1px solid ${T.accent}`, borderRadius: 6, color: T.text, fontSize: 13, padding: "5px 8px", outline: "none", boxSizing: "border-box" }}
                    />
                    <button disabled={busy || !editGenericLabel.trim()} onClick={() => run(async () => { await updateMuscleGroupLabel(g.key, editGenericLabel); setEditingGenericKey(null); })} style={{ ...smallBtn, color: T.green, borderColor: T.green, flexShrink: 0 }}>Save</button>
                    <button onClick={() => setEditingGenericKey(null)} style={{ ...smallBtn, flexShrink: 0 }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <div style={{ flex: 1, minWidth: 0, color: T.text, fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.label}</div>
                    <span style={{ color: T.dim, fontSize: 10.5, flexShrink: 0 }}>{children.length}</span>
                    <button onClick={() => { setEditingGenericKey(g.key); setEditGenericLabel(g.label); }} style={{ ...smallBtn, flexShrink: 0 }}>Edit</button>
                    <button disabled={busy} onClick={() => run(() => deleteMuscleGroup(g.key))} aria-label={`Delete ${g.label}`} style={{ ...iconBtn, flexShrink: 0 }}><IconX size={13} /></button>
                  </>
                )}
              </div>

              {genOpen && (
                <div style={{ marginLeft: 22, marginTop: 4, borderLeft: `1px solid ${T.line}`, paddingLeft: 10 }}>
                  {children.map((d) => {
                    const detOpen = expandedDetailed.has(d.key);
                    const sciChildren = scientificUnder(d.key);
                    return (
                      <div key={d.key} style={{ marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, padding: "6px 8px", boxSizing: "border-box" }}>
                          <button onClick={() => toggleDetailed(d.key)} style={{ ...iconBtn, padding: 0 }} aria-label={detOpen ? "Collapse" : "Expand"}>
                            <span style={chevron(detOpen)}>&rsaquo;</span>
                          </button>
                          {editingDetailedKey === d.key ? (
                            <>
                              <input
                                value={editDetailedLabel}
                                onChange={(e) => setEditDetailedLabel(e.target.value)}
                                autoFocus
                                style={{ flex: 1, minWidth: 0, background: T.surface, border: `1px solid ${T.accent}`, borderRadius: 6, color: T.text, fontSize: 12.5, padding: "5px 8px", outline: "none", boxSizing: "border-box" }}
                              />
                              <select
                                value={d.generic_group}
                                onChange={(e) => run(() => updateMuscleDetailed(d.key, { genericGroup: e.target.value }))}
                                style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 6, color: T.text, fontSize: 11.5, padding: "5px 6px", outline: "none", flexShrink: 0, maxWidth: 90 }}
                              >
                                {sortedGenerics.map((gg) => <option key={gg.key} value={gg.key}>{gg.label}</option>)}
                              </select>
                              <button disabled={busy || !editDetailedLabel.trim()} onClick={() => run(async () => { await updateMuscleDetailed(d.key, { label: editDetailedLabel }); setEditingDetailedKey(null); })} style={{ ...smallBtn, color: T.green, borderColor: T.green, flexShrink: 0 }}>Save</button>
                              <button onClick={() => setEditingDetailedKey(null)} style={{ ...smallBtn, flexShrink: 0 }}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <div style={{ flex: 1, minWidth: 0, color: T.text, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</div>
                              <span style={{ color: T.dim, fontSize: 10.5, flexShrink: 0 }}>{sciChildren.length}</span>
                              <button onClick={() => { setEditingDetailedKey(d.key); setEditDetailedLabel(d.label); }} style={{ ...smallBtn, flexShrink: 0 }}>Edit</button>
                              <button disabled={busy} onClick={() => run(() => deleteMuscleDetailed(d.key))} aria-label={`Delete ${d.label}`} style={{ ...iconBtn, flexShrink: 0 }}><IconX size={12} /></button>
                            </>
                          )}
                        </div>

                        {detOpen && (
                          <div style={{ marginLeft: 20, marginTop: 4, borderLeft: `1px solid ${T.line}`, paddingLeft: 10 }}>
                            {sciChildren.map((s) => (
                              <div key={s.scientific_name} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 0", boxSizing: "border-box" }}>
                                {editingScientificName === s.scientific_name ? (
                                  <>
                                    <input
                                      value={editScientificValue}
                                      onChange={(e) => setEditScientificValue(e.target.value)}
                                      autoFocus
                                      style={{ flex: 1, minWidth: 0, background: T.surface2, border: `1px solid ${T.accent}`, borderRadius: 6, color: T.text, fontSize: 12, padding: "5px 8px", outline: "none", boxSizing: "border-box" }}
                                    />
                                    <button
                                      disabled={busy || !editScientificValue.trim()}
                                      onClick={() => run(async () => { await renameMuscleScientific(s.scientific_name, editScientificValue); setEditingScientificName(null); })}
                                      style={{ ...smallBtn, color: T.green, borderColor: T.green, flexShrink: 0 }}
                                    >Save</button>
                                    <button onClick={() => setEditingScientificName(null)} style={{ ...smallBtn, flexShrink: 0 }}>Cancel</button>
                                  </>
                                ) : (
                                  <>
                                    <div style={{ flex: 1, minWidth: 0, color: T.text, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.scientific_name}</div>
                                    <select
                                      value={d.key}
                                      onChange={(e) => run(() => updateMuscleTaxonomyEntry(s.scientific_name, { detailedKey: e.target.value }))}
                                      aria-label={`Move ${s.scientific_name}`}
                                      style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 6, color: T.dim, fontSize: 10.5, padding: "4px 6px", outline: "none", flexShrink: 0, maxWidth: 90 }}
                                    >
                                      {sortedDetailed.map((dd) => (
                                        <option key={dd.key} value={dd.key}>{dd.label}</option>
                                      ))}
                                    </select>
                                    <button onClick={() => { setEditingScientificName(s.scientific_name); setEditScientificValue(s.scientific_name); }} style={{ ...smallBtn, flexShrink: 0 }}>Edit</button>
                                    <button disabled={busy} onClick={() => run(() => deleteMuscleTaxonomyEntry(s.scientific_name))} aria-label={`Delete ${s.scientific_name}`} style={{ ...iconBtn, flexShrink: 0 }}><IconX size={12} /></button>
                                  </>
                                )}
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
                        placeholder="Detailed name (e.g. Lats)"
                        autoFocus
                        style={{ flex: 1, minWidth: 0, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 6, color: T.text, fontSize: 12.5, padding: "6px 8px", outline: "none", boxSizing: "border-box" }}
                      />
                      <button
                        disabled={busy || !newDetailedLabel.trim()}
                        onClick={() => run(async () => { await addMuscleDetailed(newDetailedLabel, g.key); setNewDetailedLabel(""); setAddingDetailedUnder(null); })}
                        style={{ ...smallBtn, color: T.accent, borderColor: T.accent, flexShrink: 0 }}
                      >Add</button>
                      <button onClick={() => { setAddingDetailedUnder(null); setNewDetailedLabel(""); }} style={{ ...smallBtn, flexShrink: 0 }}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => { setAddingDetailedUnder(g.key); setNewDetailedLabel(""); }} aria-label="Add detailed entry" style={{ ...pillAddBtn, marginTop: 4 }}>+</button>
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
          <button onClick={() => setAddingGenericOpen(true)} aria-label="Add generic group" style={{ ...pillAddBtn, marginTop: 10 }}>+</button>
        )}
      </div>
    </div>
  );
}
