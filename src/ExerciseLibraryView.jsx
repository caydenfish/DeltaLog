import { useEffect, useState } from "react";
import { fetchExerciseLibrary, updateExercise, fetchMuscleGroups, fetchMuscleDetailed, fetchMuscleTaxonomy, createSharedExercise, uploadExerciseMedia } from "./lib/queries";
import { muscleLabel } from "./lib/muscleNomenclature";
import { MUSCLE_COLORS } from "./lib/muscleColors";
import ExerciseThumb from "./ExerciseThumb";
import MuscleTaxonomyManager from "./MuscleTaxonomyManager";
import CustomExerciseModal from "./CustomExerciseModal";
import MyCustomExercises from "./MyCustomExercises";
import { IconX } from "./Icons";

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
const pillAddBtn = { width: 26, height: 26, borderRadius: "50%", border: `1px solid ${T.accent}`, background: "none", color: T.accent, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, cursor: "pointer", flexShrink: 0 };
const filledPill = { display: "flex", alignItems: "center", gap: 6, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 999, padding: "5px 6px 5px 12px" };
const candidatePill = { background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 999, padding: "5px 12px", fontSize: 12, cursor: "pointer" };

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{label}</div>
      <div style={{ color: T.text, fontSize: 14 }}>{value}</div>
    </div>
  );
}

// Pill-based tagger for one muscle slot (primary or secondary). Selected
// scientific muscles render as filled removable pills; the trailing "+"
// pill toggles an inline row of outlined candidate pills (every taxonomy
// entry not already selected) -- tap one to add it. Replaces the old
// dropdown-select-plus-Add-button pattern entirely.
function MusclePillPicker({ title, selected, taxonomy, onAdd, onRemove, taxonomyLabel }) {
  const [open, setOpen] = useState(false);
  const candidates = (taxonomy || []).filter((t) => !selected.includes(t.scientific_name));
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {selected.map((m) => (
          <div key={m} style={filledPill}>
            <span style={{ color: T.text, fontSize: 12 }}>{taxonomyLabel(m)}</span>
            <button onClick={() => onRemove(m)} aria-label={`Remove ${m}`} style={{ background: "none", border: "none", color: T.dim, padding: 0, display: "flex" }}><IconX size={12} /></button>
          </div>
        ))}
        <button onClick={() => setOpen((o) => !o)} aria-label={`Add a ${title.toLowerCase()}`} style={pillAddBtn}>+</button>
      </div>
      {open && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, padding: 10, background: T.surface2, borderRadius: 10 }}>
          {candidates.length === 0 && <div style={{ color: T.dim, fontSize: 12 }}>Nothing left to add.</div>}
          {candidates.map((t) => (
            <button key={t.scientific_name} onClick={() => onAdd(t.scientific_name)} style={candidatePill}>{taxonomyLabel(t.scientific_name)}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// Single Exercise Library screen for everyone. Regular users get a
// read-only browse + detail view (no edit button, no taxonomy button).
// Admins get the same list plus an Edit button per row and a Taxonomy
// button in the header -- editing writes straight to the shared
// `exercises` table via updateExercise and is live for every user the
// moment it saves, no separate sync step. Admin only ever tags the
// Scientific muscle for primary/secondary; Detailed and Generic are
// derived through the taxonomy, and every display mode reads that
// derivation via muscleLabel -- there's nothing else to set by hand.
export default function ExerciseLibraryView({ muscleNameMode, onClose, isAdmin, userId }) {
  const [exercises, setExercises] = useState(undefined); // undefined = loading
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null); // read-only detail sheet (non-admin)
  const [browseGroup, setBrowseGroup] = useState(null); // null = tile grid; "ALL" or a generic group narrows in
  const [browseDetail, setBrowseDetail] = useState(null); // null = detail-tile grid (within a group); "ALL" or a detailed muscle narrows to the list

  const [muscleGroups, setMuscleGroups] = useState(undefined);
  const [muscleDetailed, setMuscleDetailed] = useState(undefined);
  const [taxonomy, setTaxonomy] = useState(undefined);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showTaxonomy, setShowTaxonomy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showMyCustom, setShowMyCustom] = useState(false);

  function load() {
    fetchExerciseLibrary(isAdmin).then(setExercises).catch((err) => setError(err.message));
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isAdmin) return;
    fetchMuscleGroups().then(setMuscleGroups).catch(() => setMuscleGroups([]));
    fetchMuscleDetailed().then(setMuscleDetailed).catch(() => setMuscleDetailed([]));
    fetchMuscleTaxonomy().then(setTaxonomy).catch(() => setTaxonomy([]));
  }, [isAdmin]);

  const q = search.trim().toLowerCase();
  const filtered = (exercises || []).filter((ex) => {
    if (browseGroup && browseGroup !== "ALL") {
      if (ex.muscle_group !== browseGroup) return false;
      if (browseDetail && browseDetail !== "ALL") {
        const detailedNames = (ex.primary_muscles || []).map((m) => muscleLabel(m, "detailed"));
        if (!detailedNames.includes(browseDetail)) return false;
      }
    }
    if (!q) return true;
    if (ex.name.toLowerCase().includes(q)) return true;
    return (ex.aliases || []).some((a) => a.toLowerCase().includes(q));
  });

  // Detailed muscle tiles for the second browse layer -- derived straight
  // from this group's exercises rather than a separate fetch, so regular
  // (non-admin) users get real tiles without needing taxonomy access.
  const detailOptions = browseGroup && browseGroup !== "ALL"
    ? [...new Set(
        (exercises || [])
          .filter((ex) => ex.muscle_group === browseGroup)
          .flatMap((ex) => (ex.primary_muscles || []).map((m) => muscleLabel(m, "detailed")))
      )].sort()
    : [];

  function pickGroup(m) {
    setBrowseGroup(m);
    setBrowseDetail(null);
  }
  function backFromList() {
    if (browseGroup === "ALL") {
      setBrowseGroup(null);
    } else {
      setBrowseDetail(null);
    }
    setSearch("");
  }

  function taxonomyLabel(scientificName) {
    const entry = (taxonomy || []).find((t) => t.scientific_name === scientificName);
    return entry ? `${entry.scientific_name} (${entry.detailed_name})` : scientificName;
  }

  function startEdit(ex) {
    setEditingId(ex.id);
    setDraft({
      name: ex.name,
      equipment: (ex.equipment || []).join(", "),
      primaryMuscles: [...(ex.primary_muscles || [])],
      secondaryMuscles: [...(ex.secondary_muscles || [])],
    });
    setError(null);
  }

  const editingExercise = editingId ? (exercises || []).find((e) => e.id === editingId) : null;
  const computedMuscleGroup = draft && draft.primaryMuscles.length > 0
    ? ((taxonomy || []).find((t) => t.scientific_name === draft.primaryMuscles[0])?.generic_group || editingExercise?.muscle_group || "")
    : (editingExercise?.muscle_group || "");

  async function saveDraft() {
    setSaving(true);
    setError(null);
    try {
      const equipmentList = draft.equipment.split(",").map((s) => s.trim()).filter(Boolean);
      await updateExercise(editingId, {
        name: draft.name.trim(),
        equipment: equipmentList,
        muscleGroup: computedMuscleGroup,
        primaryMuscles: draft.primaryMuscles,
        secondaryMuscles: draft.secondaryMuscles,
      });
      setExercises((prev) => prev.map((ex) => (ex.id === editingId ? {
        ...ex,
        name: draft.name.trim(),
        equipment: equipmentList,
        muscle_group: computedMuscleGroup,
        primary_muscles: draft.primaryMuscles,
        secondary_muscles: draft.secondaryMuscles,
      } : ex)));
      setEditingId(null);
      setDraft(null);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  function addPrimary(name) {
    if (draft.primaryMuscles.includes(name)) return;
    setDraft({ ...draft, primaryMuscles: [...draft.primaryMuscles, name] });
  }
  function removePrimary(name) {
    setDraft({ ...draft, primaryMuscles: draft.primaryMuscles.filter((m) => m !== name) });
  }
  function addSecondary(name) {
    if (draft.secondaryMuscles.includes(name)) return;
    setDraft({ ...draft, secondaryMuscles: [...draft.secondaryMuscles, name] });
  }
  function removeSecondary(name) {
    setDraft({ ...draft, secondaryMuscles: draft.secondaryMuscles.filter((m) => m !== name) });
  }

  function reloadTaxonomyData() {
    fetchMuscleGroups().then(setMuscleGroups).catch(() => setMuscleGroups([]));
    fetchMuscleDetailed().then(setMuscleDetailed).catch(() => setMuscleDetailed([]));
    fetchMuscleTaxonomy().then(setTaxonomy).catch(() => setTaxonomy([]));
  }

  async function handleCreateShared({ name, muscle, primaryMuscles, secondaryMuscles, equipment, photoFile }) {
    let mediaUrl = null;
    if (photoFile) mediaUrl = await uploadExerciseMedia(userId, photoFile);
    const row = await createSharedExercise({ name, muscle, primaryMuscles, secondaryMuscles, equipment, mediaUrl });
    setExercises((prev) => [row, ...(prev || [])]);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 30, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 420, minHeight: "100vh", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: isAdmin ? "auto 1fr auto auto" : "auto 1fr auto", alignItems: "center", gap: 8 }}>
          <button onClick={onClose} aria-label="Close" style={smallBtn}>&#8249;</button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.text, textAlign: "center" }}>EXERCISE LIBRARY</div>
          {isAdmin && <button onClick={() => setShowTaxonomy(true)} aria-label="Manage muscle taxonomy" style={smallBtn}>Taxonomy</button>}
          {isAdmin ? (
            <button onClick={() => setShowCreate(true)} aria-label="New shared exercise" style={{ ...smallBtn, color: T.accent, borderColor: T.accent }}>+ New</button>
          ) : (
            <div style={{ width: 26 }} />
          )}
        </div>

        <div style={{ padding: 16, flex: 1, boxSizing: "border-box", minWidth: 0 }}>
          {error && <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: T.surface2, border: `1px solid ${T.accent}`, color: T.accent, fontSize: 13, boxSizing: "border-box" }}>{error}</div>}

          {browseGroup === null ? (
            <>
              <div style={{ color: T.dim, fontSize: 12, marginBottom: 12 }}>Browse by muscle group, or view everything.</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                {Object.keys(MUSCLE_COLORS).map((m) => (
                  <button
                    key={m}
                    onClick={() => pickGroup(m)}
                    style={{ padding: "22px 10px", borderRadius: 14, border: `1px solid ${T.line}`, background: T.surface, color: T.text, fontSize: 15, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5 }}
                  >
                    {muscleLabel(m, muscleNameMode)}
                  </button>
                ))}
              </div>
              <button
                onClick={() => pickGroup("ALL")}
                style={{ width: "100%", padding: "16px 10px", borderRadius: 14, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 15, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5, boxSizing: "border-box" }}
              >
                View All
              </button>
              <button
                onClick={() => setShowMyCustom(true)}
                style={{ width: "100%", padding: "14px 10px", borderRadius: 14, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 13, fontWeight: 600, marginTop: 10, boxSizing: "border-box" }}
              >
                My Custom Exercises
              </button>
            </>
          ) : browseGroup !== "ALL" && browseDetail === null ? (
            <>
              <button onClick={() => setBrowseGroup(null)} style={{ ...smallBtn, marginBottom: 12 }}>&#8249; {muscleLabel(browseGroup, muscleNameMode)}</button>
              <div style={{ color: T.dim, fontSize: 12, marginBottom: 12 }}>Narrow down further, or view all {muscleLabel(browseGroup, muscleNameMode)} exercises.</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                {detailOptions.map((d) => (
                  <button
                    key={d}
                    onClick={() => setBrowseDetail(d)}
                    style={{ padding: "18px 10px", borderRadius: 14, border: `1px solid ${T.line}`, background: T.surface, color: T.text, fontSize: 14, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5 }}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setBrowseDetail("ALL")}
                style={{ width: "100%", padding: "16px 10px", borderRadius: 14, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 15, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5, boxSizing: "border-box" }}
              >
                View All {muscleLabel(browseGroup, muscleNameMode)}
              </button>
            </>
          ) : (
            <>
              <button onClick={backFromList} style={{ ...smallBtn, marginBottom: 12 }}>
                &#8249; {browseGroup === "ALL" ? "All Exercises" : (browseDetail === "ALL" ? muscleLabel(browseGroup, muscleNameMode) : browseDetail)}
              </button>
              <input
                autoComplete="off"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search exercises or nicknames..."
                style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "8px 10px", outline: "none", boxSizing: "border-box", marginBottom: 12 }}
              />

              {exercises === undefined && <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>Loading...</div>}
              {exercises && filtered.length === 0 && <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>No matches.</div>}

              {filtered.map((ex) => {
                const missing = isAdmin && ((ex.primary_muscles || []).length === 0 || !ex.muscle_group || (ex.secondary_muscles || []).length === 0);
                return (
                  <div
                    key={ex.id}
                    onClick={() => setSelected(ex)}
                    style={{ width: "100%", boxSizing: "border-box", textAlign: "left", background: T.surface, border: `1px solid ${missing ? T.accent : T.line}`, borderRadius: 12, padding: 12, marginBottom: 8, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                  >
                    <ExerciseThumb muscle={ex.muscle_group} mediaUrl={ex.media_url} size={26} />
                    <div style={{ flex: 1, minWidth: 0, color: T.text, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ex.name}{ex.archived ? <span style={{ color: T.dim, fontWeight: 400 }}> (archived)</span> : ""}
                    </div>
                    {isAdmin ? (
                      <button onClick={(e) => { e.stopPropagation(); startEdit(ex); }} style={{ ...smallBtn, flexShrink: 0 }}>Edit</button>
                    ) : (
                      <div style={{ color: T.dim, fontSize: 16, flexShrink: 0 }}>&rsaquo;</div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.8)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 420, maxHeight: "85vh", overflowY: "auto", background: T.bg, borderTop: `1px solid ${T.line}`, borderRadius: "20px 20px 0 0", padding: 20, boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <ExerciseThumb muscle={selected.muscle_group} mediaUrl={selected.media_url} size={36} />
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 19, fontWeight: 700, color: T.text }}>{selected.name}</div>
            </div>

            <DetailRow label="Nicknames" value={(selected.aliases || []).join(", ")} />
            <DetailRow label="Equipment" value={(selected.equipment || []).join(", ")} />
            <DetailRow label="Muscle group" value={muscleLabel(selected.muscle_group, "generic")} />
            <DetailRow label="Primary muscles" value={(selected.primary_muscles || []).map((m) => muscleLabel(m, "detailed")).join(", ")} />
            <DetailRow label="Secondary muscles" value={(selected.secondary_muscles || []).map((m) => muscleLabel(m, "detailed")).join(", ")} />

            <button onClick={() => setSelected(null)} style={{ width: "100%", marginTop: 8, padding: "12px 0", borderRadius: 12, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 14, fontWeight: 600 }}>Close</button>
          </div>
        </div>
      )}

      {isAdmin && editingExercise && draft && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.8)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 420, maxHeight: "88vh", overflowY: "auto", background: T.bg, borderTop: `1px solid ${T.line}`, borderRadius: "20px 20px 0 0", padding: 20, boxSizing: "border-box" }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 4 }}>Edit exercise</div>
            <div style={{ color: T.dim, fontSize: 12, marginBottom: 16 }}>Changes here affect every user immediately.</div>

            <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Name</div>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 14, padding: "10px 12px", outline: "none", boxSizing: "border-box", marginBottom: 14 }}
            />

            <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Equipment (comma separated)</div>
            <input
              value={draft.equipment}
              onChange={(e) => setDraft({ ...draft, equipment: e.target.value })}
              placeholder="e.g. Barbell, Bench"
              style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 14, padding: "10px 12px", outline: "none", boxSizing: "border-box", marginBottom: 14 }}
            />

            <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Muscle group (auto, from primary)</div>
            <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: computedMuscleGroup ? T.text : T.accent, fontSize: 14, padding: "10px 12px", marginBottom: 16, boxSizing: "border-box" }}>
              {computedMuscleGroup || "No primary muscle tagged yet"}
            </div>

            <MusclePillPicker
              title="Primary muscles (scientific)"
              selected={draft.primaryMuscles}
              taxonomy={taxonomy}
              onAdd={addPrimary}
              onRemove={removePrimary}
              taxonomyLabel={taxonomyLabel}
            />

            <MusclePillPicker
              title="Secondary muscles (scientific)"
              selected={draft.secondaryMuscles}
              taxonomy={taxonomy}
              onAdd={addSecondary}
              onRemove={removeSecondary}
              taxonomyLabel={taxonomyLabel}
            />

            {error && <div style={{ color: T.accent, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setEditingId(null); setDraft(null); }} disabled={saving} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 14 }}>Cancel</button>
              <button onClick={saveDraft} disabled={saving || !draft.name.trim()} style={{ flex: 2, padding: "12px 0", borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 14, fontWeight: 700 }}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {showMyCustom && (
        <MyCustomExercises
          user={{ id: userId }}
          onClose={() => { setShowMyCustom(false); load(); }}
        />
      )}

      {isAdmin && showTaxonomy && (
        <MuscleTaxonomyManager
          muscleGroups={muscleGroups}
          muscleDetailed={muscleDetailed}
          taxonomy={taxonomy}
          onReload={reloadTaxonomyData}
          onClose={() => setShowTaxonomy(false)}
        />
      )}

      {isAdmin && showCreate && (
        <CustomExerciseModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreateShared}
          scientificMode
        />
      )}
    </div>
  );
}
