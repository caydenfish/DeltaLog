import { useState, useEffect } from "react";
import Logo, { Wordmark } from "./Logo";
import { fetchSharedWorkout } from "./lib/queries";
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

// Public, read-only view of a shared workout — no login required. App.jsx
// renders this straight from the URL, before the auth gate, whenever a
// ?shared=CODE param is present. The snapshot was fully denormalized at
// share time (WorkoutHistory's shareWorkout), so this never touches the
// owner's live data or needs any RLS beyond "this row is public."
export default function SharedWorkoutView({ code, onDone }) {
  const [snapshot, setSnapshot] = useState(undefined); // undefined = loading, null = not found
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSharedWorkout(code)
      .then(setSnapshot)
      .catch((err) => { setError(err.message); setSnapshot(null); });
  }, [code]);

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, overflowY: "auto", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 420, minHeight: "100vh", display: "flex", flexDirection: "column", padding: "24px 16px 40px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 20 }}>
          <Logo size={44} />
          <Wordmark size={20} />
        </div>

        {snapshot === undefined && <InlineLoading padding="40px 0" />}

        {snapshot === null && (
          <div style={{ color: T.dim, fontSize: 14, textAlign: "center", padding: "40px 20px", border: `1px dashed ${T.line}`, borderRadius: 12 }}>
            {error || "This link doesn't point to a workout anymore."}
          </div>
        )}

        {snapshot && (
          <>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: T.text }}>{snapshot.dateLabel}</div>
              <div style={{ color: T.dim, fontSize: 13, marginTop: 2 }}>Shared from DeltaLog</div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[
                { label: "Sets", value: snapshot.totalSets },
                { label: "Volume", value: `${snapshot.totalVolume.toLocaleString()} ${snapshot.unit}` },
                { label: "Duration", value: snapshot.durationMin != null ? `${snapshot.durationMin} min` : "—" },
              ].map((s) => (
                <div key={s.label} style={{ flex: 1, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.text }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {(snapshot.exercises || []).map((ex, i) => (
              <div key={i} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 6 }}>{ex.name}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {(ex.sets || []).map((s, j) => (
                    <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: s.isWarmup ? "#E8A82E" : T.dim }}>{s.label}</span>
                      <span style={{ color: T.text, fontWeight: 600 }}>
                        {s.weight} {snapshot.unit} × {s.reps} <span style={{ color: T.dim, fontWeight: 400 }}>@ RIR {s.rir}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        <button onClick={onDone} style={{ marginTop: 20, width: "100%", padding: "14px 0", borderRadius: 14, border: `1px solid ${T.line}`, background: T.surface, color: T.text, fontSize: 15, fontWeight: 600 }}>
          Open DeltaLog
        </button>
      </div>
    </div>
  );
}
