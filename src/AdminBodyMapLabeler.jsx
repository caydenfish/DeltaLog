import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { fetchMuscleDetailed } from "./lib/queries";
import {
  fetchMuscleGroupsList,
  fetchBodyMapShapeLabels,
  upsertBodyMapShapeLabel,
  upsertBodyMapShapeCategory,
  excludeBodyMapShape,
  clearBodyMapShapeLabel,
} from "./lib/bodyMapShapeQueries";
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

const VIEW_ORDER = ["male_front", "male_back", "female_front", "female_back"];

const btn = { padding: "7px 12px", borderRadius: 8, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 12, cursor: "pointer" };
const btnPrimary = { ...btn, background: T.accent, borderColor: T.accent, fontWeight: 700 };

// Admin-only tool for turning the 620 anonymous closed shapes in the
// LaserCutLace DXF asset (src/lib/dxfBodyMapData.js -- pure geometry, no
// muscle names) into real muscle_detailed-keyed regions.
//
// Two independent tiers, tracked separately in body_map_shape_labels:
//   - Category (muscle_groups.key -- Chest/Back/Legs/...): fast, low-
//     ambiguity first pass.
//   - Region (muscle_detailed.key -- Upper Chest/Front Delts/...): the
//     precise pass the live heatmap will actually use.
// Region mode's dropdown narrows to the shape's already-assigned
// category when every selected shape shares one, so the fast pass
// actually speeds up the precise pass instead of being separate busywork.
//
// The shapes render with a neutral anatomical fill + stroke directly
// (the real DXF art, confirmed to look correct on its own) rather than
// against a separately-rendered reference image -- an external PNG
// crop turned out not to share the same coordinate frame as this
// geometry (different aspect ratio even after tight-cropping), so
// overlaying it caused shapes to visually sit in the wrong place even
// though the click targets themselves were correct. Same coordinate
// system for the picture and the click targets means alignment is
// guaranteed, not something to calibrate.
export default function AdminBodyMapLabeler({ onClose }) {
  const [view, setView] = useState("male_front");
  const [mode, setMode] = useState("category"); // "category" | "region"
  const [shapeData, setShapeData] = useState(null); // { [view]: { w, h, shapes } }, loaded lazily
  const [labels, setLabels] = useState({}); // shapeId -> { muscleKey, category, excluded }
  const [muscleGroups, setMuscleGroups] = useState([]);
  const [muscleDetailed, setMuscleDetailed] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [pendingValue, setPendingValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState(null);
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < 760);
  const canvasRef = useRef(null);
  const [canvasWidth, setCanvasWidth] = useState(600);

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 760);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const el = canvasRef.current;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) setCanvasWidth(entry.contentRect.width);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    fetchMuscleGroupsList().then(setMuscleGroups).catch((e) => setError(e.message));
    fetchMuscleDetailed().then(setMuscleDetailed).catch((e) => setError(e.message));
    import("./lib/dxfBodyMapData").then((mod) => setShapeData(mod.DXF_BODY_MAP_SHAPES));
  }, []);

  const loadView = useCallback((v) => {
    setLoading(true);
    setSelected(new Set());
    fetchBodyMapShapeLabels(v)
      .then(setLabels)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadView(view); }, [view, loadView]);
  useEffect(() => { setSelected(new Set()); setPendingValue(""); }, [mode]);

  const viewData = shapeData?.[view];
  const total = viewData?.shapes.length ?? 0;
  const categorized = Object.values(labels).filter((r) => r.category).length;
  const regioned = Object.values(labels).filter((r) => r.muscleKey).length;

  // Region dropdown: if every selected shape already shares one category,
  // narrow the list to that category's regions. Otherwise show everything,
  // grouped by category for scannability.
  const regionOptions = useMemo(() => {
    if (mode !== "region") return [];
    const selCats = new Set([...selected].map((id) => labels[id]?.category).filter(Boolean));
    if (selCats.size === 1) {
      const [onlyCat] = selCats;
      return { grouped: false, items: muscleDetailed.filter((m) => m.generic_group === onlyCat) };
    }
    const byGroup = {};
    for (const m of muscleDetailed) {
      (byGroup[m.generic_group] ||= []).push(m);
    }
    return { grouped: true, items: byGroup };
  }, [mode, selected, labels, muscleDetailed]);

  function toggleShape(id, additive) {
    setSelected((prev) => {
      const next = additive ? new Set(prev) : new Set();
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function assignSelected() {
    if (!pendingValue || selected.size === 0) return;
    setSaving(true);
    try {
      for (const id of selected) {
        if (mode === "category") await upsertBodyMapShapeCategory(view, Number(id), pendingValue);
        else await upsertBodyMapShapeLabel(view, Number(id), pendingValue);
      }
      setLabels(await fetchBodyMapShapeLabels(view));
      setSelected(new Set());
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function excludeSelected() {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      for (const id of selected) await excludeBodyMapShape(view, Number(id));
      setLabels(await fetchBodyMapShapeLabels(view));
      setSelected(new Set());
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function clearSelected() {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      for (const id of selected) await clearBodyMapShapeLabel(view, Number(id));
      setLabels(await fetchBodyMapShapeLabels(view));
      setSelected(new Set());
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 40, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: T.text, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700 }}>Body Map Labeler</div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.dim }}><IconX size={20} /></button>
      </div>

      <div style={{ display: "flex", gap: 6, padding: "10px 16px", borderBottom: `1px solid ${T.line}`, flexWrap: "wrap", alignItems: "center" }}>
        {VIEW_ORDER.map((v) => (
          <button key={v} onClick={() => setView(v)} style={v === view ? btnPrimary : btn}>
            {v.replace("_", " ")}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: T.line, margin: "0 6px" }} />
        <button onClick={() => setMode("category")} style={mode === "category" ? btnPrimary : btn}>Category mode</button>
        <button onClick={() => setMode("region")} style={mode === "region" ? btnPrimary : btn}>Region mode</button>
        <div style={{ marginLeft: "auto", color: T.dim, fontSize: 12 }}>
          {categorized}/{total} categorized · {regioned}/{total} regioned
        </div>
      </div>

      {error && <div style={{ color: T.accent, fontSize: 12, padding: "6px 16px" }}>{error}</div>}

      <div style={{ flex: 1, display: "flex", flexDirection: isNarrow ? "column" : "row", overflow: "hidden" }}>
        <div ref={canvasRef} style={{ flex: isNarrow ? "0 0 55vh" : 1, overflow: "auto", background: "#f4f4f4", padding: 20 }}>
          {loading || !viewData ? (
            <InlineLoading />
          ) : (
            <div style={{ position: "relative", width: (canvasWidth - 40) * zoom, height: ((canvasWidth - 40) * (viewData.h / viewData.w)) * zoom }}>
              <svg
                viewBox={`0 0 ${viewData.w} ${viewData.h}`}
                width={(canvasWidth - 40) * zoom}
                height={((canvasWidth - 40) * (viewData.h / viewData.w)) * zoom}
                style={{ position: "absolute", inset: 0, display: "block", background: "white", border: "1px solid #ddd" }}
              >
                {viewData.shapes.map((s) => {
                  const rec = labels[s.id];
                  const isSelected = selected.has(String(s.id));
                  const hasValueForMode = mode === "category" ? rec?.category : rec?.muscleKey;
                  let fill = "#d9d9d9"; // neutral anatomical fill -- this is the real DXF art, not a placeholder
                  if (rec?.excluded) fill = "#f0f0f0";
                  else if (isSelected) fill = "#ff6b6b";
                  else if (hasValueForMode) fill = mode === "category" ? "#a6c8f4" : "#a6e0a6";
                  return (
                    <path
                      key={s.id}
                      d={s.d}
                      fill={fill}
                      stroke={isSelected ? "#b02a2a" : "#666"}
                      strokeWidth={isSelected ? 0.025 : 0.01}
                      style={{ cursor: "pointer" }}
                      onClick={(e) => toggleShape(s.id, e.shiftKey)}
                    />
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        <div style={{
          width: isNarrow ? "100%" : 320,
          borderLeft: isNarrow ? "none" : `1px solid ${T.line}`,
          borderTop: isNarrow ? `1px solid ${T.line}` : "none",
          padding: 16,
          overflowY: "auto",
          background: T.surface,
        }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <button style={btn} onClick={() => setZoom((z) => Math.min(4, +(z * 1.25).toFixed(2)))}>Zoom in</button>
            <button style={btn} onClick={() => setZoom((z) => Math.max(0.4, +(z * 0.8).toFixed(2)))}>Zoom out</button>
            <button style={btn} onClick={() => setZoom(1)}>Reset</button>
            <span style={{ alignSelf: "center", color: T.dim, fontSize: 12, marginLeft: 4 }}>{Math.round(zoom * 100)}%</span>
          </div>

          <div style={{ color: T.text, fontSize: 13, marginBottom: 8 }}>
            <b>{selected.size}</b> shape(s) selected
          </div>
          <div style={{ color: T.dim, fontSize: 11, marginBottom: 12, lineHeight: 1.5 }}>
            {mode === "category"
              ? "Fast pass: which broad category does this shape belong to? Click a muscle in the picture, shift-click to add more, assign."
              : "Precise pass: exactly which region. Do Category mode first for a shape and this list narrows to just that category's regions."}
          </div>

          <select
            value={pendingValue}
            onChange={(e) => setPendingValue(e.target.value)}
            style={{ width: "100%", padding: 8, marginBottom: 8, background: T.surface2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 8 }}
          >
            <option value="">Choose {mode === "category" ? "a category" : "a region"}…</option>
            {mode === "category"
              ? muscleGroups.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)
              : regionOptions.grouped
                ? Object.entries(regionOptions.items).map(([group, items]) => (
                    <optgroup key={group} label={group}>
                      {items.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </optgroup>
                  ))
                : regionOptions.items.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          <button style={{ ...btnPrimary, width: "100%", marginBottom: 6, opacity: saving ? 0.6 : 1 }} disabled={saving || !pendingValue || selected.size === 0} onClick={assignSelected}>
            {saving ? "Saving…" : `Assign ${mode === "category" ? "category" : "region"}`}
          </button>
          <button style={{ ...btn, width: "100%", marginBottom: 6 }} disabled={saving || selected.size === 0} onClick={excludeSelected}>
            Mark as non-muscle (hand/foot/head)
          </button>
          <button style={{ ...btn, width: "100%", marginBottom: 16 }} disabled={saving || selected.size === 0} onClick={clearSelected}>
            Clear selection's labels
          </button>

          {selected.size === 1 && labels[[...selected][0]] && (
            <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 12, fontSize: 12, color: T.dim }}>
              <div><b style={{ color: T.text }}>Category:</b> {muscleGroups.find((g) => g.key === labels[[...selected][0]].category)?.label ?? "—"}</div>
              <div><b style={{ color: T.text }}>Region:</b> {muscleDetailed.find((m) => m.key === labels[[...selected][0]].muscleKey)?.label ?? "—"}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
