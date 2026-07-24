import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { fetchMuscleDetailed } from "./lib/queries";
import {
  fetchBodyMapShapeLabels,
  upsertBodyMapShapeLabel,
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

const PALETTE = [
  "#f4a6a6", "#f4d3a6", "#f4eea6", "#c9f4a6", "#a6f4c3", "#a6f4f0", "#a6d3f4", "#a6a6f4",
  "#d3a6f4", "#f4a6e8", "#f47ab0", "#f4c27a", "#7af4d0", "#c2b280", "#8fd9a8", "#e0a6f4",
  "#a6c8f4", "#f4b6a6", "#b6f4a6", "#f4e0a6", "#a6f4d3", "#d3f4a6", "#a6e8f4", "#f4a6c8",
  "#e8f4a6", "#c8a6f4", "#a6f4e0", "#f4d3e0", "#d0f4a6", "#a6b6f4", "#f4c8a6", "#c2f4e6",
];

const btn = { padding: "7px 12px", borderRadius: 8, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 12, cursor: "pointer" };
const btnPrimary = { ...btn, background: T.accent, borderColor: T.accent, fontWeight: 700 };

// Admin-only tool for turning the 620 anonymous closed shapes in the
// LaserCutLace DXF asset (src/lib/dxfBodyMapData.js -- pure geometry,
// no muscle names) into real muscle_detailed-keyed regions, persisted to
// body_map_shape_labels (migration_070). This is a labeling exercise,
// not a design tool: click shapes, assign the muscle an admin can see
// with their own eyes against the reference art, save. The live body
// map (BodyMap.jsx) keeps using the existing MIT-licensed asset until
// this labeling pass is far enough along to be trustworthy -- swapping
// happens as a separate, deliberate change once coverage looks real.
export default function AdminBodyMapLabeler({ onClose }) {
  const [view, setView] = useState("male_front");
  const [shapeData, setShapeData] = useState(null); // { [view]: { w, h, shapes } }, loaded lazily
  const [labels, setLabels] = useState({}); // shapeId -> { muscleKey, excluded }
  const [muscleDetailed, setMuscleDetailed] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [pendingMuscle, setPendingMuscle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState(null);
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < 760);
  const canvasRef = useRef(null);
  const [canvasWidth, setCanvasWidth] = useState(600);

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
    const onResize = () => setIsNarrow(window.innerWidth < 760);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const colorFor = useMemo(() => {
    const map = {};
    muscleDetailed.forEach((m, i) => (map[m.key] = PALETTE[i % PALETTE.length]));
    return map;
  }, [muscleDetailed]);

  useEffect(() => {
    fetchMuscleDetailed().then(setMuscleDetailed).catch((e) => setError(e.message));
    // 252KB of raw shape geometry, only ever needed on this admin screen --
    // dynamic import keeps it out of every regular user's initial bundle.
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

  const viewData = shapeData?.[view];
  const total = viewData?.shapes.length ?? 0;
  const reviewed = Object.keys(labels).length;

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
    if (!pendingMuscle || selected.size === 0) return;
    setSaving(true);
    try {
      for (const id of selected) {
        await upsertBodyMapShapeLabel(view, Number(id), pendingMuscle);
      }
      const fresh = await fetchBodyMapShapeLabels(view);
      setLabels(fresh);
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
      const fresh = await fetchBodyMapShapeLabels(view);
      setLabels(fresh);
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
      const fresh = await fetchBodyMapShapeLabels(view);
      setLabels(fresh);
      setSelected(new Set());
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const labelOf = (key) => muscleDetailed.find((m) => m.key === key)?.label ?? key;

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 40, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: T.text, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700 }}>Body Map Labeler</div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.dim }}><IconX size={20} /></button>
      </div>

      <div style={{ display: "flex", gap: 6, padding: "10px 16px", borderBottom: `1px solid ${T.line}`, flexWrap: "wrap" }}>
        {VIEW_ORDER.map((v) => (
          <button key={v} onClick={() => setView(v)} style={v === view ? btnPrimary : btn}>
            {v.replace("_", " ")}
          </button>
        ))}
        <div style={{ marginLeft: "auto", color: T.dim, fontSize: 12, alignSelf: "center" }}>
          {reviewed}/{total} reviewed in this view
        </div>
      </div>

      {error && <div style={{ color: T.accent, fontSize: 12, padding: "6px 16px" }}>{error}</div>}

      <div style={{ flex: 1, display: "flex", flexDirection: isNarrow ? "column" : "row", overflow: "hidden" }}>
        <div ref={canvasRef} style={{ flex: isNarrow ? "0 0 48vh" : 1, overflow: "auto", background: "#f4f4f4", padding: 20 }}>
          {loading || !viewData ? (
            <InlineLoading />
          ) : (
            <svg
              viewBox={`0 0 ${viewData.w} ${viewData.h}`}
              width={(canvasWidth - 40) * zoom}
              height={((canvasWidth - 40) * (viewData.h / viewData.w)) * zoom}
              style={{ background: "white", border: "1px solid #ddd", display: "block" }}
            >
              {viewData.shapes.map((s) => {
                const rec = labels[s.id];
                const isSelected = selected.has(String(s.id));
                let fill = "#d9d9d9";
                if (rec?.excluded) fill = "#f0f0f0";
                else if (rec?.muscleKey) fill = colorFor[rec.muscleKey] || "#a6d3f4";
                if (isSelected) fill = "#ff6b6b";
                return (
                  <path
                    key={s.id}
                    d={s.d}
                    fill={fill}
                    stroke={isSelected ? "#b02a2a" : "#888"}
                    strokeWidth={isSelected ? 2 : 1}
                    style={{ cursor: "pointer" }}
                    onClick={(e) => toggleShape(s.id, e.shiftKey)}
                  />
                );
              })}
            </svg>
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
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <button style={btn} onClick={() => setZoom((z) => Math.min(4, +(z * 1.25).toFixed(2)))}>Zoom in</button>
            <button style={btn} onClick={() => setZoom((z) => Math.max(0.4, +(z * 0.8).toFixed(2)))}>Zoom out</button>
            <button style={btn} onClick={() => setZoom(1)}>Reset</button>
            <span style={{ alignSelf: "center", color: T.dim, fontSize: 12, marginLeft: 4 }}>{Math.round(zoom * 100)}%</span>
          </div>

          <div style={{ color: T.text, fontSize: 13, marginBottom: 8 }}>
            <b>{selected.size}</b> shape(s) selected
          </div>
          <div style={{ color: T.dim, fontSize: 11, marginBottom: 12, lineHeight: 1.5 }}>
            Click to select, shift-click to add more. Select every piece of one muscle (e.g. all four ab blocks) before assigning.
          </div>

          <select
            value={pendingMuscle}
            onChange={(e) => setPendingMuscle(e.target.value)}
            style={{ width: "100%", padding: 8, marginBottom: 8, background: T.surface2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 8 }}
          >
            <option value="">Choose a muscle…</option>
            {muscleDetailed.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
          <button style={{ ...btnPrimary, width: "100%", marginBottom: 6, opacity: saving ? 0.6 : 1 }} disabled={saving || !pendingMuscle || selected.size === 0} onClick={assignSelected}>
            {saving ? "Saving…" : "Assign label"}
          </button>
          <button style={{ ...btn, width: "100%", marginBottom: 6 }} disabled={saving || selected.size === 0} onClick={excludeSelected}>
            Mark as non-muscle (hand/foot/head)
          </button>
          <button style={{ ...btn, width: "100%", marginBottom: 16 }} disabled={saving || selected.size === 0} onClick={clearSelected}>
            Clear selection's labels
          </button>

          <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 12 }}>
            <div style={{ color: T.text, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Legend</div>
            {Object.entries(labels)
              .reduce((acc, [id, rec]) => {
                if (rec.muscleKey && !acc.includes(rec.muscleKey)) acc.push(rec.muscleKey);
                return acc;
              }, [])
              .map((key) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.dim, marginBottom: 3 }}>
                  <span style={{ width: 12, height: 12, background: colorFor[key], display: "inline-block", borderRadius: 2 }} />
                  {labelOf(key)}
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
