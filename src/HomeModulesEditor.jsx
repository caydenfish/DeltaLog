import { useState } from "react";
import { HOME_CARD_LABELS, getPrefs } from "./lib/prefs";
import { getMuscleGroupOptions } from "./lib/muscleTaxonomy";
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

// What each card's row says it contains, from its current settings.
function describe(id, s) {
  if (id === "today") return [s.lastWorkout && "Last workout", s.trainingLoad && "training load", s.streak && "streak"].filter(Boolean).join(", ") || "Nothing selected";
  if (id === "trends") {
    const charts = [s.volume && "Volume", s.weight && "bodyweight", s.workoutTime && "time"].filter(Boolean);
    return charts.length ? `${charts.join(", ")} · ${s.layout === "separate" ? "separate cards" : "one card"}` : "No charts selected";
  }
  if (id === "weeklyVolume") {
    const listed = s.rows === "all" ? "all muscles" : Number(s.rows) === 0 ? "no list" : `${s.rows} muscles listed`;
    return `${s.showMap ? "Map, " : ""}${listed} · ${s.window === "4w" ? "4-week avg" : "last 7 days"}`;
  }
  if (id === "calendar") return [s.streak && "Streak", s.history && "history link"].filter(Boolean).join(", ") || "Calendar only";
  return "";
}

function Toggle({ on, onClick, label }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      style={{ width: 42, height: 24, borderRadius: 999, border: `1px solid ${on ? T.accent : T.line}`, background: on ? "rgba(232,68,46,0.2)" : T.surface2, position: "relative", flexShrink: 0, padding: 0 }}
    >
      <span style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: 999, background: on ? T.accent : T.dim, transition: "left 0.15s" }} />
    </button>
  );
}

function SettingRow({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 48, borderBottom: `1px solid ${T.line}` }}>
      <span style={{ fontSize: 14, color: T.text }}>{label}</span>
      {children}
    </div>
  );
}

function Segmented({ value, options, onChange }) {
  return (
    <div style={{ display: "flex", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 3, gap: 3 }}>
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} style={{ flex: 1, padding: "7px 10px", borderRadius: 7, border: "none", background: value === v ? T.accent : "none", color: value === v ? "#fff" : T.dim, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>{label}</button>
      ))}
    </div>
  );
}

// Customize Home (v1.14.0): two levels. The list reorders and turns whole
// cards on or off (same drag handle as before); tapping a card opens what
// goes inside it -- which charts Trends shows and whether they share one
// card, what Today includes, how Weekly volume lists muscles, and the
// calendar extras.
export default function HomeModulesEditor({ cards, settings, onChange, onSettingsChange, onClose }) {
  const drag = useDragReorder(onChange);
  const [editing, setEditing] = useState(null);

  function toggle(idx) {
    onChange(cards.map((c, i) => (i === idx ? { ...c, enabled: !c.enabled } : c)));
  }
  function set(id, patch) {
    onSettingsChange({ ...settings, [id]: { ...settings[id], ...patch } });
  }

  const s = editing ? settings[editing] : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.8)", zIndex: 30, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div
        style={{ width: "100%", maxWidth: 420, maxHeight: "85vh", overflowY: "auto", background: T.bg, borderTop: `1px solid ${T.line}`, borderRadius: "20px 20px 0 0", padding: "20px 20px calc(20px + env(safe-area-inset-bottom, 0px))", boxSizing: "border-box" }}
        onClick={(e) => e.stopPropagation()}
      >
        {!editing ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: T.text }}>Customize home</div>
              <button onClick={onClose} style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "6px 12px", fontSize: 13 }}>Done</button>
            </div>
            <div style={{ fontSize: 13, color: T.dim, marginBottom: 14 }}>Drag to reorder. Tap a card to choose what's in it.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {cards.map((c, i) => (
                <div
                  key={c.id}
                  ref={(el) => (drag.rowRefs.current[i] = el)}
                  style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "8px 12px 8px 8px", opacity: drag.dragIndex === i ? 0.5 : 1 }}
                >
                  <InsertionLine drag={drag} i={i} />
                  <div onPointerDown={(e) => drag.startRowDrag(i, e)} aria-label="Drag to reorder" title="Drag to reorder" style={{ cursor: "grab", color: T.dim, touchAction: "none", flexShrink: 0, display: "flex", alignItems: "center", padding: "8px 4px" }}>
                    <IconDragHandle size={18} />
                  </div>
                  <button onClick={() => setEditing(c.id)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", textAlign: "left", padding: "4px 0" }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: c.enabled ? T.text : T.dim }}>{HOME_CARD_LABELS[c.id] || c.id} <span style={{ color: T.dim, fontWeight: 400 }}>›</span></div>
                    <div style={{ fontSize: 12, color: T.dim, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{describe(c.id, settings[c.id])}</div>
                  </button>
                  <Toggle on={c.enabled} onClick={() => toggle(i)} label={c.enabled ? "Hide card" : "Show card"} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <button onClick={() => setEditing(null)} aria-label="Back" style={{ background: "none", border: "none", color: T.text, fontSize: 22, padding: "0 6px 0 0" }}>‹</button>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: T.text, flex: 1 }}>{HOME_CARD_LABELS[editing]}</div>
              <button onClick={() => setEditing(null)} style={{ background: "none", border: "none", color: T.accent, fontSize: 14, fontWeight: 600 }}>Done</button>
            </div>
            <div style={{ borderTop: `1px solid ${T.line}` }}>
              {editing === "today" && (
                <>
                  <SettingRow label="Last workout & recovery"><Toggle on={s.lastWorkout} onClick={() => set("today", { lastWorkout: !s.lastWorkout })} label="Last workout" /></SettingRow>
                  <SettingRow label="Training load"><Toggle on={s.trainingLoad} onClick={() => set("today", { trainingLoad: !s.trainingLoad })} label="Training load" /></SettingRow>
                  <SettingRow label="Streak"><Toggle on={s.streak} onClick={() => set("today", { streak: !s.streak })} label="Streak" /></SettingRow>
                </>
              )}
              {editing === "trends" && (
                <>
                  <SettingRow label="Volume over time"><Toggle on={s.volume} onClick={() => set("trends", { volume: !s.volume })} label="Volume" /></SettingRow>
                  <SettingRow label="Bodyweight"><Toggle on={s.weight} onClick={() => set("trends", { weight: !s.weight })} label="Bodyweight" /></SettingRow>
                  <SettingRow label="Workout time"><Toggle on={s.workoutTime} onClick={() => set("trends", { workoutTime: !s.workoutTime })} label="Workout time" /></SettingRow>
                  <div style={{ padding: "14px 0 4px" }}>
                    <div style={{ fontSize: 13, color: T.dim, marginBottom: 8 }}>Layout</div>
                    <Segmented value={s.layout} options={[["switch", "One card, switch"], ["separate", "Separate cards"]]} onChange={(v) => set("trends", { layout: v })} />
                    <div style={{ fontSize: 12, color: T.dim, marginTop: 8, lineHeight: 1.45 }}>Each chart keeps its own date range either way.</div>
                  </div>
                </>
              )}
              {editing === "weeklyVolume" && (
                <>
                  <SettingRow label="Body map"><Toggle on={s.showMap} onClick={() => set("weeklyVolume", { showMap: !s.showMap })} label="Body map" /></SettingRow>
                  {(() => {
                    // 0 = map only, max = every muscle ("all", so muscles
                    // added later still show). Listed most sets first.
                    const maxRows = getMuscleGroupOptions(getPrefs().muscleNameMode).length;
                    const value = s.rows === "all" ? maxRows : Math.min(maxRows, Math.max(0, Number(s.rows ?? 4)));
                    return (
                      <div style={{ padding: "14px 0 0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                          <span style={{ fontSize: 13, color: T.dim }}>Muscles listed before "All muscles"</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{value >= maxRows ? "All" : value === 0 ? "None" : value}</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={maxRows}
                          step={1}
                          value={value}
                          onChange={(e) => { const v = Number(e.target.value); set("weeklyVolume", { rows: v >= maxRows ? "all" : v }); }}
                          aria-label="Muscles listed before All muscles"
                          style={{ width: "100%", accentColor: T.accent, height: 32 }}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: T.dim }}>
                          <span>None</span><span>All {maxRows}</span>
                        </div>
                        <div style={{ fontSize: 12, color: T.dim, marginTop: 6 }}>Listed with the most sets on top.</div>
                      </div>
                    );
                  })()}
                  <div style={{ padding: "14px 0 4px" }}>
                    <div style={{ fontSize: 13, color: T.dim, marginBottom: 8 }}>Default window</div>
                    <Segmented value={s.window} options={[["7d", "Last 7 days"], ["4w", "4-week avg"]]} onChange={(v) => set("weeklyVolume", { window: v })} />
                  </div>
                </>
              )}
              {editing === "calendar" && (
                <>
                  <SettingRow label="Streak"><Toggle on={s.streak} onClick={() => set("calendar", { streak: !s.streak })} label="Streak" /></SettingRow>
                  <SettingRow label="View full history link"><Toggle on={s.history} onClick={() => set("calendar", { history: !s.history })} label="History link" /></SettingRow>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
