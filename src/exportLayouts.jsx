// Export image layouts for ExportWorkoutModal. Every layout renders into
// a fixed W x H box (W = 270 CSS px; H from the chosen format) so the same
// component serves the live preview, the scaled-down picker thumbnails
// and the html2canvas capture (scaled to 1080 px wide at save time).
//
// html2canvas notes that shape how these are written: no CSS object-fit
// on anything captured (photos arrive pre-cropped to their exact box, see
// photoBoxFor), no filters/blend modes, and every text row is nowrap +
// ellipsis so long exercise names never wrap a row onto two lines.
import Logo, { Wordmark } from "./Logo";
import BodyMap from "./BodyMap";
import { effectiveSets, formatSets } from "./lib/volume";
import { PR_LABEL, compactNum, fmtW } from "./lib/exportStats";

export const W = 270;
export const FORMATS = [
  { key: "story", label: "Story", sub: "9:16", ratio: 16 / 9 },
  { key: "post", label: "Post", sub: "4:5", ratio: 5 / 4 },
  { key: "square", label: "Square", sub: "1:1", ratio: 1 },
];
export const heightFor = (fmt) => Math.round(W * (FORMATS.find((f) => f.key === fmt)?.ratio ?? 16 / 9));

export const ACCENTS = ["#E8442E", "#E8A82E", "#3BA55D", "#2E8BE8", "#F2F1EC"];

const C = { bg: "#101216", surface: "#1A1D23", surface2: "#22262E", line: "#2C313B", text: "#F2F1EC", dim: "#8B919D", green: "#3BA55D", amber: "#E8A82E", down: "#E8A82E" };
const BC = "'Barlow Condensed', sans-serif";
const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MONO = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";
const nowrap = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

export function alpha(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
// Text that sits on an accent fill: dark on light accents, light otherwise.
function onAccent(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? C.bg : "#fff";
}

// ---------- shared bits ----------
// Shrinks a one-line hero title to fit its width instead of wrapping or
// clipping (html2canvas doesn't draw text-overflow ellipses). `em` is the
// typeface's rough average glyph width as a fraction of font size.
function fitSize(text, width, max, em) {
  const len = Math.max(1, String(text || "").length);
  return Math.max(14, Math.min(max, Math.floor(width / (len * em))));
}
function worked(d) {
  return (d.exercises || []).map((ex, i) => ({ ex, i })).filter(({ ex }) => (ex.sets || []).some((s) => !s.isWarmup && (s.reps || 0) > 0));
}
function topOf(ex) {
  return (ex.sets || []).filter((s) => !s.isWarmup && (s.reps || 0) > 0).reduce((b, s) => (!b || s.weight > b.weight || (s.weight === b.weight && s.reps > b.reps) ? s : b), null);
}
const prsOf = (k, i) => (k.o.showPRs && k.st ? k.st.exercises[i]?.prs || [] : []);
const isPRSet = (k, i, j) => !!(k.o.showPRs && k.st && k.st.exercises[i]?.prSetIndexes.has(j));
const prCount = (k) => (k.o.showPRs && k.st ? k.st.prExerciseCount : 0);
const cap = (k, story, post, square) => ({ story, post, square })[k.fmt];
const shortDate = (k) => new Date(k.d.completedAt || Date.now()).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function Brand({ size = 13, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <Logo size={size * 1.5} />
      {color ? <span style={{ fontFamily: BC, fontWeight: 700, fontSize: size, color, letterSpacing: 0.3 }}>DeltaLog</span> : <Wordmark size={size} />}
    </div>
  );
}

function Stat({ value, label, size = 20, color = C.text, dim = C.dim }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: BC, fontSize: size, fontWeight: 700, lineHeight: 1, color, ...nowrap }}>{value}</div>
      <div style={{ fontFamily: SANS, fontSize: 8.5, color: dim, marginTop: 3, ...nowrap }}>{label}</div>
    </div>
  );
}

function stats(k) {
  const { d, o } = k;
  const out = [{ value: d.totalSets, label: "sets" }];
  if (o.showVolume) out.push({ value: compactNum(d.totalVolume), label: `${d.unit} moved` });
  if (o.showDuration && d.durationMin != null) out.push({ value: d.durationMin, label: "min" });
  return out;
}

function metaLine(k) {
  const { d, o } = k;
  const bits = [`${d.totalSets} sets`];
  if (o.showVolume) bits.push(`${compactNum(d.totalVolume)} ${d.unit}`);
  if (o.showDuration && d.durationMin != null) bits.push(`${d.durationMin} min`);
  return bits.join("   ");
}

function PRTag({ k, children = "PR", solid }) {
  const a = k.o.accent;
  return (
    <span style={{ fontFamily: SANS, fontSize: 7.5, fontWeight: 700, letterSpacing: 0.4, padding: "1px 4px", borderRadius: 3, background: solid ? a : alpha(a, 0.18), color: solid ? onAccent(a) : a, flexShrink: 0 }}>{children}</span>
  );
}

function More({ n, color = C.dim }) {
  if (n <= 0) return null;
  return <div style={{ fontFamily: SANS, fontSize: 8.5, color, marginTop: 4 }}>+{n} more exercise{n === 1 ? "" : "s"}</div>;
}

function Photo({ k, w, h, style }) {
  if (!k.photo) return <div style={{ width: w, height: h, background: C.surface2, ...style }} />;
  return <img src={k.photo} alt="" style={{ display: "block", width: w, height: h, objectFit: "cover", ...style }} />;
}

// ---------- 1. Scoreboard ----------
function Scoreboard(k) {
  const { d, o } = k;
  const list = worked(d);
  const n = cap(k, 8, 5, 3);
  return (
    <div style={{ padding: "18px 18px 16px", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Brand />
        {o.showDate && <span style={{ fontFamily: SANS, fontSize: 9, color: C.dim }}>{shortDate(k)}</span>}
      </div>
      <div style={{ fontFamily: BC, fontWeight: 700, fontSize: fitSize(o.title, 234, k.fmt === "square" ? 30 : 40, 0.5), lineHeight: 0.92, marginTop: 14, textTransform: "uppercase", color: C.text, ...nowrap }}>{o.title}</div>
      <div style={{ height: 3, width: 34, background: o.accent, marginTop: 8 }} />
      <div style={{ display: "flex", gap: 18, marginTop: 12, padding: "9px 0", borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        {stats(k).map((s, i) => <Stat key={i} {...s} />)}
      </div>
      <div style={{ marginTop: 8, fontFamily: SANS, fontSize: 10.5 }}>
        {list.slice(0, n).map(({ ex, i }) => {
          const pr = prsOf(k, i).length > 0;
          const t = topOf(ex);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, height: 20, padding: "0 6px", margin: "0 -6px", background: pr ? alpha(o.accent, 0.13) : "transparent", borderLeft: pr ? `2px solid ${o.accent}` : "2px solid transparent" }}>
              <span style={{ flex: 1, minWidth: 0, color: C.text, fontWeight: pr ? 600 : 400, ...nowrap }}>{ex.name}</span>
              {pr && <PRTag k={k} />}
              <span style={{ fontFamily: BC, fontWeight: 700, fontSize: 12, color: C.text, flexShrink: 0 }}>{t ? `${fmtW(t.weight)}×${t.reps}` : ""}</span>
            </div>
          );
        })}
        <More n={list.length - n} />
      </div>
      <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        {prCount(k) > 0 ? <span style={{ fontFamily: BC, fontWeight: 700, fontSize: 14, color: o.accent }}>{prCount(k)} new PR{prCount(k) === 1 ? "" : "s"}</span> : <span />}
        {o.showBodyweight && d.bodyWeight != null && <span style={{ fontFamily: SANS, fontSize: 9, color: C.dim }}>BW {d.bodyWeight} {d.unit}</span>}
      </div>
    </div>
  );
}

// ---------- 2. PR hero ----------
function PRHero(k) {
  const { d, o, st } = k;
  const h = o.showPRs && st ? st.headline : null;
  // Fallback when there's no PR: the heaviest top set of the day.
  let name, set, label, deltaText;
  if (h) {
    name = h.name; set = h.set; label = PR_LABEL[h.type];
    const diff = Math.round((h.value - h.previous) * 10) / 10;
    deltaText = h.type === "weight" ? `+${fmtW(diff)} ${d.unit} over best` : h.type === "e1rm" ? `e1RM ${Math.round(h.value)}, +${Math.round(diff)}` : `set volume ${Math.round(h.value).toLocaleString()}, +${Math.round(diff).toLocaleString()}`;
  } else {
    const best = worked(d).map(({ ex }) => ({ ex, t: topOf(ex) })).filter((x) => x.t).sort((a, b) => b.t.weight - a.t.weight)[0];
    name = best?.ex.name || o.title; set = best?.t; label = "Top set";
  }
  const others = o.showPRs && st ? st.exercises.map((e, i) => ({ e, i })).filter(({ e, i }) => e.prs.length > 0 && (!h || i !== h.exerciseIndex)) : [];
  const nOthers = cap(k, 4, 2, 1);
  const big = k.fmt === "square" ? 54 : 70;
  return (
    <div style={{ padding: 18, height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
      <Brand />
      <div style={{ marginTop: k.fmt === "story" ? 40 : 16 }}>
        <div style={{ fontFamily: SANS, fontSize: 10, color: h ? o.accent : C.dim, fontWeight: 600 }}>{h ? `New ${label}` : label}</div>
        <div style={{ fontFamily: BC, fontSize: 22, fontWeight: 700, color: C.text, marginTop: 2, ...nowrap }}>{name}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
          <span style={{ fontFamily: BC, fontSize: big, fontWeight: 700, lineHeight: 0.9, color: h ? o.accent : C.text }}>{set ? fmtW(set.weight) : "—"}</span>
          <span style={{ fontFamily: BC, fontSize: 18, fontWeight: 600, color: C.text }}>{d.unit}</span>
        </div>
        {set && <div style={{ fontFamily: SANS, fontSize: 10.5, color: C.dim, marginTop: 6 }}>× {set.reps} reps{deltaText ? <span style={{ color: C.green }}>{`   ${deltaText}`}</span> : null}</div>}
      </div>
      {others.length > 0 && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 5 }}>
          {others.slice(0, nOthers).map(({ e, i }) => {
            const p = e.prs[0];
            const s = d.exercises[i].sets[p.setIndex];
            return (
              <div key={i} style={{ background: C.surface, borderRadius: 7, padding: "6px 8px", display: "flex", alignItems: "center", gap: 6, fontFamily: SANS, fontSize: 10 }}>
                <span style={{ flex: 1, minWidth: 0, color: C.text, ...nowrap }}>{d.exercises[i].name}</span>
                <PRTag k={k}>{PR_LABEL[p.type]}</PRTag>
                <span style={{ fontFamily: BC, fontWeight: 700, fontSize: 12, color: C.text }}>{fmtW(s.weight)}×{s.reps}</span>
              </div>
            );
          })}
          <More n={others.length - nOthers} />
        </div>
      )}
      <div style={{ marginTop: "auto", borderTop: `1px solid ${C.line}`, paddingTop: 7, display: "flex", justifyContent: "space-between", fontFamily: SANS, fontSize: 9, color: C.dim, gap: 8 }}>
        <span style={nowrap}>{o.title}{o.showDate ? `, ${shortDate(k)}` : ""}</span>
        <span style={{ ...nowrap, flexShrink: 0 }}>{metaLine(k)}</span>
      </div>
    </div>
  );
}

// ---------- 3. Stat sheet ----------
function StatSheet(k) {
  const { d, o } = k;
  const list = worked(d).map(({ ex, i }) => ({ ex, i, vol: (ex.sets || []).filter((s) => !s.isWarmup).reduce((v, s) => v + s.weight * s.reps, 0) }));
  const max = Math.max(1, ...list.map((x) => x.vol));
  const n = cap(k, 9, 6, 4);
  const working = (d.exercises || []).flatMap((ex) => (ex.sets || []).filter((s) => !s.isWarmup && s.rir != null));
  const avgRir = working.length ? Math.round((working.reduce((a, s) => a + s.rir, 0) / working.length) * 10) / 10 : null;
  return (
    <div style={{ padding: 16, height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", background: "#13161B" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Brand size={12} />
        {o.showDate && <span style={{ fontFamily: SANS, fontSize: 9, color: C.dim }}>{shortDate(k)}</span>}
      </div>
      <div style={{ fontFamily: BC, fontSize: 18, fontWeight: 700, color: C.text, marginTop: 10, ...nowrap }}>{o.title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
        <div style={{ background: C.surface, borderRadius: 8, padding: "7px 8px" }}><Stat value={o.showVolume ? d.totalVolume.toLocaleString() : d.totalSets} label={o.showVolume ? `volume, ${d.unit}` : "sets"} size={19} /></div>
        {prCount(k) > 0 ? (
          <div style={{ background: o.accent, borderRadius: 8, padding: "7px 8px" }}><Stat value={prCount(k)} label={`PR${prCount(k) === 1 ? "" : "s"}`} size={19} color={onAccent(o.accent)} dim={onAccent(o.accent)} /></div>
        ) : (
          <div style={{ background: C.surface, borderRadius: 8, padding: "7px 8px" }}><Stat value={list.length} label="exercises" size={19} /></div>
        )}
      </div>
      <div style={{ fontFamily: SANS, fontSize: 9, color: C.dim, marginTop: 12 }}>Volume by exercise</div>
      <div style={{ marginTop: 4 }}>
        {list.slice(0, n).map(({ ex, i, vol }) => {
          const pr = prsOf(k, i).length > 0;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, height: 16, fontFamily: SANS, fontSize: 9.5 }}>
              <span style={{ width: 72, color: C.text, flexShrink: 0, ...nowrap }}>{ex.name}</span>
              <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ height: 8, width: `${Math.max(4, (vol / max) * 100)}%`, background: pr ? o.accent : "#3A3F49", borderRadius: 2 }} />
                {pr && <span style={{ color: o.accent, fontSize: 9, fontWeight: 700 }}>PR</span>}
              </div>
            </div>
          );
        })}
        <More n={list.length - n} />
      </div>
      <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", fontFamily: SANS, fontSize: 9, color: C.dim }}>
        <span>{d.totalSets} sets</span>
        {o.showDuration && d.durationMin != null && <span>{d.durationMin} min</span>}
        {avgRir != null && <span>avg RIR {avgRir}</span>}
        {o.showBodyweight && d.bodyWeight != null && <span>BW {d.bodyWeight}</span>}
      </div>
    </div>
  );
}

// ---------- 4. Receipt ----------
function Receipt(k) {
  const { d, o } = k;
  const list = worked(d);
  const n = cap(k, 7, 5, 3);
  const ink = "#1C1F24";
  const dash = { borderTop: "1px dashed #9A9A92", margin: "7px 0" };
  const stamp = o.accent === "#F2F1EC" ? "#C8352B" : o.accent;
  return (
    <div style={{ height: "100%", boxSizing: "border-box", padding: 14, background: "#2A2E35", display: "flex" }}>
      <div style={{ flex: 1, minWidth: 0, background: "#F4F2EA", color: ink, fontFamily: MONO, fontSize: 9, padding: "12px 12px", display: "flex", flexDirection: "column" }}>
        <div style={{ textAlign: "center", fontWeight: 700, fontSize: 11, letterSpacing: 2 }}>DELTALOG</div>
        <div style={{ textAlign: "center", color: "#6A6A64", marginTop: 2, ...nowrap }}>{o.title.toUpperCase()}{o.showDate ? `  ${new Date(d.completedAt || Date.now()).toLocaleDateString()}` : ""}</div>
        <div style={dash} />
        {list.slice(0, n).map(({ ex, i }) => {
          const t = topOf(ex);
          const vol = Math.round((ex.sets || []).filter((s) => !s.isWarmup).reduce((v, s) => v + s.weight * s.reps, 0));
          const prs = prsOf(k, i);
          return (
            <div key={i} style={{ marginBottom: 3 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ flex: 1, minWidth: 0, ...nowrap }}>{ex.name.toUpperCase()}</span>
                <span>{vol.toLocaleString()}</span>
              </div>
              <div style={{ color: "#6A6A64", ...nowrap }}>  {(ex.sets || []).filter((s) => !s.isWarmup).length} × top {t ? `${fmtW(t.weight)}×${t.reps}` : "-"}</div>
              {prs.length > 0 && <div style={{ color: stamp, fontWeight: 700 }}>  ** {PR_LABEL[prs[0].type].toUpperCase()} **</div>}
            </div>
          );
        })}
        {list.length > n && <div style={{ color: "#6A6A64" }}>  +{list.length - n} MORE</div>}
        <div style={dash} />
        {o.showVolume && <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}><span>TOTAL {d.unit.toUpperCase()}</span><span>{d.totalVolume.toLocaleString()}</span></div>}
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>SETS</span><span>{d.totalSets}</span></div>
        {o.showDuration && d.durationMin != null && <div style={{ display: "flex", justifyContent: "space-between" }}><span>TIME</span><span>{d.durationMin} MIN</span></div>}
        {prCount(k) > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: stamp, fontWeight: 700 }}><span>PRS</span><span>{prCount(k)}</span></div>}
        <div style={{ marginTop: "auto", textAlign: "center", color: "#6A6A64" }}>THANK YOU FOR LIFTING</div>
      </div>
    </div>
  );
}

// ---------- 5. Photo overlay ----------
function PhotoOverlay(k) {
  const { d, o, H } = k;
  const prs = o.showPRs && k.st ? k.st.exercises.map((e, i) => ({ e, i })).filter(({ e }) => e.prs.length > 0) : [];
  const nPR = cap(k, 2, 1, 1);
  return (
    <div style={{ position: "relative", height: "100%" }}>
      <Photo k={k} w={W} h={H} style={{ position: "absolute", inset: 0 }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 60, background: "linear-gradient(180deg, rgba(10,11,13,0.6), rgba(10,11,13,0))" }} />
      <div style={{ position: "absolute", top: 14, left: 14 }}><Brand /></div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "rgba(10,11,13,0.84)", padding: "12px 14px 14px" }}>
        <div style={{ fontFamily: BC, fontSize: 24, fontWeight: 700, color: C.text, ...nowrap }}>{o.title}{o.showDate ? <span style={{ color: C.dim, fontSize: 16 }}>{`  ${shortDate(k)}`}</span> : null}</div>
        <div style={{ display: "flex", gap: 16, marginTop: 6 }}>{stats(k).map((s, i) => <Stat key={i} {...s} size={16} />)}</div>
        {prs.slice(0, nPR).map(({ e, i }) => {
          const s = d.exercises[i].sets[e.prs[0].setIndex];
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7, fontFamily: SANS, fontSize: 10, color: C.text }}>
              <PRTag k={k} solid />
              <span style={{ ...nowrap }}>{d.exercises[i].name} {fmtW(s.weight)}×{s.reps}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- 6. Progress delta ----------
function Delta(k) {
  const { d, o, st } = k;
  const cmp = st?.compare;
  const list = worked(d);
  const n = cap(k, 7, 5, 3);
  const up = (v, unit = "") => (v > 0 ? <span style={{ color: C.green }}>▲{fmtW(v)}{unit}</span> : v < 0 ? <span style={{ color: C.down }}>▼{fmtW(-v)}{unit}</span> : <span style={{ color: C.dim }}>=</span>);
  const sign = (v, suffix = "") => (v == null ? null : <span style={{ color: v > 0 ? C.green : v < 0 ? C.down : C.dim }}>{v > 0 ? "+" : v < 0 ? "−" : "±"}{Math.abs(v)}{suffix}</span>);
  return (
    <div style={{ padding: 18, height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Brand />
        <span style={{ fontFamily: SANS, fontSize: 9, color: C.dim }}>{cmp ? `vs ${new Date(cmp.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "first time on this lineup"}</span>
      </div>
      <div style={{ fontFamily: BC, fontSize: 24, fontWeight: 700, color: C.text, marginTop: 10, ...nowrap }}>{o.title}</div>
      <div style={{ marginTop: 6, fontFamily: SANS, fontSize: 10.5, lineHeight: "18px" }}>
        {o.showVolume && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.dim }}>Volume</span><b style={{ color: C.text }}>{d.totalVolume.toLocaleString()} {cmp && cmp.volumePct != null && sign(cmp.volumePct, "%")}</b></div>}
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.dim }}>Sets</span><b style={{ color: C.text }}>{d.totalSets} {cmp && sign(cmp.setsDelta)}</b></div>
        {o.showDuration && d.durationMin != null && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.dim }}>Duration</span><b style={{ color: C.text }}>{d.durationMin}m {cmp && cmp.durationDelta != null && <span style={{ color: C.dim }}>{cmp.durationDelta > 0 ? "+" : cmp.durationDelta < 0 ? "−" : "±"}{Math.abs(cmp.durationDelta)}m</span>}</b></div>}
      </div>
      <div style={{ borderTop: `1px solid ${C.line}`, margin: "8px 0 4px" }} />
      <div style={{ fontFamily: SANS, fontSize: 10.5 }}>
        {list.slice(0, n).map(({ ex, i }) => {
          const e = st?.exercises[i];
          const t = topOf(ex);
          const pr = prsOf(k, i).length > 0;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, height: 20, padding: "0 5px", margin: "0 -5px", background: pr ? alpha(o.accent, 0.13) : "transparent", borderLeft: pr ? `2px solid ${o.accent}` : "2px solid transparent" }}>
              <span style={{ flex: 1, minWidth: 0, color: C.text, ...nowrap }}>{ex.name}</span>
              <span style={{ fontFamily: BC, fontWeight: 700, fontSize: 12, color: C.text }}>{t ? `${fmtW(t.weight)}×${t.reps}` : ""}</span>
              <span style={{ width: 40, textAlign: "right", fontSize: 9.5, fontWeight: 600, flexShrink: 0 }}>
                {e?.delta ? (e.delta.kind === "weight" ? up(e.delta.value) : e.delta.value === 0 ? <span style={{ color: C.dim }}>=</span> : up(e.delta.value, " rep")) : <span style={{ color: C.dim }}>new</span>}
              </span>
            </div>
          );
        })}
        <More n={list.length - n} />
      </div>
      <div style={{ marginTop: "auto", fontFamily: SANS, fontSize: 9, color: C.dim }}>Top set vs the last time you did each lift{o.showDate ? `, ${shortDate(k)}` : ""}</div>
    </div>
  );
}

// ---------- 7. Muscle map ----------
function MuscleMap(k) {
  const { d, o } = k;
  const mm = d.muscleMap || { primary: {}, secondary: {} };
  const names = [...new Set([...Object.keys(mm.primary || {}), ...Object.keys(mm.secondary || {})])];
  const ranked = names.map((m) => ({ m, v: effectiveSets(mm.primary?.[m], mm.secondary?.[m]) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const n = cap(k, 5, 3, 2);
  const mapW = { story: 96, post: 72, square: 52 }[k.fmt];
  return (
    <div style={{ padding: 16, height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Brand />
        {o.showDate && <span style={{ fontFamily: SANS, fontSize: 9, color: C.dim }}>{shortDate(k)}</span>}
      </div>
      <div style={{ fontFamily: BC, fontSize: 22, fontWeight: 700, color: C.text, marginTop: 8, ...nowrap }}>{o.title}</div>
      <div style={{ marginTop: 8, pointerEvents: "none" }}>
        <BodyMap primary={mm.primary || {}} secondary={mm.secondary || {}} nameMode={mm.nameMode} maxWidth={mapW} showLegend={false} />
      </div>
      <div style={{ marginTop: 10, fontFamily: SANS, fontSize: 10.5, lineHeight: "17px" }}>
        {ranked.slice(0, n).map(({ m, v }) => (
          <div key={m} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ color: C.text, ...nowrap }}>{m}</span>
            <b style={{ color: C.text, flexShrink: 0 }}>{formatSets(v)} sets</b>
          </div>
        ))}
      </div>
      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 6, fontFamily: SANS, fontSize: 9, color: C.dim }}>
        {prCount(k) > 0 && <PRTag k={k} solid>{prCount(k)} PR{prCount(k) === 1 ? "" : "s"}</PRTag>}
        <span style={nowrap}>{metaLine(k)}</span>
      </div>
    </div>
  );
}

// ---------- 8. Streak calendar ----------
function Streak(k) {
  const { d, o, st } = k;
  const m = st?.month;
  const date = new Date(d.completedAt || Date.now());
  const y = m ? m.year : date.getFullYear();
  const mi = m ? m.monthIndex : date.getMonth();
  const todayDay = m ? m.todayDay : date.getDate();
  const first = new Date(y, mi, 1).getDay();
  const days = new Date(y, mi + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const key = (day) => `${y}-${String(mi + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const cell = { story: 26, post: 18, square: 13 }[k.fmt];
  return (
    <div style={{ padding: 18, height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Brand />
        {st && st.streak > 1 && <span style={{ fontFamily: BC, fontWeight: 700, fontSize: 13, color: o.accent }}>{st.streak}-day streak</span>}
      </div>
      <div style={{ fontFamily: SANS, fontSize: 9.5, color: C.dim, marginTop: 12 }}>{m ? m.label : date.toLocaleDateString(undefined, { month: "long" })} {y}</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(7, ${cell}px)`, gap: 3, marginTop: 5 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const active = m ? m.activeDays.has(key(day)) : day === todayDay;
          const isToday = day === todayDay;
          const future = day > todayDay;
          return <div key={i} style={{ width: cell, height: cell, borderRadius: 3, boxSizing: "border-box", background: active ? (isToday ? o.accent : alpha(o.accent, 0.5)) : future ? "transparent" : C.surface, border: isToday ? `1.5px solid ${C.text}` : future ? `1px solid ${C.surface}` : "none" }} />;
        })}
      </div>
      <div style={{ fontFamily: BC, fontWeight: 700, fontSize: k.fmt === "square" ? 20 : 28, color: C.text, marginTop: 12, lineHeight: 1 }}>
        Workout {m ? m.workouts : 1} <span style={{ color: C.dim, fontSize: k.fmt === "square" ? 14 : 18 }}>this month</span>
      </div>
      {m && (
        <div style={{ marginTop: 8, fontFamily: SANS, fontSize: 10.5, lineHeight: "17px" }}>
          {o.showVolume && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.dim }}>Month volume</span><b style={{ color: C.text }}>{compactNum(m.volume)} {d.unit}</b></div>}
          {o.showPRs && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.dim }}>Month PRs</span><b style={{ color: o.accent }}>{m.prs}</b></div>}
        </div>
      )}
      <div style={{ marginTop: "auto", fontFamily: SANS, fontSize: 9, color: C.dim, ...nowrap }}>Today: {o.title}, {metaLine(k)}</div>
    </div>
  );
}

// ---------- 9. Training log ----------
function TrainingLog(k) {
  const { d, o } = k;
  const list = worked(d);
  const maxEx = cap(k, 6, 4, 3);
  const perRow = 3;
  return (
    <div style={{ padding: "14px 14px 12px", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: BC, fontSize: 16, fontWeight: 700, color: C.text, ...nowrap }}>{o.title}</span>
        <span style={{ fontFamily: SANS, fontSize: 9, color: C.dim, flexShrink: 0 }}>{[o.showDate && shortDate(k), o.showDuration && d.durationMin != null && `${d.durationMin} min`].filter(Boolean).join("   ")}</span>
      </div>
      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
        {list.slice(0, maxEx).map(({ ex, i }) => {
          const sets = (ex.sets || []).map((s, j) => ({ s, j })).filter(({ s }) => o.showWarmups || !s.isWarmup);
          const rows = [];
          for (let r = 0; r < sets.length; r += perRow) rows.push(sets.slice(r, r + perRow));
          return (
            <div key={i} style={{ fontFamily: SANS, fontSize: 9.5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontFamily: BC, fontWeight: 700, fontSize: 12, color: C.text, ...nowrap }}>{ex.name}</span>
                {prsOf(k, i).length > 0 && <PRTag k={k} />}
              </div>
              {rows.slice(0, 2).map((row, r) => (
                <div key={r} style={{ display: "flex", gap: 10, color: C.text, ...nowrap }}>
                  {row.map(({ s, j }) => (
                    <span key={j} style={{ color: s.isWarmup ? C.amber : isPRSet(k, i, j) ? k.o.accent : C.text, fontWeight: isPRSet(k, i, j) ? 700 : 400 }}>
                      <span style={{ color: C.dim, fontSize: 8 }}>{s.label} </span>{fmtW(s.weight)}×{s.reps}
                    </span>
                  ))}
                  {r === 1 && rows.length > 2 && <span style={{ color: C.dim }}>+{sets.length - 2 * perRow}</span>}
                </div>
              ))}
            </div>
          );
        })}
        <More n={list.length - maxEx} />
      </div>
      <div style={{ marginTop: "auto", borderTop: `1px solid ${C.line}`, paddingTop: 5, display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: SANS, fontSize: 9, color: C.dim }}>
        <Brand size={10} />
        <span>{metaLine(k)}</span>
      </div>
    </div>
  );
}

// ---------- 10. Poster ----------
function Poster(k) {
  const { d, o } = k;
  const ink = onAccent(o.accent);
  const prs = o.showPRs && k.st ? k.st.exercises.map((e, i) => ({ e, i })).filter(({ e }) => e.prs.length > 0) : [];
  const hero = o.showVolume ? compactNum(d.totalVolume) : String(d.totalSets);
  const heroLabel = o.showVolume ? `${d.unit === "kg" ? "kilos" : "pounds"} moved` : "sets done";
  const big = k.fmt === "square" ? 72 : 96;
  const n = cap(k, 3, 2, 1);
  return (
    <div style={{ height: "100%", boxSizing: "border-box", padding: 18, background: o.accent, color: ink, display: "flex", flexDirection: "column" }}>
      <Brand color={ink} />
      <div style={{ fontFamily: BC, fontSize: big, fontWeight: 700, lineHeight: 0.82, marginTop: k.fmt === "story" ? 44 : 14, color: C.bg, letterSpacing: -1 }}>{hero.toUpperCase()}</div>
      <div style={{ fontFamily: BC, fontSize: 16, fontWeight: 700, marginTop: 6, letterSpacing: 0.5 }}>{heroLabel}</div>
      {prs.length > 0 && (
        <div style={{ marginTop: 14, background: C.bg, borderRadius: 8, padding: "7px 9px", fontFamily: SANS, fontSize: 10, color: C.text }}>
          {prs.slice(0, n).map(({ e, i }) => {
            const s = d.exercises[i].sets[e.prs[0].setIndex];
            return (
              <div key={i} style={{ display: "flex", gap: 6, height: 17, alignItems: "center" }}>
                <span style={{ flex: 1, minWidth: 0, ...nowrap }}>{d.exercises[i].name}</span>
                <b>{fmtW(s.weight)}×{s.reps}</b>
                <span style={{ color: o.accent === "#F2F1EC" ? C.green : o.accent, fontWeight: 700 }}>PR</span>
              </div>
            );
          })}
          <More n={prs.length - n} />
        </div>
      )}
      <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", fontFamily: BC, fontWeight: 700, fontSize: 12, gap: 8 }}>
        <span style={nowrap}>{o.title.toUpperCase()}</span>
        {o.showDate && <span style={{ flexShrink: 0 }}>{shortDate(k).toUpperCase()}</span>}
        {o.showDuration && d.durationMin != null && <span style={{ flexShrink: 0 }}>{d.durationMin} MIN</span>}
      </div>
    </div>
  );
}

// ---------- 11. Split (photo) ----------
function Split(k) {
  const { d, o, H } = k;
  const ph = Math.round(H * 0.58);
  const list = worked(d);
  const n = cap(k, 4, 2, 1);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative" }}>
        <Photo k={k} w={W} h={ph} />
        <div style={{ position: "absolute", top: 12, left: 12 }}><Brand /></div>
        {prCount(k) > 0 && <div style={{ position: "absolute", top: 12, right: 12 }}><PRTag k={k} solid>{prCount(k)} PR{prCount(k) === 1 ? "" : "s"}</PRTag></div>}
      </div>
      <div style={{ height: 3, background: o.accent }} />
      <div style={{ flex: 1, padding: "10px 14px 12px", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: BC, fontSize: 20, fontWeight: 700, color: C.text, ...nowrap }}>{o.title}</span>
          {o.showDate && <span style={{ fontFamily: SANS, fontSize: 9, color: C.dim, flexShrink: 0 }}>{shortDate(k)}</span>}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 5 }}>{stats(k).map((s, i) => <Stat key={i} {...s} size={15} />)}</div>
        <div style={{ marginTop: 6, fontFamily: SANS, fontSize: 10 }}>
          {list.slice(0, n).map(({ ex, i }) => {
            const t = topOf(ex);
            const pr = prsOf(k, i).length > 0;
            return (
              <div key={i} style={{ display: "flex", gap: 6, height: 17, alignItems: "center" }}>
                <span style={{ flex: 1, minWidth: 0, color: C.text, ...nowrap }}>{ex.name}</span>
                {pr && <PRTag k={k} />}
                <b style={{ color: C.text, fontFamily: BC, fontSize: 11.5 }}>{t ? `${fmtW(t.weight)}×${t.reps}` : ""}</b>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- 12. Polaroid (photo) ----------
export function polaroidBox(H) {
  const w = W - 52;
  return { w, h: Math.min(Math.round(w * 1.18), H - 128) };
}
function Polaroid(k) {
  const { d, o, H } = k;
  const box = polaroidBox(H);
  const caption = [o.showDate && shortDate(k), o.showVolume && `${compactNum(d.totalVolume)} ${d.unit}`, prCount(k) > 0 && `${prCount(k)} PR${prCount(k) === 1 ? "" : "s"}`].filter(Boolean).join("   ");
  return (
    <div style={{ height: "100%", boxSizing: "border-box", background: "#1E2228", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 14 }}>
      <div style={{ background: "#F4F2EA", padding: "10px 10px 0", transform: "rotate(-2deg)" }}>
        <Photo k={k} w={box.w} h={box.h} />
        <div style={{ height: 50, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <div style={{ fontFamily: BC, fontWeight: 700, fontSize: 18, color: "#1C1F24", maxWidth: box.w, ...nowrap }}>{o.title}</div>
          <div style={{ fontFamily: SANS, fontSize: 9, color: "#6A6A64", marginTop: 1, ...nowrap }}>{caption}</div>
        </div>
      </div>
      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <Brand size={11} />
        <span style={{ fontFamily: SANS, fontSize: 9, color: C.dim }}>{metaLine(k)}</span>
      </div>
    </div>
  );
}

// ---------- 13. Cover (photo) ----------
function Cover(k) {
  const { d, o, H } = k;
  const prs = o.showPRs && k.st ? k.st.exercises.map((e, i) => ({ e, i })).filter(({ e }) => e.prs.length > 0) : [];
  const n = cap(k, 3, 2, 1);
  return (
    <div style={{ position: "relative", height: "100%" }}>
      <Photo k={k} w={W} h={H} style={{ position: "absolute", inset: 0 }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,11,13,0.55) 0%, rgba(10,11,13,0) 32%, rgba(10,11,13,0) 58%, rgba(10,11,13,0.8) 100%)" }} />
      <div style={{ position: "absolute", top: 12, left: 14, right: 14 }}>
        <div style={{ fontFamily: BC, fontWeight: 700, fontSize: 40, lineHeight: 0.9, color: C.text, letterSpacing: 1 }}>DELTA<span style={{ color: o.accent }}>LOG</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: SANS, fontSize: 8.5, color: C.text, marginTop: 3, opacity: 0.85 }}>
          <span style={nowrap}>{o.title}</span>
          {o.showDate && <span>{new Date(d.completedAt || Date.now()).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</span>}
        </div>
      </div>
      <div style={{ position: "absolute", left: 14, right: 14, bottom: 14 }}>
        {prs.slice(0, n).map(({ e, i }) => {
          const s = d.exercises[i].sets[e.prs[0].setIndex];
          return (
            <div key={i} style={{ fontFamily: BC, fontWeight: 700, fontSize: 15, color: C.text, ...nowrap }}>
              <span style={{ color: o.accent }}>PR </span>{d.exercises[i].name} {fmtW(s.weight)}×{s.reps}
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 14, marginTop: 6 }}>{stats(k).map((s, i) => <Stat key={i} {...s} size={18} dim="rgba(242,241,236,0.75)" />)}</div>
      </div>
    </div>
  );
}

// Keys are persisted in prefs; keep them stable. `uses` lists which
// Include toggles a layout reads, so the modal can grey out the rest.
export const LAYOUTS = [
  { key: "scoreboard", label: "Scoreboard", Comp: Scoreboard, uses: ["prs", "date", "volume", "duration", "bodyweight"] },
  { key: "prhero", label: "PR hero", Comp: PRHero, uses: ["prs", "date", "volume", "duration"] },
  { key: "statsheet", label: "Stat sheet", Comp: StatSheet, uses: ["prs", "date", "volume", "duration", "bodyweight"] },
  { key: "receipt", label: "Receipt", Comp: Receipt, uses: ["prs", "date", "volume", "duration"] },
  { key: "delta", label: "Progress", Comp: Delta, uses: ["prs", "date", "volume", "duration"] },
  { key: "musclemap", label: "Muscle map", Comp: MuscleMap, uses: ["prs", "date", "volume", "duration"] },
  { key: "streak", label: "Streak", Comp: Streak, uses: ["prs", "volume", "duration"] },
  { key: "log", label: "Training log", Comp: TrainingLog, uses: ["prs", "date", "volume", "duration", "warmups"] },
  { key: "poster", label: "Poster", Comp: Poster, uses: ["prs", "date", "volume", "duration"] },
  { key: "overlay", label: "Photo overlay", Comp: PhotoOverlay, photo: true, uses: ["prs", "date", "volume", "duration"] },
  { key: "split", label: "Photo split", Comp: Split, photo: true, uses: ["prs", "date", "volume", "duration"] },
  { key: "polaroid", label: "Polaroid", Comp: Polaroid, photo: true, uses: ["prs", "date", "volume", "duration"] },
  { key: "cover", label: "Cover", Comp: Cover, photo: true, uses: ["prs", "date", "volume", "duration"] },
];

// The exact box each photo layout draws its photo into, so the modal can
// pre-crop to that aspect (html2canvas ignores object-fit).
export function photoBoxFor(layoutKey, H) {
  if (layoutKey === "split") return { w: W, h: Math.round(H * 0.58) };
  if (layoutKey === "polaroid") return polaroidBox(H);
  return { w: W, h: H };
}

export function ExportFrame({ layout, ctx, frameRef }) {
  const L = LAYOUTS.find((l) => l.key === layout) || LAYOUTS[0];
  const H = ctx.H;
  return (
    <div ref={frameRef} style={{ width: W, height: H, background: C.bg, position: "relative", overflow: "hidden", boxSizing: "border-box", color: C.text }}>
      <L.Comp {...ctx} />
    </div>
  );
}
