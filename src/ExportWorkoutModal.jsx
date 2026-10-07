import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import html2canvas from "html2canvas";
import { IconX, IconCheck, IconShare, IconDownload, IconRefresh } from "./Icons";
import { getPrefs, setPref } from "./lib/prefs";
import { fetchWorkoutHistory } from "./lib/queries";
import { buildExportStats, autoTitle } from "./lib/exportStats";
import { ExportFrame, LAYOUTS, FORMATS, ACCENTS, W, heightFor, photoBoxFor } from "./exportLayouts";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

// Instagram's baseline width; every format exports 1080 px wide (Story
// 1080x1920, Post 1080x1350, Square 1080x1080). The frame renders at
// W = 270 CSS px, so capture scale is a flat 4.
const EXPORT_TARGET_WIDTH = 1080;
const MAX_PHOTO_DIM = 1600;
const THUMB_SCALE = 0.3;

const INCLUDE = [
  { key: "prs", pref: "showPRs", label: "Highlight PRs" },
  { key: "date", pref: "showDate", label: "Date" },
  { key: "volume", pref: "showVolume", label: "Volume" },
  { key: "duration", pref: "showDuration", label: "Duration" },
  { key: "bodyweight", pref: "showBodyweight", label: "Bodyweight" },
  { key: "warmups", pref: "showWarmups", label: "Warmups" },
];
const DEFAULT_OPTS = { showPRs: true, showDate: true, showVolume: true, showDuration: true, showBodyweight: false, showWarmups: false };

const sectionLabel = { fontSize: 11, color: T.dim, marginBottom: 8, whiteSpace: "nowrap" };

// Reusable "save workout as image" sheet, used from the post-workout
// summary and from a workout's History detail view. `data`:
// { workoutId, completedAt, dateLabel, unit, totalSets, totalVolume,
//   durationMin, bodyWeight?, photoUrl?, muscleMap?: {primary, secondary, nameMode},
//   exercises: [{ exerciseId, name, muscleGroup, sets: [{label, weight, reps, rir, isWarmup}] }] }
// Weights are display units. `history` (raw fetchWorkoutHistory rows) is
// optional; when absent it's fetched once so PRs, last-session deltas,
// month and streak stats can be computed (see lib/exportStats.js).
export default function ExportWorkoutModal({ data, onClose, userId, history: historyProp }) {
  const remembered = getPrefs().exportImagePrefs || {};
  const hasPhoto = !!data.photoUrl;
  const validLayout = (key) => LAYOUTS.some((l) => l.key === key && (!l.photo || hasPhoto));
  // Pre-1.15 layout keys map to their closest new layout.
  const LEGACY = { card: "scoreboard", detailed: "log", story: hasPhoto ? "overlay" : "poster" };
  const initialLayout = LEGACY[remembered.layout] || remembered.layout;
  const [layout, setLayout] = useState(validLayout(initialLayout) ? initialLayout : "scoreboard");
  const [format, setFormat] = useState(FORMATS.some((f) => f.key === remembered.format) ? remembered.format : "story");
  const [accent, setAccent] = useState(ACCENTS.includes(remembered.accent) ? remembered.accent : ACCENTS[0]);
  const [opts, setOpts] = useState(() => {
    const o = { ...DEFAULT_OPTS };
    for (const k of Object.keys(DEFAULT_OPTS)) if (typeof remembered[k] === "boolean") o[k] = remembered[k];
    return o;
  });
  const defaultTitle = useMemo(() => autoTitle(data.exercises), [data.exercises]);
  const [title, setTitle] = useState("");
  const [history, setHistory] = useState(historyProp || null);
  const [saving, setSaving] = useState(null); // "save" | "share" | null
  const [saveError, setSaveError] = useState(null);
  const [rawPhotoImg, setRawPhotoImg] = useState(null);
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const frameRef = useRef(null);
  const containerRef = useRef(null);
  const H = heightFor(format);

  // History for PR/progress context. Fetched once if the caller didn't
  // pass it; the image renders immediately and PR highlights fill in
  // when this lands.
  useEffect(() => {
    if (historyProp || !userId) return;
    let cancelled = false;
    fetchWorkoutHistory(userId, null).then((h) => { if (!cancelled) setHistory(h || []); }).catch(() => { if (!cancelled) setHistory([]); });
    return () => { cancelled = true; };
  }, [historyProp, userId]);

  const stats = useMemo(() => (history ? buildExportStats({ data, history }) : null), [data, history]);

  // Photo step 1: fetch and downscale once per underlying photo. Keyed on
  // the URL path, not the signed URL, since the private bucket re-signs
  // on every read and the token changing would otherwise reload it.
  const photoUrlKey = data.photoUrl ? data.photoUrl.split("?")[0] : null;
  useEffect(() => {
    if (!data.photoUrl) { setRawPhotoImg(null); return; }
    let cancelled = false;
    fetch(data.photoUrl)
      .then((r) => r.blob())
      .then((blob) => new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
        img.onerror = (e) => { URL.revokeObjectURL(objectUrl); reject(e); };
        img.src = objectUrl;
      }))
      .then((img) => new Promise((resolve, reject) => {
        const scale = Math.min(1, MAX_PHOTO_DIM / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const out = new Image();
        out.onload = () => resolve(out);
        out.onerror = reject;
        out.src = canvas.toDataURL("image/jpeg", 0.9);
      }))
      .then((img) => { if (!cancelled) setRawPhotoImg(img); })
      .catch(() => { if (!cancelled) setRawPhotoImg(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the stable path should refetch
  }, [photoUrlKey]);

  // Photo step 2: crop to the exact box the active layout draws the photo
  // into (full frame, split top, polaroid window), cover-style. html2canvas
  // doesn't honor object-fit, so the pixels have to already be cropped.
  const box = photoBoxFor(layout, H);
  const boxAspect = box.w / box.h;
  useEffect(() => {
    if (!rawPhotoImg) { setPhotoDataUrl(null); return; }
    const nw = rawPhotoImg.naturalWidth, nh = rawPhotoImg.naturalHeight;
    let sx = 0, sy = 0, sw = nw, sh = nh;
    if (nw / nh > boxAspect) { sw = Math.round(nh * boxAspect); sx = Math.round((nw - sw) / 2); }
    else { sh = Math.round(nw / boxAspect); sy = Math.round((nh - sh) / 2); }
    const outW = Math.min(Math.round(EXPORT_TARGET_WIDTH * (box.w / W)), sw);
    const outH = Math.max(1, Math.round(outW / boxAspect));
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    canvas.getContext("2d").drawImage(rawPhotoImg, sx, sy, sw, sh, 0, 0, outW, outH);
    setPhotoDataUrl(canvas.toDataURL("image/jpeg", 0.92));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawPhotoImg, boxAspect]);

  const o = { ...opts, accent, title: title.trim() || defaultTitle };
  const ctx = (fmt) => ({ d: data, st: stats, o, fmt, H: heightFor(fmt), photo: photoDataUrl });
  const activeLayout = LAYOUTS.find((l) => l.key === layout) || LAYOUTS[0];

  function rememberPrefs() {
    setPref("exportImagePrefs", { layout, format, accent, ...opts });
  }

  async function renderCanvas() {
    if (containerRef.current) containerRef.current.scrollTop = 0;
    return html2canvas(frameRef.current, {
      backgroundColor: T.bg, scale: EXPORT_TARGET_WIDTH / W, useCORS: true, scrollX: 0, scrollY: 0, imageTimeout: 3000,
    });
  }

  const fileName = `deltalog-${(o.title || "workout").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${(data.dateLabel || "").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;

  async function handleSave() {
    if (!frameRef.current) return;
    setSaving("save");
    setSaveError(null);
    try {
      const canvas = await renderCanvas();
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      rememberPrefs();
    } catch {
      setSaveError("Couldn't generate the image. Try again.");
    }
    setSaving(null);
  }

  // Native share sheet (Instagram, Messages, etc.) where the browser
  // supports sharing files; the button only shows when it does.
  const canShareFiles = typeof navigator !== "undefined" && !!navigator.canShare && (() => {
    try { return navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] }); } catch { return false; }
  })();

  async function handleShare() {
    if (!frameRef.current) return;
    setSaving("share");
    setSaveError(null);
    try {
      const canvas = await renderCanvas();
      const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
      const file = new File([blob], fileName, { type: "image/png" });
      rememberPrefs();
      await navigator.share({ files: [file] });
    } catch (err) {
      if (err && err.name !== "AbortError") setSaveError("Couldn't share the image. Try Save instead.");
    }
    setSaving(null);
  }

  const chip = (on, disabled) => ({
    padding: "7px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
    border: `1px solid ${on && !disabled ? T.accent : T.line}`,
    background: on && !disabled ? "rgba(232,68,46,0.12)" : "transparent",
    color: on && !disabled ? T.accent : T.dim, opacity: disabled ? 0.4 : 1,
  });

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.85)", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 440, maxHeight: "94vh", display: "flex", flexDirection: "column", background: T.bg, borderTop: `1px solid ${T.line}`, borderRadius: "20px 20px 0 0" }}>
        <div style={{ padding: "16px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.text }}>Save as image</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 13 }}><IconX size={12} /></button>
        </div>

        <div ref={containerRef} style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
          {/* Live preview */}
          <div style={{ display: "flex", justifyContent: "center", background: T.surface2, borderRadius: 14, padding: 14, marginBottom: 14 }}>
            <div style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}>
              <ExportFrame layout={layout} ctx={ctx(format)} frameRef={frameRef} />
            </div>
          </div>

          {/* Layout strip: real mini renders of every layout */}
          <div style={sectionLabel}>Layout</div>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, marginBottom: 12, marginRight: -16, paddingRight: 16 }}>
            {LAYOUTS.map((l) => {
              const locked = l.photo && !hasPhoto;
              const selected = layout === l.key;
              const th = heightFor(format);
              return (
                <button
                  key={l.key}
                  onClick={() => !locked && setLayout(l.key)}
                  aria-pressed={selected}
                  disabled={locked}
                  style={{ flexShrink: 0, background: "none", border: "none", padding: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, opacity: locked ? 0.4 : 1 }}
                >
                  <div style={{ width: W * THUMB_SCALE, height: th * THUMB_SCALE, borderRadius: 7, overflow: "hidden", outline: selected ? `2px solid ${T.accent}` : `1px solid ${T.line}`, outlineOffset: selected ? 1 : 0, pointerEvents: "none" }}>
                    <div style={{ transform: `scale(${THUMB_SCALE})`, transformOrigin: "top left" }}>
                      <ExportFrame layout={l.key} ctx={ctx(format)} />
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: selected ? T.text : T.dim, fontWeight: selected ? 600 : 400, whiteSpace: "nowrap" }}>{l.label}</span>
                </button>
              );
            })}
          </div>
          {!hasPhoto && <div style={{ fontSize: 11.5, color: T.dim, marginTop: -6, marginBottom: 12 }}>Add a progress photo to unlock the photo layouts.</div>}

          {/* Format */}
          <div style={sectionLabel}>Format</div>
          <div style={{ display: "flex", background: T.surface2, borderRadius: 10, padding: 3, gap: 3, marginBottom: 14 }}>
            {FORMATS.map((f) => (
              <button key={f.key} onClick={() => setFormat(f.key)} aria-pressed={format === f.key} style={{ flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, border: "none", whiteSpace: "nowrap", background: format === f.key ? T.accent : "transparent", color: format === f.key ? "#fff" : T.dim }}>
                {f.label} <span style={{ opacity: 0.7, fontWeight: 500 }}>{f.sub}</span>
              </button>
            ))}
          </div>

          {/* Title + accent */}
          <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={sectionLabel}>Title</div>
              <div style={{ display: "flex", alignItems: "center", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: "0 8px 0 10px" }}>
                <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 28))} placeholder={defaultTitle} style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: T.text, fontSize: 14, padding: "9px 0" }} />
                {title && <button onClick={() => setTitle("")} aria-label="Reset title" style={{ background: "none", border: "none", color: T.dim, padding: 4 }}><IconRefresh size={13} /></button>}
              </div>
            </div>
            <div>
              <div style={sectionLabel}>Accent</div>
              <div style={{ display: "flex", gap: 6, height: 38, alignItems: "center" }}>
                {ACCENTS.map((a) => (
                  <button key={a} onClick={() => setAccent(a)} aria-label={`Accent ${a}`} aria-pressed={accent === a} style={{ width: 22, height: 22, borderRadius: 999, background: a, border: accent === a ? `2px solid ${T.text}` : `1px solid ${T.line}`, padding: 0, boxSizing: "border-box" }} />
                ))}
              </div>
            </div>
          </div>

          {/* Include toggles; ones this layout doesn't use are dimmed */}
          <div style={sectionLabel}>Include</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
            {INCLUDE.filter((t) => t.key !== "bodyweight" || data.bodyWeight != null).map((t) => {
              const disabled = !activeLayout.uses.includes(t.key);
              const on = opts[t.pref];
              return (
                <button key={t.key} onClick={() => !disabled && setOpts((p) => ({ ...p, [t.pref]: !p[t.pref] }))} disabled={disabled} aria-pressed={on && !disabled} style={chip(on, disabled)}>
                  {on && !disabled ? <><IconCheck size={11} /> </> : ""}{t.label}
                </button>
              );
            })}
          </div>
          {opts.showPRs && history && stats && !stats.hasHistory && (
            <div style={{ fontSize: 11.5, color: T.dim, marginTop: -10, marginBottom: 14 }}>PRs show up once you have earlier workouts to beat.</div>
          )}

          {saveError && <div style={{ color: T.accent, fontSize: 12.5, marginBottom: 10, textAlign: "center" }}>{saveError}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            {canShareFiles && (
              <button onClick={handleShare} disabled={!!saving} style={{ flex: 1, padding: "14px 0", borderRadius: 14, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, whiteSpace: "nowrap", opacity: saving ? 0.7 : 1 }}>
                <IconShare size={15} /> {saving === "share" ? "Preparing…" : "Share"}
              </button>
            )}
            <button onClick={handleSave} disabled={!!saving} style={{ flex: 1, padding: "14px 0", borderRadius: 14, border: "none", background: T.accent, color: "#fff", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, whiteSpace: "nowrap", opacity: saving ? 0.7 : 1 }}>
              <IconDownload size={15} /> {saving === "save" ? "Generating…" : "Save image"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
