import { useState } from "react";
import { submitFeedback } from "./lib/queries";
import { themed } from "./lib/theme";

const T = themed({
  bg: "#121418",
  surface: "#1B1E23",
  surface2: "#24282E",
  line: "#2F343B",
  text: "#E6E3D9",
  dim: "#8F949C",
  accent: "#C4A35A",
  green: "#6A9E80",
  danger: "#D0614C",
  accentDeep: "#8A6F33",
  spruce: "#3F6E55",
});

export default function FeedbackModal({ user, context, fixedType, onClose }) {
  const [type, setType] = useState(fixedType || "bug");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState(null);

  const titles = { bug: "Send Feedback", feature: "Send Feedback", privacy: "Privacy Request" };
  const placeholders = {
    bug: "What happened, and what did you expect instead?",
    feature: "What would you like to see?",
    privacy: "What data question or request do you have? (e.g. \"what do you store about me\", \"I have a concern about...\")",
  };

  async function handleSubmit() {
    const trimmed = message.trim();
    if (!trimmed) return;
    setStatus("sending");
    try {
      await submitFeedback(user.id, type, trimmed, context);
      setStatus("sent");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.75)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 400, background: T.bg, borderTop: `1px solid ${T.line}`, borderRadius: "20px 20px 0 0", padding: 20, boxSizing: "border-box" }}>
        {status === "sent" ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ color: T.green, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Thanks — sent</div>
            <div style={{ color: T.dim, fontSize: 13, marginBottom: 16 }}>
              {fixedType === "privacy" ? "We'll take a look and follow up in the app if needed." : "Appreciate you taking the time to report it."}
            </div>
            <button onClick={onClose} style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: T.accent, color: T.bg, fontSize: 14, fontWeight: 700 }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Chakra Petch', sans-serif", fontSize: 20, fontWeight: 700, color: T.text }}>{titles[type]}</div>
              <button onClick={onClose} aria-label="Close" style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 13 }}>‹</button>
            </div>

            {!fixedType && (
              <div style={{ display: "flex", background: T.surface2, borderRadius: 10, padding: 3, gap: 3, marginBottom: 14 }}>
                {[{ key: "bug", label: "Bug" }, { key: "feature", label: "Feature" }].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setType(opt.key)}
                    style={{
                      flex: 1, padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, border: "none",
                      background: type === opt.key ? T.accent : "transparent",
                      color: type === opt.key ? T.bg : T.dim,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            <textarea
              autoFocus
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={placeholders[type]}
              rows={5}
              style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, color: T.text, fontSize: 14, padding: 12, outline: "none", boxSizing: "border-box", resize: "none", marginBottom: 10, fontFamily: "inherit" }}
            />

            {status === "error" && <div style={{ color: T.danger, fontSize: 12, marginBottom: 10 }}>{error}</div>}

            <button
              onClick={handleSubmit}
              disabled={!message.trim() || status === "sending"}
              style={{
                width: "100%", padding: "13px 0", borderRadius: 12, border: "none",
                background: !message.trim() || status === "sending" ? T.surface2 : T.accent,
                color: !message.trim() || status === "sending" ? T.dim : T.bg,
                fontSize: 14, fontWeight: 700,
              }}
            >
              {status === "sending" ? "Sending…" : "Send"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
