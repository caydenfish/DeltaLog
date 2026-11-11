import { useState, useEffect } from "react";
import { listStravaActivitiesForDay, linkStravaActivity, dismissStravaLink } from "./lib/strava";
import { InlineLoading } from "./LoadingSpinner";
import { IconX } from "./Icons";
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
  green: "#6A9E80",
  danger: "#D0614C",
  accentDeep: "#8A6F33",
  spruce: "#3F6E55",
});

function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function StravaManualLinkModal({ workoutId, onClose, onLinked, onDismissed }) {
  const [activities, setActivities] = useState(undefined); // undefined = loading
  const [error, setError] = useState(null);
  const [linkingId, setLinkingId] = useState(null);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listStravaActivitiesForDay(workoutId)
      .then((data) => { if (!cancelled) setActivities(data.activities || []); })
      .catch((err) => { if (!cancelled) { setError(err.message); setActivities([]); } });
    return () => { cancelled = true; };
  }, [workoutId]);

  async function handleLink(activityId) {
    setLinkingId(activityId);
    try {
      await linkStravaActivity(workoutId, activityId);
      onLinked();
    } catch (err) {
      setError(`Couldn't link that activity: ${err.message}`);
      setLinkingId(null);
    }
  }

  async function handleDismiss() {
    setDismissing(true);
    try {
      await dismissStravaLink(workoutId);
    } catch {
      // Dismissing is a convenience, not critical -- if it fails,
      // closing the modal still gets it out of the way for now and
      // the banner will just offer it again next time.
    }
    setDismissing(false);
    onDismissed();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,13,0.75)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 400, maxHeight: "80vh", background: T.bg, borderTop: `1px solid ${T.line}`, borderRadius: "20px 20px 0 0", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${T.line}` }}>
          <div>
            <div style={{ color: T.text, fontSize: 16, fontWeight: 700 }}>Link to Strava</div>
            <div style={{ color: T.dim, fontSize: 11.5, marginTop: 2 }}>No matching activity was found automatically — pick the right one below.</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: T.dim, padding: 4 }}><IconX size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {activities === undefined ? (
            <InlineLoading label="Looking for activities…" padding="30px 0" />
          ) : error && activities.length === 0 ? (
            <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "20px 0" }}>{error}</div>
          ) : activities.length === 0 ? (
            <div style={{ color: T.dim, fontSize: 13, textAlign: "center", padding: "20px 0" }}>No Strava activities found that day.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {activities.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleLink(a.id)}
                  disabled={linkingId !== null}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, textAlign: "left", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 14px", opacity: linkingId !== null && linkingId !== a.id ? 0.5 : 1 }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: T.text, fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                    <div style={{ color: T.dim, fontSize: 11.5, marginTop: 2 }}>
                      {a.type} · {new Date(a.start_date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · {formatDuration(a.elapsed_time)}
                    </div>
                  </div>
                  <div style={{ color: T.dim, fontSize: 13, flexShrink: 0 }}>{linkingId === a.id ? "Linking…" : "Link"}</div>
                </button>
              ))}
            </div>
          )}
          {error && activities && activities.length > 0 && (
            <div style={{ color: T.danger, fontSize: 12, marginTop: 10 }}>{error}</div>
          )}
        </div>

        <div style={{ padding: 16, borderTop: `1px solid ${T.line}` }}>
          <button onClick={handleDismiss} disabled={dismissing} style={{ width: "100%", padding: "12px 0", border: `1px solid ${T.line}`, background: T.surface2, color: T.dim, fontSize: 14.5, fontWeight: 600, ...BTN_TEXT, borderRadius: BTN_RADIUS }}>
            {dismissing ? "…" : "None of these / don't ask again for this workout"}
          </button>
        </div>
      </div>
    </div>
  );
}
