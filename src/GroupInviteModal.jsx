import { useEffect, useState } from "react";
import { IconList, IconPlus, IconX } from "./Icons";
import { Avatar } from "./Friends";
import { fetchGroupSessionMembers, displayName } from "./lib/social";

const T = {
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};
const oneLine = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

// Group workout invite popup (v1.20.0). Shown on Home when a new invite
// arrives: who sent it, who's already in, the plan, and whether they've
// started. Tapping outside (or the X) tucks it away; the invite stays in
// the banner above Start Workout until joined or declined.
export default function GroupInviteModal({ invite, busy, onJoin, onDecline, onDismiss }) {
  const [members, setMembers] = useState([]);
  useEffect(() => {
    let cancelled = false;
    fetchGroupSessionMembers(invite.session_id)
      .then((m) => { if (!cancelled) setMembers(m.filter((x) => x.status === "joined")); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [invite.session_id, invite.member_count]);

  const hostName = invite.host_first_name || (invite.host_handle ? `@${invite.host_handle}` : "A friend");
  const live = invite.session_status === "active";
  const isTemplate = !!invite.plan_name;
  const host = { user_id: invite.host_id, first_name: invite.host_first_name, handle: invite.host_handle };
  const others = members.filter((m) => !m.is_host);

  return (
    <div role="dialog" aria-modal="true" aria-label={`${hostName} invited you to a group workout`} style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <style>{`@keyframes gimIn { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } } @keyframes gimFade { from { opacity: 0; } to { opacity: 1; } }`}</style>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(10,11,13,0.7)", animation: "gimFade 0.18s ease" }} />
      <div style={{ position: "relative", width: "100%", maxWidth: 340, boxSizing: "border-box", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 18, padding: "20px 18px 16px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", animation: "gimIn 0.2s ease" }}>
        <button onClick={onDismiss} aria-label="Not now" style={{ position: "absolute", top: 8, right: 8, width: 36, height: 36, borderRadius: 18, border: "none", background: "transparent", color: T.dim, display: "flex", alignItems: "center", justifyContent: "center" }}><IconX size={16} /></button>

        <Avatar person={host} size={56} />
        <div style={{ marginTop: 12, fontSize: 17, fontWeight: 700, color: T.text, maxWidth: "100%", ...oneLine }}>{hostName} invited you to lift</div>
        <div style={{ marginTop: 3, fontSize: 13, color: live ? T.accent : T.dim, whiteSpace: "nowrap" }}>
          {live ? "Group workout · already lifting" : `Group workout · ${invite.member_count} in the lobby`}
        </div>

        {others.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", maxWidth: "100%" }}>
            {others.slice(0, 5).map((m, i) => (
              <span key={m.user_id} style={{ marginLeft: i === 0 ? 0 : -8, border: `2px solid ${T.surface}`, borderRadius: 17, display: "flex" }}><Avatar person={m} size={28} /></span>
            ))}
            <span style={{ marginLeft: 8, fontSize: 12.5, color: T.dim, ...oneLine }}>
              {others.length === 1 ? `${displayName(others[0])} is in` : `${displayName(others[0])} and ${others.length - 1} more`}
            </span>
          </div>
        )}

        <div style={{ marginTop: 14, width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: T.surface2, border: `1px solid ${T.line}`, textAlign: "left" }}>
          <span style={{ color: T.accent, display: "flex", flexShrink: 0 }}>{isTemplate ? <IconList size={16} /> : <IconPlus size={16} />}</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: T.text, ...oneLine }}>{isTemplate ? invite.plan_name : "From scratch"}</span>
          <span style={{ fontSize: 12.5, color: T.dim, whiteSpace: "nowrap" }}>{isTemplate ? `${invite.plan_exercise_count} exercises` : `${invite.host_first_name || "Host"} picks`}</span>
        </div>

        <button onClick={onJoin} disabled={busy} style={{ marginTop: 16, width: "100%", height: 50, borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 16, fontWeight: 700, opacity: busy ? 0.6 : 1, whiteSpace: "nowrap" }}>
          {busy ? "Joining..." : live ? "Join workout" : "Join lobby"}
        </button>
        <button onClick={onDecline} style={{ marginTop: 6, height: 40, padding: "0 16px", border: "none", background: "none", color: T.dim, fontSize: 14, fontWeight: 600 }}>Decline</button>
      </div>
    </div>
  );
}
