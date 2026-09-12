import { useState, useEffect } from "react";
import { fetchStravaConnection, connectStrava, disconnectStrava } from "./lib/strava";
import { InlineLoading } from "./LoadingSpinner";

const T = {
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
  stravaOrange: "#FC4C02", // Strava's own brand color, used only for their button per their branding guidelines
};

export default function StravaSettings({ user }) {
  const [connection, setConnection] = useState(undefined); // undefined = loading, null = not connected
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchStravaConnection(user.id).then((c) => { if (!cancelled) setConnection(c); }).catch(() => { if (!cancelled) setConnection(null); });
    return () => { cancelled = true; };
  }, [user.id]);

  // Picks up ?strava=connected|denied|error left by strava-oauth-callback's
  // redirect back into the app, refetches the real connection state
  // either way, and cleans the query param off the URL so refreshing
  // the page doesn't re-show the same one-time status.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("strava");
    if (!status) return;
    if (status === "error") setError("Couldn't connect to Strava. Please try again.");
    if (status === "denied") setError("Strava connection cancelled.");
    fetchStravaConnection(user.id).then(setConnection).catch(() => {});
    params.delete("strava");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, [user.id]);

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      await connectStrava(user.id);
      // connectStrava navigates the browser away to Strava's consent
      // screen on success, so there's normally nothing further to do
      // here -- this only runs if the redirect itself never happens.
    } catch (err) {
      setError(`Couldn't start the connection: ${err.message}`);
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await disconnectStrava();
      setConnection(null);
    } catch (err) {
      setError(`Couldn't disconnect: ${err.message}`);
    }
    setDisconnecting(false);
    setConfirmDisconnect(false);
  }

  if (connection === undefined) {
    return <InlineLoading label="Checking connection…" padding="20px 0" />;
  }

  return (
    <div>
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <div style={{ color: T.text, fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          {connection ? "Connected" : "Not connected"}
        </div>
        <div style={{ color: T.dim, fontSize: 12, lineHeight: 1.5 }}>
          {connection
            ? `Finished workouts are matched to whatever activity your watch or tracker already synced to Strava${connection.athlete_name ? ` (${connection.athlete_name})` : ""}, and updated with your set-by-set detail. No duplicate activity is created.`
            : "Connect Strava to have DeltaLog automatically add your set-by-set detail to whatever activity your watch or tracker syncs there, without creating a duplicate."}
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(232,68,46,0.1)", border: `1px solid ${T.accent}`, borderRadius: 10, padding: 10, marginBottom: 14, color: T.text, fontSize: 12.5 }}>
          {error}
        </div>
      )}

      {!connection ? (
        <button
          onClick={handleConnect}
          disabled={connecting}
          style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: T.stravaOrange, color: "#fff", fontSize: 15, fontWeight: 700, opacity: connecting ? 0.7 : 1 }}
        >
          {connecting ? "Connecting…" : "Connect Strava"}
        </button>
      ) : confirmDisconnect ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "rgba(232,90,90,0.12)", border: `1px solid ${T.accent}`, borderRadius: 10, padding: "10px 12px" }}>
          <span style={{ fontSize: 12.5, color: T.text }}>Disconnect Strava? Future workouts won't be pushed until you reconnect.</span>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setConfirmDisconnect(false)} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 13 }}>Cancel</button>
            <button onClick={handleDisconnect} disabled={disconnecting} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: T.accent, color: "#fff", fontSize: 13, fontWeight: 700, opacity: disconnecting ? 0.7 : 1 }}>
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDisconnect(true)}
          style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: `1px solid ${T.line}`, background: T.surface2, color: T.dim, fontSize: 13.5, fontWeight: 600 }}
        >
          Disconnect
        </button>
      )}
    </div>
  );
}
