import { useState, useEffect } from "react";
import { fetchAllMachineNames, renameMachineNameEverywhere, deleteMachineNameEverywhere } from "./lib/queries";
import { IconX, IconTrash, IconCheck, IconPencil } from "./Icons";
import { InlineLoading } from "./LoadingSpinner";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

const smallBtn = { background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 11 };

// Every custom machine name (Hammer Strength, Life Fitness, etc.) is
// saved per-exercise inside that exercise's setup — there's no separate
// machines table. Fixing a typo or standardizing a name used to mean
// finding and re-typing it on every single exercise it was added to.
// This screen collects the full distinct list once and lets a rename or
// delete apply everywhere at once (renameMachineNameEverywhere /
// deleteMachineNameEverywhere).
export default function MachineNamesManager({ user, onClose }) {
  const [names, setNames] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const [renaming, setRenaming] = useState(null); // name currently being renamed, or null
  const [renameDraft, setRenameDraft] = useState("");
  const [busyName, setBusyName] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(null);

  const load = () => {
    setError(null);
    fetchAllMachineNames(user.id).then(setNames).catch((err) => setError(err.message));
  };
  useEffect(load, [user.id]);

  async function confirmRename(oldName) {
    const next = renameDraft.trim();
    if (!next || next === oldName) { setRenaming(null); return; }
    setBusyName(oldName);
    try {
      await renameMachineNameEverywhere(user.id, oldName, next);
      setRenaming(null);
      load();
    } catch (err) {
      setError(err.message);
    }
    setBusyName(null);
  }

  async function confirmDelete(name) {
    setBusyName(name);
    try {
      await deleteMachineNameEverywhere(user.id, name);
      setConfirmingDelete(null);
      load();
    } catch (err) {
      setError(err.message);
    }
    setBusyName(null);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 2000, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 400, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26 }} />
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: T.text, textAlign: "center" }}>MACHINE NAMES</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: T.dim, justifySelf: "end" }}><IconX size={20} /></button>
        </div>

        <div style={{ padding: 16, flex: 1 }}>
          <div style={{ color: T.dim, fontSize: 12, marginBottom: 16, lineHeight: 1.5 }}>
            Every machine name you've added to any exercise's setup, in one place. Renaming or deleting one here applies everywhere it's used, instead of exercise by exercise.
          </div>

          {error && <div style={{ color: T.accent, fontSize: 13, marginBottom: 12 }}>{error}</div>}
          {names === null && <InlineLoading />}
          {names && names.length === 0 && (
            <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>No custom machines saved yet. Add one from any exercise's setup mid-workout.</div>
          )}

          {names && names.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {names.map((name) => (
                <div key={name} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12 }}>
                  {renaming === name ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        autoFocus
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") confirmRename(name); if (e.key === "Escape") setRenaming(null); }}
                        style={{ flex: 1, background: T.surface2, border: `1px solid ${T.accent}`, borderRadius: 8, color: T.text, fontSize: 14, padding: "8px 10px", outline: "none" }}
                      />
                      <button onClick={() => confirmRename(name)} disabled={busyName === name} aria-label="Save" style={{ ...smallBtn, color: T.accent, borderColor: T.accent }}><IconCheck size={13} /></button>
                      <button onClick={() => setRenaming(null)} style={smallBtn}>Cancel</button>
                    </div>
                  ) : confirmingDelete === name ? (
                    <div>
                      <div style={{ color: T.text, fontSize: 13, marginBottom: 8 }}>Delete "{name}" and its saved setup from every exercise?</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setConfirmingDelete(null)} style={{ flex: 1, ...smallBtn, padding: "8px 0" }}>Cancel</button>
                        <button onClick={() => confirmDelete(name)} disabled={busyName === name} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: T.accent, color: "#fff", fontSize: 12, fontWeight: 700 }}>
                          {busyName === name ? "…" : "Delete"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, color: T.text, fontSize: 14, fontWeight: 600 }}>{name}</div>
                      <button onClick={() => { setRenaming(name); setRenameDraft(name); }} aria-label={`Rename ${name}`} style={{ background: "none", border: "none", color: T.dim, padding: 4 }}><IconPencil size={14} /></button>
                      <button onClick={() => setConfirmingDelete(name)} aria-label={`Delete ${name}`} style={{ background: "none", border: "none", color: T.dim, padding: 4 }}><IconTrash size={14} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
