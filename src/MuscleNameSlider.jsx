const T = {
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

export const MUSCLE_NAME_LEVELS = [
  { key: "generic", label: "General" },
  { key: "detailed", label: "Detailed" },
  { key: "specific", label: "Specific" },
  { key: "scientific", label: "Scientific" },
];

// Four-position slider for the muscle-naming granularity preference —
// General (Chest) -> Detailed (Upper Chest) -> Specific (Clavicular
// Head) -> Scientific (Pectoralis Major, Clavicular Head). A native
// range input driving the thumb/fill (so dragging, keyboard arrows, and
// tapping the track all just work), with its own tick marks and labels
// laid on top since a bare range input doesn't have either.
export default function MuscleNameSlider({ value, onChange }) {
  const idx = Math.max(0, MUSCLE_NAME_LEVELS.findIndex((l) => l.key === value));
  const max = MUSCLE_NAME_LEVELS.length - 1;
  const pct = (idx / max) * 100;

  return (
    <div>
      <div style={{ position: "relative", height: 28, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 4, borderRadius: 999, background: T.line }} />
        <div style={{ position: "absolute", left: 0, width: `${pct}%`, height: 4, borderRadius: 999, background: T.accent, transition: "width 0.15s ease" }} />
        {MUSCLE_NAME_LEVELS.map((l, i) => (
          <div
            key={l.key}
            style={{
              position: "absolute", left: `${(i / max) * 100}%`, transform: "translateX(-50%)",
              width: 8, height: 8, borderRadius: "50%",
              background: i <= idx ? T.accent : T.line,
              pointerEvents: "none",
            }}
          />
        ))}
        <input
          type="range"
          min={0}
          max={max}
          step={1}
          value={idx}
          onChange={(e) => onChange(MUSCLE_NAME_LEVELS[Number(e.target.value)].key)}
          aria-label="Muscle name detail level"
          style={{
            position: "absolute", left: 0, right: 0, width: "100%", height: 28, margin: 0,
            background: "transparent", appearance: "none", WebkitAppearance: "none", cursor: "pointer",
          }}
          className="dl-muscle-slider"
        />
      </div>
      <div style={{ display: "flex", marginTop: 2 }}>
        {MUSCLE_NAME_LEVELS.map((l, i) => (
          <div key={l.key} style={{ flex: 1, textAlign: i === 0 ? "left" : i === max ? "right" : "center", fontSize: 10.5, fontWeight: i === idx ? 700 : 400, color: i === idx ? T.accent : T.dim }}>
            {l.label}
          </div>
        ))}
      </div>
      <style>{`
        .dl-muscle-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${T.text};
          border: 2px solid ${T.accent};
          cursor: pointer;
        }
        .dl-muscle-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${T.text};
          border: 2px solid ${T.accent};
          cursor: pointer;
        }
        .dl-muscle-slider::-webkit-slider-runnable-track { background: transparent; }
        .dl-muscle-slider::-moz-range-track { background: transparent; }
      `}</style>
    </div>
  );
}
