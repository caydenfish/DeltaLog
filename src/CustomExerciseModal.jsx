import { useState, useEffect } from "react";
import { muscleLabel } from "./lib/muscleNomenclature";
import { fetchMuscleGroups, fetchMuscleTaxonomy, deriveEquipmentBucket } from "./lib/queries";
import { IconX, IconCheck } from "./Icons";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

// Groups the known muscles so the dropdown scans by region instead of one
// long flat list. Any muscle group an admin has added that isn't in one
// of these buckets yet falls into "Other" automatically, rather than
// being left out of the picker.
const KNOWN_CATEGORIES = [
  { label: "Upper Body", muscles: ["Chest", "Back", "Shoulders", "Arms", "Neck"] },
  { label: "Lower Body", muscles: ["Legs"] },
  { label: "Core", muscles: ["Core"] },
  { label: "Full Body", muscles: ["Full Body"] },
];

const EQUIPMENT_LIST = ["Barbell", "Dumbbell", "Cable", "Machine", "Kettlebell", "Bodyweight", "Other"];

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
        <MusclePickerSheet
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

// Full in-app picker: search box + grouped, tappable rows with a checkmark
// for anything already selected. Replaces the browser/OS native <select>,
// which renders as a clunky native wheel/list on mobile and can't be
// searched or multi-selected in place.
function MusclePickerSheet({ title, options, values, onToggle, onClose, renderLabel, groupFn }) {
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
                    onClick={() => onToggle(m)}
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

export default function CustomExerciseModal({ onClose, onCreate, onSave, initialExercise, initialName, scientificMode = false }) {
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

  useEffect(() => {
    if (scientificMode) {
      fetchMuscleTaxonomy()
        .then((rows) => {
          setTaxonomy(rows);
          setAllMuscles(rows.map((r) => r.scientific_name));
        })
        .catch(() => { setTaxonomy([]); setAllMuscles([]); });
    } else {
      fetchMuscleGroups()
        .then((rows) => setAllMuscles(rows.map((r) => r.key)))
        .catch(() => setAllMuscles(KNOWN_CATEGORIES.flatMap((c) => c.muscles)));
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

  function taxonomyLabel(scientificName) {
    const entry = (taxonomy || []).find((t) => t.scientific_name === scientificName);
    return entry ? `${entry.scientific_name} (${entry.detailed_name})` : scientificName;
  }

  function taxonomyGroup(scientificName) {
    const entry = (taxonomy || []).find((t) => t.scientific_name === scientificName);
    return entry ? entry.generic_group : "Other";
  }

  // The general "Muscle group" dropdown stays organized by region; any
  // group not in the known regions (something an admin only just added)
  // shows up under "Other" so it's still selectable.
  const knownFlat = new Set(KNOWN_CATEGORIES.flatMap((c) => c.muscles));
  const otherMuscles = (allMuscles || []).filter((m) => !knownFlat.has(m));
  function simpleGroup(m) {
    const cat = KNOWN_CATEGORIES.find((c) => c.muscles.includes(m));
    return cat ? cat.label : "Other";
  }

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (scientificMode && primaryMuscles.length === 0) {
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
              <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Muscle group</div>
              <select value={muscle} onChange={(e) => setMuscle(e.target.value)} style={selectStyle}>
                {KNOWN_CATEGORIES.map((cat) => (
                  <optgroup key={cat.label} label={cat.label}>
                    {[...cat.muscles].sort().map((m) => (
                      <option key={m} value={m}>{muscleLabel(m)}</option>
                    ))}
                  </optgroup>
                ))}
                {otherMuscles.length > 0 && (
                  <optgroup label="Other">
                    {[...otherMuscles].sort().map((m) => (
                      <option key={m} value={m}>{muscleLabel(m)}</option>
                    ))}
                  </optgroup>
                )}
              </select>

              <MusclePicker
                label="Primary muscles"
                values={primaryMuscles}
                onAdd={(m) => setPrimaryMuscles([...primaryMuscles, m])}
                onRemove={(m) => setPrimaryMuscles(primaryMuscles.filter((x) => x !== m))}
                options={allMuscles || []}
                groupFn={simpleGroup}
              />

              <MusclePicker
                label="Secondary muscles"
                values={secondaryMuscles}
                onAdd={(m) => setSecondaryMuscles([...secondaryMuscles, m])}
                onRemove={(m) => setSecondaryMuscles(secondaryMuscles.filter((x) => x !== m))}
                options={allMuscles || []}
                groupFn={simpleGroup}
              />
            </>
          )}

          <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Equipment</div>
          <select value={equipment} onChange={(e) => setEquipment(e.target.value)} style={selectStyle}>
            {[...EQUIPMENT_LIST].sort().map((eq) => (
              <option key={eq} value={eq}>{eq}</option>
            ))}
          </select>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.dim, marginBottom: 18, cursor: "pointer" }}>
            <span style={{ padding: "10px 14px", borderRadius: 10, border: `1px dashed ${T.line}`, flexShrink: 0, flex: 1, textAlign: "center" }}>
              {photoFile ? <>Photo selected <IconCheck size={12} /></> : existingMediaUrl ? "Photo set — tap to replace" : "+ Add photo (optional)"}
            </span>
            <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} style={{ display: "none" }} />
          </label>

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
            {saving ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save changes" : "Create & Add")}
          </button>
        </div>
      </div>
    </div>
  );
}
