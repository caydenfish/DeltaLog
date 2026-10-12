import { useEffect, useMemo, useState } from "react";
import { IconSearch, IconX, IconCheck } from "./Icons";
import { Avatar, HandleSetupCard } from "./Friends";
import {
  fetchMyHandle, fetchFriends, fetchFriendGroups, saveFriendGroup, deleteFriendGroup,
  createGroupSession, searchUsersByHandle, sendFriendRequest, normalizeHandle, displayName,
} from "./lib/social";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};
const condensed = "'Barlow Condensed', sans-serif";
const oneLine = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const label = { fontFamily: condensed, fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: T.dim };
const MAX_FRIENDS = 7; // 8 people including you

// Start Group Workout (v1.17.0): pick friends (search by ID first, saved
// groups as a shortcut), then hand the new session id back so Home can
// open the normal Start Workout sheet in group mode.
export default function GroupWorkoutSheet({ user, onClose, onSessionCreated, onOpenFriends }) {
  const [me, setMe] = useState(null);
  const [friends, setFriends] = useState(null);
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [query, setQuery] = useState("");
  const [strangers, setStrangers] = useState([]);
  const [requested, setRequested] = useState(() => new Set());
  const [naming, setNaming] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [editingGroups, setEditingGroups] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMyHandle(user.id).then(setMe).catch(() => setMe({ handle: null }));
    fetchFriends().then((l) => setFriends(l.friends)).catch(() => setFriends([]));
    fetchFriendGroups(user.id).then(setGroups).catch(() => setGroups([]));
  }, [user.id]);

  const q = normalizeHandle(query);
  const shownFriends = useMemo(() => {
    if (!friends) return [];
    if (!q) return friends;
    return friends.filter((f) => (f.handle || "").includes(q) || (f.first_name || "").toLowerCase().includes(q));
  }, [friends, q]);

  // People matching the ID who aren't friends yet: offer a request.
  useEffect(() => {
    if (q.length < 2) { setStrangers([]); return; }
    const t = setTimeout(() => {
      searchUsersByHandle(q)
        .then((r) => setStrangers(r.filter((x) => x.friendship_status !== "accepted")))
        .catch(() => setStrangers([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  function toggle(id) {
    if (!selected.has(id) && selected.size >= MAX_FRIENDS) {
      setError(`Up to ${MAX_FRIENDS} friends per group workout`);
      return;
    }
    setError(null);
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }
  function pickGroup(g) {
    const friendIds = new Set((friends || []).map((f) => f.user_id));
    const ids = g.member_ids.filter((id) => friendIds.has(id)).slice(0, MAX_FRIENDS);
    setSelected(new Set(ids));
  }
  async function saveGroup() {
    const name = groupName.trim();
    if (!name || selected.size === 0) return;
    try {
      const g = await saveFriendGroup(user.id, name, [...selected]);
      setGroups((gs) => [...gs, g]);
      setNaming(false); setGroupName("");
    } catch (e) { setError(e.message); }
  }
  async function removeGroup(g) {
    try { await deleteFriendGroup(g.id); setGroups((gs) => gs.filter((x) => x.id !== g.id)); }
    catch (e) { setError(e.message); }
  }
  async function request(person) {
    try { await sendFriendRequest(person.id); setRequested((s) => new Set(s).add(person.id)); }
    catch (e) { setError(e.message); }
  }
  async function start() {
    if (selected.size === 0 || starting) return;
    setStarting(true); setError(null);
    try {
      const sessionId = await createGroupSession([...selected]);
      onSessionCreated(sessionId);
    } catch (e) {
      setError(e.message);
      setStarting(false);
    }
  }

  const selectedPeople = (friends || []).filter((f) => selected.has(f.user_id));
  const needsHandle = me && !me.handle;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 31, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}>
      <style>{`@keyframes gwsUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(10,11,13,0.6)" }} />
      <div style={{ position: "relative", width: "100%", maxWidth: 400, boxSizing: "border-box", height: "88%", display: "flex", flexDirection: "column", background: T.surface, borderTop: `1px solid ${T.line}`, borderRadius: "18px 18px 0 0", animation: "gwsUp 0.22s ease" }}>
        <div style={{ padding: "6px 16px 0" }}>
          <button onClick={onClose} aria-label="Close" style={{ display: "block", width: 64, height: 26, margin: "0 auto 4px", background: "none", border: "none", padding: 0 }}>
            <span style={{ display: "block", width: 36, height: 4, borderRadius: 4, background: T.line, margin: "0 auto" }} />
          </button>
          <div style={{ fontFamily: condensed, fontSize: 26, fontWeight: 700, color: T.text, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Group Workout</div>
        </div>

        {me === null ? <div style={{ flex: 1 }} /> : needsHandle ? (
          <div style={{ padding: "0 16px 24px" }}>
            <HandleSetupCard
              subtitle="Friends invite and find you by your ID. Pick one to start lifting together."
              onSaved={(h) => setMe((m) => ({ ...m, handle: h }))}
            />
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, height: 48, padding: "0 14px", background: T.bg, border: `1px solid ${T.line}`, borderRadius: 12, color: T.dim, flexShrink: 0 }}>
                <IconSearch size={18} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search friends or an ID"
                  aria-label="Search friends or an ID"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                  style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: T.text, fontSize: 16 }}
                />
                {query && <button onClick={() => setQuery("")} aria-label="Clear search" style={{ background: "none", border: "none", color: T.dim, width: 32, height: 32 }}><IconX size={14} /></button>}
              </label>

              {!q && groups.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={label}>Saved groups</span>
                    <button onClick={() => setEditingGroups((v) => !v)} style={{ background: "none", border: "none", color: T.dim, fontSize: 12, padding: "4px 0" }}>{editingGroups ? "Done" : "Edit"}</button>
                  </div>
                  <div style={{ display: "flex", gap: 8, overflowX: "auto" }} className="no-scrollbar">
                    {groups.map((g) => (
                      <div key={g.id} style={{ display: "flex", alignItems: "center", flexShrink: 0, height: 36, borderRadius: 18, background: T.surface2, border: `1px solid ${T.line}` }}>
                        <button onClick={() => pickGroup(g)} style={{ height: 36, padding: editingGroups ? "0 6px 0 14px" : "0 14px", background: "none", border: "none", color: T.text, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>
                          {g.name} <span style={{ color: T.dim, fontWeight: 500 }}>· {g.member_ids.length}</span>
                        </button>
                        {editingGroups && (
                          <button onClick={() => removeGroup(g)} aria-label={`Delete group ${g.name}`} style={{ width: 32, height: 36, background: "none", border: "none", color: T.dim }}><IconX size={12} /></button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ ...label, marginBottom: 6 }}>Friends</span>
                {friends && friends.length === 0 && (
                  <div style={{ fontSize: 13, color: T.dim, padding: "4px 0 8px" }}>
                    No friends yet. Search an ID above, or{" "}
                    <button onClick={onOpenFriends} style={{ background: "none", border: "none", color: T.accent, padding: 0, fontSize: 13, fontWeight: 600 }}>open Friends</button>.
                  </div>
                )}
                {shownFriends.map((f) => {
                  const on = selected.has(f.user_id);
                  return (
                    <button key={f.user_id} onClick={() => toggle(f.user_id)} aria-pressed={on} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 52, padding: 0, background: "none", border: "none", textAlign: "left", color: T.text }}>
                      <Avatar person={f} />
                      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 15, fontWeight: 600, ...oneLine }}>{displayName(f)}</span>
                        <span style={{ fontSize: 13, color: T.dim, ...oneLine }}>{f.handle ? `@${f.handle}` : ""}</span>
                      </span>
                      <span style={{ width: 24, height: 24, borderRadius: 7, border: `2px solid ${on ? T.accent : "#4A4F57"}`, background: on ? T.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>
                        {on && <IconCheck size={14} />}
                      </span>
                    </button>
                  );
                })}
                {q && strangers.length > 0 && (
                  <>
                    <span style={{ ...label, margin: "12px 0 6px" }}>Not friends yet</span>
                    {strangers.map((s) => {
                      const sent = requested.has(s.id) || (s.friendship_status === "pending" && s.friendship_direction === "outgoing");
                      return (
                        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 52 }}>
                          <Avatar person={s} />
                          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                            <span style={{ fontSize: 15, fontWeight: 600, color: T.text, ...oneLine }}>{displayName(s)}</span>
                            <span style={{ fontSize: 13, color: T.dim, ...oneLine }}>@{s.handle}</span>
                          </span>
                          {sent ? (
                            <span style={{ fontSize: 13, color: T.dim, whiteSpace: "nowrap" }}>Requested</span>
                          ) : (
                            <button onClick={() => request(s)} style={{ height: 36, padding: "0 14px", borderRadius: 9, border: "none", background: T.accent, color: "#fff", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>Add friend</button>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            <div style={{ padding: "12px 16px calc(16px + env(safe-area-inset-bottom, 0px))", borderTop: `1px solid ${T.line}`, display: "flex", flexDirection: "column", gap: 10 }}>
              {error && <div style={{ fontSize: 12.5, color: T.accent, ...oneLine }}>{error}</div>}
              {naming ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    autoFocus
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveGroup(); }}
                    placeholder="Group name"
                    aria-label="Group name"
                    maxLength={30}
                    style={{ flex: 1, minWidth: 0, height: 44, padding: "0 12px", borderRadius: 10, background: T.bg, border: `1px solid ${T.line}`, color: T.text, fontSize: 16, outline: "none" }}
                  />
                  <button onClick={() => setNaming(false)} style={{ height: 44, padding: "0 12px", borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface2, color: T.text, fontSize: 14 }}>Cancel</button>
                  <button onClick={saveGroup} disabled={!groupName.trim()} style={{ height: 44, padding: "0 14px", borderRadius: 10, border: "none", background: T.accent, color: "#fff", fontSize: 14, fontWeight: 600, opacity: groupName.trim() ? 1 : 0.5 }}>Save</button>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 32, gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                    {selectedPeople.slice(0, 5).map((p, i) => (
                      <span key={p.user_id} style={{ marginLeft: i === 0 ? 0 : -8, border: `2px solid ${T.surface}`, borderRadius: 17, display: "flex" }}><Avatar person={p} size={26} /></span>
                    ))}
                    <span style={{ fontSize: 13, color: T.dim, marginLeft: 8, whiteSpace: "nowrap" }}>{selected.size === 0 ? "Pick who's lifting" : `${selected.size} selected`}</span>
                  </div>
                  {selected.size > 0 && (
                    <button onClick={() => setNaming(true)} style={{ background: "none", border: "none", color: T.accent, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", padding: "6px 0" }}>Save as group</button>
                  )}
                </div>
              )}
              <button onClick={start} disabled={selected.size === 0 || starting} style={{ height: 52, borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 16, fontWeight: 700, opacity: selected.size === 0 || starting ? 0.5 : 1, whiteSpace: "nowrap" }}>
                {starting ? "Starting..." : selected.size === 0 ? "Continue" : `Continue with ${selected.size} friend${selected.size === 1 ? "" : "s"}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
