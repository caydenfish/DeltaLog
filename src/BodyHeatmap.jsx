import { muscleLabel } from "./lib/muscleNomenclature";

const T = {
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
};

function MuscleRow({ muscle, count, nameMode, role, onSelect }) {
  // Primary is always one of 8 broad buckets (Legs, Arms, etc.) with no
  // real per-exercise granularity underneath it — "detailed"/"scientific"
  // mode would substitute a single representative sub-muscle (e.g. Legs
  // -> "Quads"), which misleadingly implies the whole row is that one
  // muscle when it's really every exercise in the broad bucket (calf
  // raises, adduction, everything). Secondary muscles are genuinely
  // tagged per-exercise, so they keep the real name mode.
  const label = role === "primary" ? muscleLabel(muscle, "generic") : muscleLabel(muscle, nameMode);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
      <span style={{ fontSize: 13, color: T.text }}>{label}</span>
      <button
        onClick={() => onSelect && onSelect(muscle, role)}
        style={{ fontSize: 12, color: T.dim, fontWeight: 600, background: "none", border: "none", padding: 0, textDecoration: "underline", textDecorationColor: "transparent", cursor: onSelect ? "pointer" : "default" }}
      >
        {count} set{count === 1 ? "" : "s"}
      </button>
    </div>
  );
}

// Reports which muscles were trained as two plain-language lists —
// "Primary Muscles" (the main mover of each exercise) and "Secondary
// Muscles" (assisting muscles) — each with a real set count, rather than
// trying to represent it on an anatomical figure.
// `primary`/`secondary` are maps of muscle group -> set count.
// `fullBodySets`, if present, is shown separately since "Full Body"
// exercises (carries, complexes) don't map to one muscle group.
// `scientific` toggles anatomical naming (e.g. "Anterior Deltoid" instead
// of "Shoulders"); pass it explicitly from a component with the pref in
// state, or omit to read the app-wide preference directly.
export default function BodyHeatmap({ primary = {}, secondary = {}, fullBodySets = 0, nameMode, onSelectMuscle }) {
  const primaryEntries = Object.entries(primary).sort((a, b) => b[1] - a[1]);
  const secondaryEntries = Object.entries(secondary).sort((a, b) => b[1] - a[1]);

  if (primaryEntries.length === 0 && secondaryEntries.length === 0 && fullBodySets === 0) {
    return <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "12px 0" }}>Nothing logged yet.</div>;
  }

  return (
    <div>
      {primaryEntries.length > 0 && (
        <>
          <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Primary muscles</div>
          {primaryEntries.map(([m, c]) => <MuscleRow key={m} muscle={m} count={c} nameMode={nameMode} role="primary" onSelect={onSelectMuscle} />)}
        </>
      )}
      {secondaryEntries.length > 0 && (
        <>
          <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, margin: primaryEntries.length ? "10px 0 4px" : "0 0 4px" }}>Secondary muscles</div>
          {secondaryEntries.map(([m, c]) => <MuscleRow key={m} muscle={m} count={c} nameMode={nameMode} role="secondary" onSelect={onSelectMuscle} />)}
        </>
      )}
      {fullBodySets > 0 && (
        <div style={{ textAlign: "center", marginTop: 8, fontSize: 12, color: T.dim }}>
          + Full-body work: <span style={{ color: T.text, fontWeight: 700 }}>{fullBodySets}</span> set{fullBodySets === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}
