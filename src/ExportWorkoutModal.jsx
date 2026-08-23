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

// Instagram's own documented export sizes for each surface. These are
// fixed, known-good targets -- unlike device viewport dimensions (tried
// and reverted in 1.12.17), these don't vary by phone, so a "Story"
// export is exactly the ratio Instagram's Story composer is designed for
// on any device. Instagram's composer will still center/pinch-to-fill on
// screens taller than 9:16 (there is no dimension that avoids that on
// every physical screen), but this is the same tradeoff every export
// tool -- Canva, Later, etc. -- ships with, and it's a small pinch vs.
// the previous letterboxed-and-shrunk result.
// Instagram's documented baseline export width across Story/Post/Square
// alike (only the height varies by format -- see FORMATS below). Used to
// compute how much html2canvas needs to upscale the on-screen preview
// (which is deliberately small, 260-320 CSS px, to fit the modal sheet)
// so the actual saved file is full resolution rather than a low-res
// upscale target for Instagram to blow up further.
const EXPORT_TARGET_WIDTH = 1080;

const FORMATS = [
  { key: "story", label: "Story", sub: "9:16", heightOverWidth: 16 / 9 },
  { key: "post", label: "Post", sub: "4:5", heightOverWidth: 5 / 4 },
  { key: "square", label: "Square", sub: "1:1", heightOverWidth: 1 },
];

const POSITIONS = [
  { key: "center", label: "Centered" },
  { key: "corner", label: "Corner" },
];

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
  const [format, setFormat] = useState(remembered?.format || "story");
  const formatRatio = FORMATS.find((f) => f.key === format)?.heightOverWidth ?? 16 / 9;
  const [position, setPosition] = useState(remembered?.position || "center");
  const [showSets, setShowSets] = useState(remembered ? remembered.showSets : true);
  const [showVolume, setShowVolume] = useState(remembered ? remembered.showVolume : true);
  const [showDuration, setShowDuration] = useState(remembered ? remembered.showDuration : true);
  const [showBodyweight, setShowBodyweight] = useState(remembered ? remembered.showBodyweight : true);
  const [showDate, setShowDate] = useState(remembered ? remembered.showDate : true);
  const [usePhotoBg, setUsePhotoBg] = useState(remembered ? remembered.usePhotoBg : !!data.photoUrl);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [rawPhotoImg, setRawPhotoImg] = useState(null);
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const previewRef = useRef(null);
  const containerRef = useRef(null);

  // Step 1: fetch the (possibly cross-origin, possibly several-megapixel)
  // progress photo exactly once per underlying photo, and reduce it to a
  // same-origin, downscaled <img> we can read pixels from freely from here
  // on. Same reasoning as before (avoids a live network fetch stalling
  // html2canvas's capture, and avoids decoding a full camera-resolution
  // image on every re-crop below) -- this step just stops one image short
  // of a final data URL, so step 2 can re-crop it instantly whenever the
  // target aspect ratio (Format) changes, with no network and no re-decode
  // of the original.
  //
  // Keyed on photoUrlKey (the URL's path, stripped of its query string)
  // rather than data.photoUrl itself. The progress photo bucket is
  // private, so its URL is a signed URL, and fetchProgressPhoto calls
  // createSignedUrl fresh on every read -- same photo, brand new token
  // and expiry each time. Any upstream re-fetch (a re-render, a realtime
  // sync tick, whatever) therefore hands this component a "new" photoUrl
  // for a photo that hasn't actually changed. Keying on data.photoUrl
  // directly meant every one of those re-signs re-ran the entire
  // fetch-decode-crop pipeline and reloaded the visible image -- the
  // repeated flicker reported. The storage path portion of the URL is
  // stable for the same photo, so keying on that skips the reload
  // entirely when nothing actually changed; the full data.photoUrl (with
  // a valid token at the time this fires) is still what's fetched.
  const MAX_PHOTO_DIM = 1600;
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
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const downscaled = new Image();
        downscaled.onload = () => resolve(downscaled);
        downscaled.onerror = reject;
        downscaled.src = canvas.toDataURL("image/jpeg", 0.9);
      }))
      .then((downscaled) => { if (!cancelled) setRawPhotoImg(downscaled); })
      .catch(() => { if (!cancelled) setRawPhotoImg(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only photoUrlKey (the stable path) should re-trigger a refetch, not every re-signed token for the same photo. data.photoUrl is still read fresh from the closure when this does fire.
  }, [photoUrlKey]);

  // Step 2: re-crop rawPhotoImg to exactly the current target box's aspect
  // ratio -- the same math CSS object-fit: cover does (scale to cover,
  // crop centered overflow) -- and bake that into the data URL the <img>
  // actually renders. This is what makes the saved PNG match the preview:
  // html2canvas doesn't reliably honor object-fit, so previously the live
  // preview (CSS-cropped, correct) and the captured canvas (html2canvas
  // ignoring object-fit, often stretching/squishing the source instead of
  // cropping it) could show visibly different results. Pre-cropping here
  // means there's no CSS cropping left for html2canvas to get wrong --
  // the pixels in the data URL already are the correctly-cropped image.
  // This also removes the flicker: previously the <img> briefly rendered
  // the live remote data.photoUrl (with crossOrigin="anonymous") before
  // swapping to the local data URL once ready, and that crossOrigin
  // attribute changing between renders forces a second image load --
  // together, a visible flash every time. Now the remote URL is never
  // rendered at all; nothing shows until the cropped local version is
  // ready, then it appears once, cleanly. Runs on a canvas (no network),
  // so switching Format (Story/Post/Square) re-crops instantly too.
  useEffect(() => {
    if (!rawPhotoImg) { setPhotoDataUrl(null); return; }
    const targetAspect = 1 / formatRatio; // width / height
    const nw = rawPhotoImg.naturalWidth;
    const nh = rawPhotoImg.naturalHeight;
    const srcAspect = nw / nh;
    let sx, sy, sw, sh;
    if (srcAspect > targetAspect) {
      sh = nh;
      sw = Math.round(nh * targetAspect);
      sx = Math.round((nw - sw) / 2);
      sy = 0;
    } else {
      sw = nw;
      sh = Math.round(nw / targetAspect);
      sx = 0;
      sy = Math.round((nh - sh) / 2);
    }
    const outW = Math.min(EXPORT_TARGET_WIDTH, sw);
    const outH = Math.max(1, Math.round(outW / targetAspect));
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    canvas.getContext("2d").drawImage(rawPhotoImg, sx, sy, sw, sh, 0, 0, outW, outH);
    setPhotoDataUrl(canvas.toDataURL("image/jpeg", 0.92));
  }, [rawPhotoImg, formatRatio]);

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
      // previewRef already carries explicit CSS width/height (260x462 for
      // Story), so leaving width/height/window* unset lets html2canvas
      // fall back to its default: measure and capture the element's own
      // real rendered box, matching exactly what's on screen.
      //
      // scale is computed rather than a flat 2, because a flat 2 against
      // a 260-320 CSS px preview box (deliberately small so it fits the
      // modal sheet) only produced a ~520-640px wide PNG -- well under
      // the 1080px width Instagram and most platforms expect, so the
      // output got upscaled again on the other end and came out soft,
      // for both the photo and the text/logo layer since both are
      // rasterized together in the same capture. Solving for scale such
      // that boxWidth * scale === EXPORT_TARGET_WIDTH (1080) means the
      // saved file is always full resolution regardless of how small the
      // on-screen preview needs to be.
      const boxWidth = previewRef.current.getBoundingClientRect().width || (layout === "story" ? 260 : 320);
      const exportScale = EXPORT_TARGET_WIDTH / boxWidth;
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: T.bg, scale: exportScale, useCORS: true, scrollX: 0, scrollY: 0, imageTimeout: 3000,
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `deltalog-workout-${(data.dateLabel || "summary").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setPref("exportImagePrefs", { layout, format, position, showSets, showVolume, showDuration, showBodyweight, showDate, usePhotoBg });
    } catch (err) {
      setSaveError("Couldn't generate the image. Try again.");
    }
    setSaving(false);
  }

  const showSetsEffective = showSets && layout !== "story";
  // Corner is only offered for Card/Detailed -- Story already has its own
  // dedicated, centered full-bleed treatment and a competing "smaller,
  // different spot" option there would just fight the photo-background
  // framing that layout is built around.
  const compact = layout !== "story" && position === "corner";

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

          {/* Format picker — only meaningful once Story's fixed-frame path is active */}
          {layout === "story" && (
            <>
              <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Format</div>
              <div style={{ display: "flex", background: T.surface2, borderRadius: 10, padding: 3, gap: 3, marginBottom: 16 }}>
                {FORMATS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFormat(f.key)}
                    aria-pressed={format === f.key}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, border: "none", background: format === f.key ? T.accent : "transparent", color: format === f.key ? "#fff" : T.dim }}
                  >
                    {f.label} <span style={{ opacity: 0.7, fontWeight: 500 }}>{f.sub}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Position picker — Card/Detailed only; Story has its own framing */}
          {layout !== "story" && (
            <>
              <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Position</div>
              <div style={{ display: "flex", background: T.surface2, borderRadius: 10, padding: 3, gap: 3, marginBottom: 16 }}>
                {POSITIONS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPosition(p.key)}
                    aria-pressed={position === p.key}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, border: "none", background: position === p.key ? T.accent : "transparent", color: position === p.key ? "#fff" : T.dim }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </>
          )}

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
                height: layout === "story" ? Math.round(260 * formatRatio) : undefined,
                minHeight: compact ? 320 : undefined,
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
              {photoBgActive && photoDataUrl && (
                <>
                  <img
                    src={photoDataUrl}
                    alt=""
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
                  />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,11,13,0.55) 0%, rgba(10,11,13,0.35) 45%, rgba(10,11,13,0.75) 100%)", zIndex: 1 }} />
                </>
              )}
              <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", gap: layout === "story" ? 20 : compact ? 8 : 12, height: "100%", justifyContent: layout === "story" ? "center" : compact ? "flex-end" : "flex-start", alignItems: compact ? "flex-start" : "stretch" }}>
              <div style={{ display: "flex", flexDirection: compact ? "row" : "column", alignItems: "center", gap: compact ? 6 : 4, marginBottom: layout === "story" ? 8 : compact ? 2 : 4 }}>
                <Logo size={layout === "story" ? 60 : compact ? 26 : 44} />
                <Wordmark size={layout === "story" ? 22 : compact ? 12 : 17} />
              </div>

              {showDate && (
                <div style={{ textAlign: compact ? "left" : "center", fontFamily: "'Barlow Condensed', sans-serif", fontSize: layout === "story" ? 20 : compact ? 12 : 16, fontWeight: 700, color: T.text }}>
                  {data.dateLabel}
                </div>
              )}

              <div style={{ display: "flex", gap: compact ? 14 : 8, justifyContent: compact ? "flex-start" : "center" }}>
                <div style={{ flex: layout === "story" ? "0 1 auto" : compact ? "0 1 auto" : 1, textAlign: compact ? "left" : "center" }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: layout === "story" ? 30 : compact ? 17 : 20, fontWeight: 700, color: T.text }}>{data.totalSets}</div>
                  <div style={{ fontSize: compact ? 7.5 : 9, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>Sets</div>
                </div>
                {showVolume && (
                  <div style={{ flex: layout === "story" ? "0 1 auto" : compact ? "0 1 auto" : 1, textAlign: compact ? "left" : "center", padding: layout === "story" ? "0 16px" : 0 }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: layout === "story" ? 30 : compact ? 17 : 20, fontWeight: 700, color: T.text }}>{data.totalVolume.toLocaleString()}</div>
                    <div style={{ fontSize: compact ? 7.5 : 9, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>Volume ({data.unit})</div>
                  </div>
                )}
                {showDuration && data.durationMin != null && (
                  <div style={{ flex: layout === "story" ? "0 1 auto" : compact ? "0 1 auto" : 1, textAlign: compact ? "left" : "center" }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: layout === "story" ? 30 : compact ? 17 : 20, fontWeight: 700, color: T.text }}>{data.durationMin}</div>
                    <div style={{ fontSize: compact ? 7.5 : 9, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>Minutes</div>
                  </div>
                )}
              </div>

              {showBodyweight && data.bodyWeight != null && (
                <div style={{ textAlign: compact ? "left" : "center", fontSize: layout === "story" ? 15 : compact ? 10 : 12, color: T.dim }}>Bodyweight: <span style={{ color: T.text, fontWeight: 600 }}>{data.bodyWeight} {data.unit}</span></div>
              )}

              {showSetsEffective && (
                <div style={{ display: "flex", flexDirection: "column", gap: compact ? 5 : 8, marginTop: compact ? 2 : 4 }}>
                  {(data.exercises || []).slice(0, layout === "detailed" ? 12 : 6).map((ex, i) => (
                    <div key={i}>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: compact ? 11 : 13, fontWeight: 700, color: T.text, marginBottom: layout === "detailed" ? 3 : 0 }}>{ex.name}</div>
                      {layout === "detailed" ? (
                        (ex.sets || []).map((s, j) => (
                          <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: compact ? 9.5 : 11 }}>
                            <span style={{ color: s.isWarmup ? "#E8A82E" : T.dim }}>{s.label}</span>
                            <span style={{ color: T.text }}>{s.weight} {data.unit} × {s.reps}</span>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: compact ? 9.5 : 11, color: T.dim }}>{(ex.sets || []).length} set{(ex.sets || []).length === 1 ? "" : "s"}</div>
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
