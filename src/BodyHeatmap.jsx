const T = {
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
};

function MuscleRow({ muscle, count, role, onSelect }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
      <span style={{ fontSize: 13, color: T.text }}>{muscle}</span>
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
// `primary`/`secondary` are maps of muscle name -> set count, already
// grouped and labeled at the caller's selected naming granularity
// (generic/detailed/scientific) by computeMuscleSetCounts — no further
// labeling needed here.
// `fullBodySets`, if present, is shown separately since "Full Body"
// exercises (carries, complexes) don't map to one muscle group.
export default function BodyHeatmap({ primary = {}, secondary = {}, fullBodySets = 0, onSelectMuscle }) {
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
          {primaryEntries.map(([m, c]) => <MuscleRow key={m} muscle={m} count={c} role="primary" onSelect={onSelectMuscle} />)}
        </>
      )}
      {secondaryEntries.length > 0 && (
        <>
          <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1, margin: primaryEntries.length ? "10px 0 4px" : "0 0 4px" }}>Secondary muscles</div>
          {secondaryEntries.map(([m, c]) => <MuscleRow key={m} muscle={m} count={c} role="secondary" onSelect={onSelectMuscle} />)}
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
