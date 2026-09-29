import { IconDragHandle, IconStar, IconSuperset, IconTrash, IconRefresh, IconChevronDown, IconChevronUp } from "./Icons";
import ExerciseThumb from "./ExerciseThumb";
import { muscleColor } from "./lib/muscleTaxonomy";

// One exercise on the Edit Workout screen (v1.13.4). Collapsed it's a
// single clean row: drag handle, thumb, name, and a one-line summary
// ("3 sets · 1 warmup · 2:00 rest"). Tap to expand into labeled steppers
// and an action row, so the screen reads as a list instead of a wall of
// +/- buttons. Nothing wraps: names and summaries truncate.

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  soft: "#B8BDC7",
  accent: "#E8442E",
  gold: "#F2C94C",
  green: "#3BA55D",
};
const CONDENSED = "'Barlow Condensed', sans-serif";
const ONE_LINE = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const EQUIP_ABBR = { Barbell: "BB", Dumbbell: "DB", Cable: "CB", Machine: "MC", Kettlebell: "KB", Bodyweight: "BW", Other: "OT" };

const mmss = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

function Stepper({ label, value, onMinus, onPlus, note }) {
  const btn = { width: 40, height: 40, borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 48 }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: 15, color: T.text, ...ONE_LINE }}>{label}</span>
        {note && <span style={{ fontSize: 12, color: T.dim, ...ONE_LINE }}>{note}</span>}
      </div>
      <button onClick={onMinus} aria-label={`Less ${label.toLowerCase()}`} style={btn}>−</button>
      <div style={{ fontFamily: CONDENSED, fontSize: 20, fontWeight: 700, color: T.text, minWidth: 44, textAlign: "center" }}>{value}</div>
      <button onClick={onPlus} aria-label={`More ${label.toLowerCase()}`} style={btn}>+</button>
    </div>
  );
}

function Action({ icon, label, onClick, color, active }) {
  return (
    <button onClick={onClick} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, height: 60, borderRadius: 12, border: `1px solid ${active ? color || T.accent : T.line}`, background: active ? `${color || T.accent}1F` : T.surface2, color: color || T.text }}>
      {icon}
      <span style={{ fontSize: 12, fontWeight: 600, maxWidth: "100%", ...ONE_LINE }}>{label}</span>
    </button>
  );
}

export default function EditWorkoutCard({
  w, expanded, onToggleExpand, onDragStart, isFavorite,
  loggedSets = [], showLoggedSets, onToggleLoggedSets, onDeleteSet, formatSet,
  onAdjustPlanned, onAdjustWarmup, restSeconds, restCustom, onAdjustRest,
  showWarmupRest, warmupRestSeconds, warmupRestCustom, onAdjustWarmupRest,
  onFavorite, onReplace, onSuperset, inSuperset, linking, onRemove,
}) {
  const warm = w.plannedWarmup || 0;
  const summary = [
    `${w.planned} set${w.planned === 1 ? "" : "s"}`,
    warm ? `${warm} warmup` : null,
    `${mmss(restSeconds)} rest`,
    loggedSets.length ? `${loggedSets.length} logged` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div style={{ background: T.surface, border: `1px solid ${inSuperset || linking ? `${T.accent}99` : T.line}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", minHeight: 68 }}>
        <div
          onPointerDown={onDragStart}
          aria-label="Drag to reorder"
          style={{ width: 36, alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "center", color: T.dim, cursor: "grab", touchAction: "none", flexShrink: 0 }}
        >
          <IconDragHandle size={18} />
        </div>
        <button onClick={onToggleExpand} aria-expanded={expanded} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, padding: "10px 12px 10px 0", background: "none", border: "none", textAlign: "left" }}>
          {w.mediaUrl ? (
            <ExerciseThumb muscle={w.muscle} mediaUrl={w.mediaUrl} size={40} />
          ) : (
            <div aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 10, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: CONDENSED, fontWeight: 700, fontSize: 15, color: muscleColor(w.muscle) }}>
              {EQUIP_ABBR[w.equipment] || "—"}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <span style={{ fontFamily: CONDENSED, fontSize: 19, fontWeight: 600, color: T.text, ...ONE_LINE }}>{w.name}</span>
              {isFavorite && <IconStar size={13} filled style={{ color: T.gold, flexShrink: 0 }} />}
            </div>
            <span style={{ fontSize: 13, color: T.dim, ...ONE_LINE }}>{summary}</span>
          </div>
          <span style={{ color: T.dim, flexShrink: 0, display: "flex" }}>{expanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}</span>
        </button>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${T.line}`, padding: "8px 14px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
          {(w.suggested || w.ideology) && (
            <div style={{ display: "flex", gap: 6, padding: "4px 0 6px", overflow: "hidden" }}>
              {w.suggested && <span style={{ fontSize: 11, fontWeight: 700, color: "#7BD69B", border: `1px solid ${T.green}`, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>Balance pick</span>}
              {w.ideology && <span style={{ fontSize: 11, fontWeight: 700, color: T.dim, border: `1px solid ${T.line}`, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{w.ideology}</span>}
            </div>
          )}
          <Stepper label="Working sets" value={w.planned} onMinus={() => onAdjustPlanned(Math.max(1, w.planned - 1))} onPlus={() => onAdjustPlanned(Math.min(12, w.planned + 1))} />
          <Stepper label="Warmup sets" value={warm} onMinus={() => onAdjustWarmup(Math.max(0, warm - 1))} onPlus={() => onAdjustWarmup(Math.min(6, warm + 1))} />
          <Stepper label="Rest" note={restCustom ? "Custom for this exercise" : "Your default"} value={mmss(restSeconds)} onMinus={() => onAdjustRest(Math.max(15, restSeconds - 15))} onPlus={() => onAdjustRest(Math.min(600, restSeconds + 15))} />
          {showWarmupRest && (
            <Stepper label="Warmup rest" note={warmupRestCustom ? "Custom for this exercise" : "Your default"} value={mmss(warmupRestSeconds)} onMinus={() => onAdjustWarmupRest(Math.max(15, warmupRestSeconds - 15))} onPlus={() => onAdjustWarmupRest(Math.min(600, warmupRestSeconds + 15))} />
          )}

          {loggedSets.length > 0 && (
            <div style={{ marginTop: 6, background: T.surface2, borderRadius: 12, padding: "4px 12px" }}>
              <button onClick={onToggleLoggedSets} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 44, background: "none", border: "none", color: T.text, padding: 0 }}>
                <span style={{ fontSize: 15 }}>{loggedSets.length} logged set{loggedSets.length === 1 ? "" : "s"}</span>
                <span style={{ fontSize: 13, color: T.dim }}>{showLoggedSets ? "Hide" : "Edit"}</span>
              </button>
              {showLoggedSets && loggedSets.map((s, j) => (
                <div key={j} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, borderTop: `1px solid ${T.line}` }}>
                  <span style={{ width: 18, color: T.dim, fontSize: 13 }}>{j + 1}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: T.text, ...ONE_LINE }}>{formatSet(s)}</span>
                  <button onClick={() => onDeleteSet(j)} style={{ height: 32, padding: "0 10px", borderRadius: 8, border: `1px solid ${T.line}`, background: "none", color: T.accent, fontSize: 13, fontWeight: 600 }}>Remove</button>
                </div>
              ))}
            </div>
          )}

          {w.notes && <div style={{ fontSize: 13, color: T.dim, fontStyle: "italic", padding: "6px 0 0", ...ONE_LINE }}>Note: {w.notes}</div>}

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <Action icon={<IconStar size={17} filled={isFavorite} />} label={isFavorite ? "Favorited" : "Favorite"} color={isFavorite ? T.gold : undefined} active={isFavorite} onClick={onFavorite} />
            <Action icon={<IconRefresh size={17} />} label="Replace" onClick={onReplace} />
            <Action icon={<IconSuperset size={17} />} label={inSuperset ? "Unlink" : linking ? "Linking" : "Superset"} color={inSuperset || linking ? T.accent : undefined} active={inSuperset || linking} onClick={onSuperset} />
            <Action icon={<IconTrash size={17} />} label="Remove" color={T.accent} onClick={onRemove} />
          </div>
        </div>
      )}
    </div>
  );
}
