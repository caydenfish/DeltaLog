import { HOME_MODULE_LABELS } from "./lib/prefs";
import { IconDragHandle } from "./Icons";
import { useDragReorder, InsertionLine } from "./DragReorder";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

// The pencil-icon sheet on Home: lets someone turn dashboard modules on
// or off and reorder them, without touching anything else about how
// each module itself renders. Reorder is drag-based (same
// touch-and-mouse pointer drag used for Templates/exercise lists), not
// up/down buttons -- a drag handle is the natural control on a
// touchscreen, and matches how reordering already works everywhere else
// reordering exists in the app.
export default function HomeModulesEditor({ modules, onChange, onClose }) {
  const drag = useDragReorder(onChange);

  function toggle(idx) {
    onChange(modules.map((m, i) => (i === idx ? { ...m, enabled: !m.enabled } : m)));
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.8)", zIndex: 30, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div
        style={{ width: "100%", maxWidth: 420, maxHeight: "80vh", overflowY: "auto", background: T.bg, borderTop: `1px solid ${T.line}`, borderRadius: "20px 20px 0 0", padding: 20, boxSizing: "border-box" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 21, fontWeight: 700, color: T.text }}>Customize Home</div>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "5px 12px", fontSize: 13 }}>Done</button>
        </div>
        <div style={{ fontSize: 12.5, color: T.dim, marginBottom: 14 }}>Toggle modules on or off, and drag the handle to reorder them on your dashboard.</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {modules.map((m, i) => (
            <div
              key={m.id}
              ref={(el) => (drag.rowRefs.current[i] = el)}
              style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "10px 12px", opacity: drag.dragIndex === i ? 0.5 : 1 }}
            >
              <InsertionLine drag={drag} i={i} />
              <div
                onPointerDown={(e) => drag.startRowDrag(i, e)}
                aria-label="Drag to reorder"
                title="Drag to reorder"
                style={{ cursor: "grab", color: T.dim, touchAction: "none", flexShrink: 0, display: "flex", alignItems: "center", padding: "4px 2px" }}
              >
                <IconDragHandle size={18} />
              </div>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: m.enabled ? T.text : T.dim }}>{HOME_MODULE_LABELS[m.id] || m.id}</div>
              <button
                onClick={() => toggle(i)}
                aria-label={m.enabled ? "Disable module" : "Enable module"}
                aria-pressed={m.enabled}
                style={{ width: 42, height: 24, borderRadius: 999, border: `1px solid ${m.enabled ? T.accent : T.line}`, background: m.enabled ? "rgba(232,68,46,0.2)" : T.surface2, position: "relative", flexShrink: 0 }}
              >
                <span style={{ position: "absolute", top: 2, left: m.enabled ? 20 : 2, width: 18, height: 18, borderRadius: 999, background: m.enabled ? T.accent : T.dim, transition: "left 0.15s" }} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
