import { CHANGELOG } from "./lib/changelog";
import { version as APP_VERSION } from "../package.json";
import { IconX, IconCheck } from "./Icons";
import { themed } from "./lib/theme";

import { BTN_TEXT, BTN_RADIUS } from "./lib/buttons";
const T = themed({
  bg: "#121418",
  surface: "#1B1E23",
  surface2: "#24282E",
  line: "#2F343B",
  text: "#E6E3D9",
  dim: "#8F949C",
  accent: "#C4A35A",
  danger: "#D0614C",
  accentDeep: "#8A6F33",
  spruce: "#3F6E55",
});

// `entries`, if passed, is a list of { version, title, items } shown
// newest-first — used by the automatic catch-up popup when someone's
// missed several releases between logins. Without it, falls back to the
// single current-version view used by the manual "What's New" button in
// Settings.
export default function WhatsNew({ onClose, entries }) {
  const list = entries && entries.length > 0 ? [...entries].reverse() : [{ version: APP_VERSION, ...(CHANGELOG[APP_VERSION] || { title: "You're up to date", items: null }) }];
  const multi = list.length > 1;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.75)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 400, maxHeight: "75vh", overflowY: "auto", background: T.bg, borderTop: `1px solid ${T.line}`, borderRadius: "20px 20px 0 0", padding: 20, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              {multi ? `What's new · ${list.length} updates` : `What's new · v${list[0].version}`}
            </div>
            {!multi && <div style={{ fontFamily: "'Chakra Petch', sans-serif", fontSize: 22, fontWeight: 700, color: T.text }}>{list[0].items ? list[0].title : "You're up to date"}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, padding: "4px 10px", fontSize: 13, flexShrink: 0, marginLeft: 8, borderRadius: BTN_RADIUS }}><IconX size={12} /></button>
        </div>

        <div style={{ marginTop: multi ? 12 : 16, marginBottom: 20, display: "flex", flexDirection: "column", gap: multi ? 18 : 12 }}>
          {list.map((entry, e) => (
            <div key={entry.version}>
              {multi && (
                <div style={{ fontFamily: "'Saira Condensed', sans-serif", fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 8 }}>
                  v{entry.version} <span style={{ color: T.dim, fontWeight: 400, fontSize: 14 }}>· {entry.title}</span>
                </div>
              )}
              {entry.items ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {entry.items.map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ color: T.accent, fontSize: 15, fontWeight: 700, marginTop: 1, flexShrink: 0 }}><IconCheck size={13} /></div>
                      <div style={{ color: T.text, fontSize: 14, lineHeight: 1.5 }}>{item}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: T.dim, fontSize: 13, lineHeight: 1.5 }}>Nothing new to report this version — just steady improvements under the hood.</div>
              )}
              {multi && e < list.length - 1 && <div style={{ height: 1, background: T.line, marginTop: 16 }} />}
            </div>
          ))}
        </div>

        <button onClick={onClose} style={{ width: "100%", padding: "13px 0", border: "none", background: T.accent, color: T.bg, fontSize: 15, fontWeight: 700, ...BTN_TEXT, borderRadius: BTN_RADIUS }}>
          Got it
        </button>
      </div>
    </div>
  );
}
