import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import html2canvas from "html2canvas";
import Logo, { Wordmark } from "./Logo";
import { IconX, IconCheck } from "./Icons";
import { getPrefs, setPref } from "./lib/prefs";

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

const LAYOUTS = [
  { key: "card", label: "Card" },
  { key: "detailed", label: "Detailed" },
  { key: "story", label: "Story" },
];

// Reusable "save workout summary as image" modal — used from both the
// post-workout summary and the workout history detail view, since both
// have the same shape of data to render. `data` is:
// { dateLabel, unit, totalSets, totalVolume, durationMin, bodyWeight?, photoUrl?, exercises: [{name, sets:[{label, weight, reps, rir, isWarmup}]}] }
export default function ExportWorkoutModal({ data, onClose }) {
  const remembered = getPrefs().exportImagePrefs;
  const [layout, setLayout] = useState(remembered?.layout || "card");
  const [showSets, setShowSets] = useState(remembered ? remembered.showSets : true);
  const [showVolume, setShowVolume] = useState(remembered ? remembered.showVolume : true);
  const [showDuration, setShowDuration] = useState(remembered ? remembered.showDuration : true);
  const [showBodyweight, setShowBodyweight] = useState(remembered ? remembered.showBodyweight : true);
  const [showDate, setShowDate] = useState(remembered ? remembered.showDate : true);
  const [usePhotoBg, setUsePhotoBg] = useState(remembered ? remembered.usePhotoBg : !!data.photoUrl);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const previewRef = useRef(null);
  const containerRef = useRef(null);

  // The progress photo is a Supabase signed URL, fetched cross-origin.
  // html2canvas has to load it with crossOrigin="anonymous" so the
  // capture doesn't taint the canvas, and when that cross-origin request
  // hangs or stalls -- flaky network, CORS quirk on the signed URL,
  // whatever -- html2canvas sits there waiting up to its imageTimeout
  // before giving up, which is exactly the ~10 second stall reported
  // ("only on Save Image, then it fixes itself"). Converting it to a
  // same-origin data URL up front, well before Save Image is tapped,
  // means the capture never needs a live network fetch at all -- nothing
  // left to hang on.
  useEffect(() => {
    if (!data.photoUrl) { setPhotoDataUrl(null); return; }
    let cancelled = false;
    fetch(data.photoUrl)
      .then((r) => r.blob())
      .then((blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }))
      .then((dataUrl) => { if (!cancelled) setPhotoDataUrl(dataUrl); })
      .catch(() => { if (!cancelled) setPhotoDataUrl(null); }); // falls back to the remote URL below
    return () => { cancelled = true; };
  }, [data.photoUrl]);

  const toggles = [
    { key: "sets", label: "Set-by-set detail", value: showSets, set: setShowSets, hideOn: ["story"] },
    { key: "volume", label: "Volume", value: showVolume, set: setShowVolume },
    { key: "duration", label: "Duration", value: showDuration, set: setShowDuration },
    { key: "bodyweight", label: "Bodyweight", value: showBodyweight, set: setShowBodyweight, requires: data.bodyWeight != null },
    { key: "date", label: "Date", value: showDate, set: setShowDate },
    { key: "photoBg", label: "Use photo as background", value: usePhotoBg, set: setUsePhotoBg, requires: !!data.photoUrl, hideOn: ["card", "detailed"] },
  ];

  // Photo background only makes sense for Story — Card/Detailed are
  // dense with text and a photo behind them would just hurt legibility.
  const photoBgActive = usePhotoBg && layout === "story" && !!data.photoUrl;

  async function handleSaveImage() {
    if (!previewRef.current) return;
    setSaving(true);
    setSaveError(null);
    try {
      // html2canvas clones the DOM to render off-screen, but a clone
      // doesn't carry over live scroll position -- any scrollable
      // ancestor comes back scrollTop 0, which no longer lines up with
      // where the live page measured the preview to be. That mismatch is
      // what shows up as a visible flicker/jump while it generates.
      // Scrolling the sheet to the top first, then telling html2canvas
      // not to apply its own window-scroll offset on top of that,
      // keeps the live and cloned layouts in sync so there's nothing
      // to visibly snap into place.
      if (containerRef.current) containerRef.current.scrollTop = 0;
      const canvas = await html2canvas(previewRef.current, { backgroundColor: T.bg, scale: 2, useCORS: true, scrollX: 0, scrollY: 0, imageTimeout: 3000 });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `deltalog-workout-${(data.dateLabel || "summary").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setPref("exportImagePrefs", { layout, showSets, showVolume, showDuration, showBodyweight, showDate, usePhotoBg });
    } catch (err) {
      setSaveError("Couldn't generate the image. Try again.");
    }
    setSaving(false);
  }

  const showSetsEffective = showSets && layout !== "story";

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.85)", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 420, maxHeight: "92vh", display: "flex", flexDirection: "column", background: T.bg, borderTop: `1px solid ${T.line}`, borderRadius: "20px 20px 0 0" }}>
        <div style={{ padding: "16px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.text }}>Save as image</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 13 }}><IconX size={12} /></button>
        </div>

        <div ref={containerRef} style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
          {/* Layout picker */}
          <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Layout</div>
          <div style={{ display: "flex", background: T.surface2, borderRadius: 10, padding: 3, gap: 3, marginBottom: 16 }}>
            {LAYOUTS.map((l) => (
              <button
                key={l.key}
                onClick={() => setLayout(l.key)}
                aria-pressed={layout === l.key}
                style={{ flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, border: "none", background: layout === l.key ? T.accent : "transparent", color: layout === l.key ? "#fff" : T.dim }}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Toggles */}
          <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Include</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
            {toggles.filter((t) => t.requires !== false).map((t) => {
              const disabled = t.hideOn && t.hideOn.includes(layout);
              const disabledHint = disabled ? (t.key === "photoBg" ? " (Story only)" : " (n/a for Story)") : "";
              return (
                <button
                  key={t.key}
                  onClick={() => !disabled && t.set(!t.value)}
                  disabled={disabled}
                  aria-pressed={t.value && !disabled}
                  style={{
                    padding: "7px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, border: `1px solid ${t.value && !disabled ? T.accent : T.line}`,
                    background: t.value && !disabled ? "rgba(232,68,46,0.12)" : "transparent",
                    color: disabled ? T.dim : t.value ? T.accent : T.dim,
                    opacity: disabled ? 0.5 : 1,
                  }}
                >
                  {t.value && !disabled ? <><IconCheck size={11} /> </> : ""}{t.label}{disabledHint}
                </button>
              );
            })}
          </div>

          {/* Live preview */}
          <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Preview</div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16, background: T.surface2, borderRadius: 12, padding: 12 }}>
            <div
              ref={previewRef}
              style={{
                width: layout === "story" ? 260 : 320,
                height: layout === "story" ? Math.round(260 * 16 / 9) : undefined,
                background: T.bg,
                border: `1px solid ${T.line}`,
                borderRadius: 16,
                padding: layout === "story" ? "28px 20px" : 20,
                display: "flex",
                flexDirection: "column",
                justifyContent: layout === "story" ? "center" : "flex-start",
                gap: layout === "story" ? 20 : 12,
                boxSizing: "border-box",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {photoBgActive && (
                <>
                  <img
                    src={photoDataUrl || data.photoUrl}
                    alt=""
                    crossOrigin={photoDataUrl ? undefined : "anonymous"}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
                  />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,11,13,0.55) 0%, rgba(10,11,13,0.35) 45%, rgba(10,11,13,0.75) 100%)", zIndex: 1 }} />
                </>
              )}
              <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", gap: layout === "story" ? 20 : 12, height: "100%", justifyContent: layout === "story" ? "center" : "flex-start" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginBottom: layout === "story" ? 8 : 4 }}>
                <Logo size={layout === "story" ? 60 : 44} />
                <Wordmark size={layout === "story" ? 22 : 17} />
              </div>

              {showDate && (
                <div style={{ textAlign: "center", fontFamily: "'Barlow Condensed', sans-serif", fontSize: layout === "story" ? 20 : 16, fontWeight: 700, color: T.text }}>
                  {data.dateLabel}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <div style={{ flex: layout === "story" ? "0 1 auto" : 1, textAlign: "center" }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: layout === "story" ? 30 : 20, fontWeight: 700, color: T.text }}>{data.totalSets}</div>
                  <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>Sets</div>
                </div>
                {showVolume && (
                  <div style={{ flex: layout === "story" ? "0 1 auto" : 1, textAlign: "center", padding: layout === "story" ? "0 16px" : 0 }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: layout === "story" ? 30 : 20, fontWeight: 700, color: T.text }}>{data.totalVolume.toLocaleString()}</div>
                    <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>Volume ({data.unit})</div>
                  </div>
                )}
                {showDuration && data.durationMin != null && (
                  <div style={{ flex: layout === "story" ? "0 1 auto" : 1, textAlign: "center" }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: layout === "story" ? 30 : 20, fontWeight: 700, color: T.text }}>{data.durationMin}</div>
                    <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>Minutes</div>
                  </div>
                )}
              </div>

              {showBodyweight && data.bodyWeight != null && (
                <div style={{ textAlign: "center", fontSize: layout === "story" ? 15 : 12, color: T.dim }}>Bodyweight: <span style={{ color: T.text, fontWeight: 600 }}>{data.bodyWeight} {data.unit}</span></div>
              )}

              {showSetsEffective && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                  {(data.exercises || []).slice(0, layout === "detailed" ? 12 : 6).map((ex, i) => (
                    <div key={i}>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, color: T.text, marginBottom: layout === "detailed" ? 3 : 0 }}>{ex.name}</div>
                      {layout === "detailed" ? (
                        (ex.sets || []).map((s, j) => (
                          <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                            <span style={{ color: s.isWarmup ? "#E8A82E" : T.dim }}>{s.label}</span>
                            <span style={{ color: T.text }}>{s.weight} {data.unit} × {s.reps}</span>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: 11, color: T.dim }}>{(ex.sets || []).length} set{(ex.sets || []).length === 1 ? "" : "s"}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              </div>
            </div>
          </div>

          {saveError && <div style={{ color: T.accent, fontSize: 12.5, marginBottom: 10, textAlign: "center" }}>{saveError}</div>}
          <button onClick={handleSaveImage} disabled={saving} style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "none", background: T.accent, color: "#fff", fontSize: 15, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Generating…" : "Save image"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
