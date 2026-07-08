import { useState } from "react";
import { VERSION_HISTORY } from "./lib/versionHistory";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

const smallBtn = { background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 13 };

// Wraps every case-insensitive match of `query` in the accent color, so
// the hit is visible in context instead of just filtering whole entries
// out of view.
function Highlight({ text, query }) {
  if (!query.trim()) return <>{text}</>;
  const q = query.trim();
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <span key={i} style={{ background: "rgba(232,68,46,0.35)", color: T.text, borderRadius: 3 }}>{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default function VersionHistory({ onClose }) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = !q
    ? VERSION_HISTORY
    : VERSION_HISTORY
        .map((entry) => ({
          ...entry,
          items: entry.items.filter((item) => item.toLowerCase().includes(q) || entry.version.includes(q)),
        }))
        .filter((entry) => entry.version.includes(q) || entry.items.length > 0);

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 30, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 400, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8, position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
          <button onClick={onClose} aria-label="Close" style={smallBtn}>‹</button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: T.text, textAlign: "center" }}>VERSION HISTORY</div>
          <div style={{ width: 26 }} />
        </div>

        <div style={{ padding: 16, flex: 1 }}>
          <input
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search versions or changes…"
            style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "10px 12px", outline: "none", boxSizing: "border-box", marginBottom: 16 }}
          />

          {filtered.length === 0 && (
            <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>No matches.</div>
          )}

          {filtered.map((entry) => (
            <div key={entry.version} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.text }}>
                  v<Highlight text={entry.version} query={query} />
                </div>
                <div style={{ color: T.dim, fontSize: 11 }}>{entry.date}</div>
              </div>
              <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                {entry.items.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ color: T.dim, fontSize: 13, marginTop: 1, flexShrink: 0 }}>•</div>
                    <div style={{ color: T.text, fontSize: 13, lineHeight: 1.55, flex: 1, minWidth: 0, overflowWrap: "anywhere", wordBreak: "break-word" }}><Highlight text={item} query={query} /></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
