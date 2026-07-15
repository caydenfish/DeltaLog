import { useState, useEffect } from "react";
import { fetchMuscleGroups, fetchMuscleDetailed, fetchSplits, fetchSplitExclusions, addSplit, renameSplit, deleteSplit, addSplitMuscle, removeSplitMuscle, addSplitExclusion, removeSplitExclusion } from "./lib/queries";
import { setSplitsCache, setSplitExclusionsCache } from "./lib/splits";
import { muscleLabel } from "./lib/muscleNomenclature";
import { IconX } from "./Icons";
import { InlineLoading } from "./LoadingSpinner";

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

const smallBtn = { background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 12 };

// Admin-only CRUD for which muscle_groups belong to each split (Push,
// Pull, Legs, etc), plus which Regions within an included Category are
// carved back out (split_muscle_exclusions, migration_064) -- e.g. Push
// includes "Shoulders" but excludes "Rear Delts" since that's a
// pull-pattern muscle. Writes straight to the
// `splits`/`split_muscles`/`split_muscle_exclusions` tables. Every
// mutation re-fetches and re-populates the shared splits/exclusions
// cache (setSplitsCache/setSplitExclusionsCache from lib/splits.js) so
// the generator, exercise picker filters, and FAQ & Glossary's Split
// entry all reflect the change immediately -- no separate sync step, and
// no app update needed for the change to take effect for every user.
export default function SplitsManager({ onClose }) {
  const [splits, setSplits] = useState(null); // null = loading
  const [muscleGroups, setMuscleGroups] = useState([]);
  const [muscleDetailed, setMuscleDetailed] = useState([]);
  const [exclusions, setExclusions] = useState({}); // { [splitId]: Set(muscle_detailed_key) }
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [addingOpen, setAddingOpen] = useState(false);
  const [newName, setNewName] = useState("");

  async function reload() {
    const [splitRows, groups, detailed, exclusionRows] = await Promise.all([
      fetchSplits(),
      fetchMuscleGroups(),
      fetchMuscleDetailed(),
      fetchSplitExclusions(),
    ]);
    setSplits(splitRows);
    setMuscleGroups(groups);
    setMuscleDetailed(detailed);
    const exclusionMap = {};
    for (const row of exclusionRows) {
      if (!exclusionMap[row.splitId]) exclusionMap[row.splitId] = new Set();
      exclusionMap[row.splitId].add(row.key);
    }
    setExclusions(exclusionMap);
    setSplitsCache(splitRows);
    setSplitExclusionsCache(exclusionRows);
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const sortedGroups = [...muscleGroups].sort((a, b) => a.label.localeCompare(b.label));
  const sortedDetailed = [...muscleDetailed].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 30, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 400, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8, position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
          <button onClick={onClose} aria-label="Close" style={smallBtn}>‹</button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: T.text, textAlign: "center" }}>SPLITS</div>
          <div style={{ width: 26 }} />
        </div>

        <div style={{ padding: 16, flex: 1 }}>
          <div style={{ color: T.dim, fontSize: 12.5, lineHeight: 1.5, marginBottom: 16 }}>
            Which muscle groups belong to each split. Used by the workout generator, the exercise picker's split filter, and the Split entry in FAQ &amp; Glossary — changes apply everywhere immediately, for every user.
          </div>

          {error && <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: T.surface2, border: `1px solid ${T.accent}`, color: T.accent, fontSize: 12.5 }}>{error}</div>}

          {splits === null && <InlineLoading padding="16px 0" />}

          {splits && splits.map((s) => {
            const open = expanded.has(s.id);
            return (
              <div key={s.id} style={{ marginBottom: 10, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => toggleExpand(s.id)}
                    aria-label={open ? "Collapse" : "Expand"}
                    style={{ background: "none", border: "none", color: T.dim, padding: 0, fontSize: 13, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}
                  >
                    &rsaquo;
                  </button>
                  {editingId === s.id ? (
                    <>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        style={{ flex: 1, minWidth: 0, background: T.surface2, border: `1px solid ${T.accent}`, borderRadius: 6, color: T.text, fontSize: 14, padding: "5px 8px", outline: "none", boxSizing: "border-box" }}
                      />
                      <button disabled={busy || !editName.trim()} onClick={() => run(async () => { await renameSplit(s.id, editName); setEditingId(null); })} style={{ ...smallBtn, color: T.green, borderColor: T.green, flexShrink: 0 }}>Save</button>
                      <button onClick={() => setEditingId(null)} style={{ ...smallBtn, flexShrink: 0 }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <div style={{ flex: 1, minWidth: 0, color: T.text, fontSize: 14, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                      <span style={{ color: T.dim, fontSize: 11, flexShrink: 0 }}>{s.muscles.length}</span>
                      <button onClick={() => { setEditingId(s.id); setEditName(s.name); }} style={{ ...smallBtn, flexShrink: 0 }}>Rename</button>
                      <button disabled={busy} onClick={() => run(() => deleteSplit(s.id))} aria-label={`Delete ${s.name}`} style={{ background: "none", border: "none", color: T.dim, padding: "4px 6px", flexShrink: 0 }}><IconX size={13} /></button>
                    </>
                  )}
                </div>

                {open && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {sortedGroups.length === 0 && <div style={{ color: T.dim, fontSize: 12 }}>No muscle groups defined yet.</div>}
                      {sortedGroups.map((g) => {
                        const active = s.muscles.includes(g.key);
                        return (
                          <button
                            key={g.key}
                            disabled={busy}
                            onClick={() => run(() => (active ? removeSplitMuscle(s.id, g.key) : addSplitMuscle(s.id, g.key)))}
                            style={{ padding: "6px 11px", borderRadius: 999, fontSize: 12, fontWeight: 600, border: `1px solid ${active ? T.accent : T.line}`, background: active ? "rgba(232,68,46,0.15)" : T.surface2, color: active ? T.text : T.dim }}
                          >
                            {muscleLabel(g.key, "generic")}
                          </button>
                        );
                      })}
                    </div>

                    {(() => {
                      const regionOptions = sortedDetailed.filter((d) => s.muscles.includes(d.generic_group));
                      if (regionOptions.length === 0) return null;
                      const excludedKeys = exclusions[s.id] || new Set();
                      return (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
                          <div style={{ color: T.dim, fontSize: 11.5, marginBottom: 8 }}>
                            Exclude specific muscles (e.g. keep "Shoulders" for Push but drop Rear Delts):
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {regionOptions.map((d) => {
                              const excluded = excludedKeys.has(d.key);
                              return (
                                <button
                                  key={d.key}
                                  disabled={busy}
                                  onClick={() => run(() => (excluded ? removeSplitExclusion(s.id, d.key) : addSplitExclusion(s.id, d.key)))}
                                  style={{ padding: "6px 11px", borderRadius: 999, fontSize: 12, fontWeight: 600, border: `1px solid ${excluded ? T.accent : T.line}`, background: excluded ? "rgba(232,68,46,0.15)" : "transparent", color: excluded ? T.text : T.dim, textDecoration: excluded ? "line-through" : "none" }}
                                >
                                  {d.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}

          {addingOpen ? (
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Arm Day"
                autoFocus
                style={{ flex: 1, minWidth: 0, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "8px 10px", outline: "none", boxSizing: "border-box" }}
              />
              <button disabled={busy || !newName.trim()} onClick={() => run(async () => { await addSplit(newName); setNewName(""); setAddingOpen(false); })} style={{ ...smallBtn, padding: "8px 14px", color: T.accent, borderColor: T.accent }}>Add</button>
              <button onClick={() => { setAddingOpen(false); setNewName(""); }} style={{ ...smallBtn, padding: "8px 14px" }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setAddingOpen(true)} style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: `1px dashed ${T.line}`, background: "none", color: T.dim, fontSize: 13, fontWeight: 600, marginTop: 6 }}>+ Add split</button>
          )}
        </div>
      </div>
    </div>
  );
}
