import { useEffect, useState } from "react";
import { Avatar } from "./Friends";
import { IconCheck } from "./Icons";
import { findUserByHandle, sendFriendRequest, displayName } from "./lib/social";

const T = { surface: "#1A1D23", surface2: "#22262E", line: "#2C313B", text: "#F2F1EC", dim: "#A3A9B4", accent: "#E8442E", greenText: "#7BD69B" };
const condensed = "'Barlow Condensed', sans-serif";

// Opened from an invite link (?add=<handle>, v1.19.1), once the person is
// signed in and set up: shows who invited them and adds them in one tap.
export default function AddFriendSheet({ userId, handle, onClose, onOpenFriends }) {
  const [person, setPerson] = useState(undefined); // undefined loading, null not found
  const [status, setStatus] = useState(null); // null | "sending" | "pending" | "accepted"
  const [error, setError] = useState(null);

  useEffect(() => {
    findUserByHandle(handle).then((p) => setPerson(p || null)).catch((e) => { setError(e.message); setPerson(null); });
  }, [handle]);

  const isSelf = person && person.id === userId;
  const already = person && person.friendship_status === "accepted";
  const requested = person && person.friendship_status === "pending" && person.friendship_direction === "outgoing";

  async function add() {
    setStatus("sending"); setError(null);
    try { setStatus(await sendFriendRequest(person.id)); }
    catch (e) { setError(e.message); setStatus(null); }
  }

  const done = status === "accepted" || status === "pending" || already || requested;
  const doneText = status === "accepted" || already ? `You and ${displayName(person || {})} are friends` : "Request sent. You'll be friends once they accept.";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 45, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(10,11,13,0.6)" }} />
      <div role="dialog" aria-label="Add friend" style={{ position: "relative", width: "100%", maxWidth: 400, boxSizing: "border-box", background: T.surface, borderTop: `1px solid ${T.line}`, borderRadius: "18px 18px 0 0", padding: "20px 18px calc(20px + env(safe-area-inset-bottom, 0px))", display: "flex", flexDirection: "column", gap: 14 }}>
        {person === undefined ? (
          <div style={{ color: T.dim, fontSize: 14, padding: "20px 0", textAlign: "center" }}>Looking up @{handle}...</div>
        ) : !person ? (
          <>
            <span style={{ fontFamily: condensed, fontSize: 24, fontWeight: 700, textTransform: "uppercase", color: T.text }}>Couldn't find @{handle}</span>
            <span style={{ fontSize: 14, color: T.dim, lineHeight: 1.45 }}>{error ? `Something went wrong: ${error}` : "They may have changed their ID. Ask them for a new invite link, or search for them in Friends."}</span>
            <button onClick={onOpenFriends} style={{ height: 50, borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 15, fontWeight: 700 }}>Open Friends</button>
          </>
        ) : isSelf ? (
          <>
            <span style={{ fontFamily: condensed, fontSize: 24, fontWeight: 700, textTransform: "uppercase", color: T.text }}>That's your link</span>
            <span style={{ fontSize: 14, color: T.dim, lineHeight: 1.45 }}>Send it to friends. When they open it, they'll be asked to add you.</span>
            <button onClick={onClose} style={{ height: 50, borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 15, fontWeight: 700 }}>Got it</button>
          </>
        ) : (
          <>
            <span style={{ fontFamily: condensed, fontSize: 13, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: T.dim }}>Friend invite</span>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Avatar person={person} size={56} />
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontFamily: condensed, fontSize: 28, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName(person)}</span>
                <span style={{ fontSize: 14, color: T.dim }}>@{person.handle}</span>
              </div>
            </div>
            {done ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.greenText, fontSize: 14, fontWeight: 600 }}><IconCheck size={16} /> {doneText}</div>
                <button onClick={onClose} style={{ height: 50, borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 15, fontWeight: 700 }}>Done</button>
              </>
            ) : (
              <>
                <span style={{ fontSize: 14, color: T.dim, lineHeight: 1.45 }}>Add them to see each other in Friends and lift together in group workouts.</span>
                {error && <span role="alert" style={{ fontSize: 13, color: "#FF8A78" }}>{error}</span>}
                <button onClick={add} disabled={status === "sending"} style={{ height: 50, borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 15, fontWeight: 700, opacity: status === "sending" ? 0.6 : 1 }}>
                  {status === "sending" ? "Adding..." : person.friendship_status === "pending" && person.friendship_direction === "incoming" ? "Accept friend request" : "Add friend"}
                </button>
                <button onClick={onClose} style={{ height: 44, border: "none", background: "transparent", color: T.dim, fontSize: 15, fontWeight: 600 }}>Not now</button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
