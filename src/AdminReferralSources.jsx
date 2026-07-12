import { useEffect, useState } from "react";
import { adminGetReferralSources } from "./lib/queries";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

const smallBtn = { background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 11 };

// Admin-only marketing dashboard: how people say they found DeltaLog,
// truncated to counts + share of signups rather than a raw list, so it's
// scannable at a glance instead of a wall of free-text answers. Backed by
// admin_get_referral_sources (migration_052), which already groups
// case/whitespace variants of the same answer together server-side.
export default function AdminReferralSources({ onClose }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminGetReferralSources()
      .then(setRows)
      .catch((err) => setError(err.message));
  }, []);

  const total = rows ? rows.reduce((sum, r) => sum + Number(r.count), 0) : 0;
  const max = rows ? Math.max(1, ...rows.map((r) => Number(r.count))) : 1;

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 30, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 480, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}>
          <button onClick={onClose} aria-label="Close" style={smallBtn}>‹</button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: T.text, textAlign: "center" }}>REFERRAL SOURCES</div>
          <div style={{ width: 26 }} />
        </div>

        <div style={{ padding: 16, flex: 1 }}>
          {error && <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: T.surface2, border: `1px solid ${T.accent}`, color: T.accent, fontSize: 13 }}>{error}</div>}

          {rows === null && !error && <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>Loading…</div>}

          {rows && rows.length === 0 && (
            <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "24px 0" }}>No signups yet.</div>
          )}

          {rows && rows.length > 0 && (
            <>
              <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>
                {total} signup{total === 1 ? "" : "s"} · from the "How did you hear about us?" field in setup
              </div>
              {rows.map((r) => {
                const pct = total > 0 ? Math.round((Number(r.count) / total) * 100) : 0;
                const barPct = Math.round((Number(r.count) / max) * 100);
                return (
                  <div key={r.source} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <div style={{ color: T.text, fontSize: 14, fontWeight: 600 }}>{r.source}</div>
                      <div style={{ color: T.dim, fontSize: 12 }}>
                        <span style={{ color: T.text, fontWeight: 700 }}>{r.count}</span> · {pct}%
                      </div>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: T.surface2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${barPct}%`, background: r.source === "Not specified" ? T.line : T.accent, borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
