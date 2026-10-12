import { useEffect, useRef, useState } from "react";
import { ScreenHeader, SettingsSectionLabel } from "./SettingsUI";
import { IconCopy, IconShare, IconSearch, IconX, IconUsers, IconCheck } from "./Icons";
import {
  fetchMyHandle, setMyHandle, normalizeHandle, HANDLE_PATTERN,
  fetchFriends, searchUsersByHandle, sendFriendRequest, respondFriendRequest, removeFriendship,
  displayName, initialOf, colorFor, lastLiftedLabel,
  shareDeltaLog, inviteText, contactsSupported, pickContacts, APP_URL,
} from "./lib/social";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
  green: "#3BA55D",
};
const condensed = "'Barlow Condensed', sans-serif";
const oneLine = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const eyebrow = { fontFamily: condensed, fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: T.dim };

export function Avatar({ person, size = 34 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size / 2, background: colorFor(person.user_id || person.id), color: "#0F1012", fontSize: Math.round(size * 0.38), fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {initialOf(person)}
    </span>
  );
}

function PillButton({ children, onClick, primary, disabled, ariaLabel }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={ariaLabel} style={{ minWidth: 36, height: 36, padding: "0 14px", borderRadius: 9, border: primary ? "none" : `1px solid ${T.line}`, background: primary ? T.accent : T.surface2, color: primary ? "#fff" : T.text, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", opacity: disabled ? 0.5 : 1, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {children}
    </button>
  );
}

function PersonRow({ person, sub, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 52 }}>
      <Avatar person={person} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: T.text, ...oneLine }}>{displayName(person)}</span>
        <span style={{ fontSize: 13, color: T.dim, ...oneLine }}>{sub}</span>
      </div>
      {right}
    </div>
  );
}

// "Pick your ID" form. Used here and as the gate before a group workout.
export function HandleSetupCard({ initial = "", onSaved, title = "Pick your ID", subtitle = "Friends find you by this. You can change it once a week." }) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const clean = normalizeHandle(value);
  const valid = HANDLE_PATTERN.test(clean);

  async function save() {
    if (!valid || saving) return;
    setSaving(true); setError(null);
    try {
      const h = await setMyHandle(clean);
      onSaved(h);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontFamily: condensed, fontSize: 20, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: T.text }}>{title}</span>
        <span style={{ fontSize: 13, color: T.dim }}>{subtitle}</span>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 4, height: 48, padding: "0 12px", borderRadius: 10, background: T.bg, border: `1px solid ${error ? T.accent : T.line}` }}>
        <span style={{ color: T.dim, fontSize: 16 }}>@</span>
        <input
          value={value}
          onChange={(e) => { setValue(e.target.value.replace(/\s/g, "")); setError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          placeholder="yourname"
          aria-label="Your ID"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          maxLength={21}
          style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: T.text, fontSize: 16 }}
        />
      </label>
      <div style={{ fontSize: 12, color: error ? T.accent : T.dim, minHeight: 16, ...oneLine }}>
        {error || (value && !valid ? "3-20 characters: letters, numbers, _ and ." : "")}
      </div>
      <button onClick={save} disabled={!valid || saving} style={{ height: 48, borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 15, fontWeight: 700, opacity: !valid || saving ? 0.5 : 1 }}>
        {saving ? "Saving..." : "Save ID"}
      </button>
    </div>
  );
}

export default function Friends({ user, onClose }) {
  const [me, setMe] = useState(null); // { handle, first_name }
  const [editingHandle, setEditingHandle] = useState(false);
  const [lists, setLists] = useState(null); // { friends, incoming, outgoing }
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [toast, setToast] = useState(null);
  const searchSeq = useRef(0);

  function flash(msg) { setToast(msg); setTimeout(() => setToast(null), 2400); }

  async function reload() {
    try { setLists(await fetchFriends()); } catch { setLists({ friends: [], incoming: [], outgoing: [] }); }
  }
  useEffect(() => {
    fetchMyHandle(user.id).then(setMe).catch(() => setMe({ handle: null }));
    reload();
  }, [user.id]);

  // Debounced handle search.
  useEffect(() => {
    const q = normalizeHandle(query);
    if (q.length < 2) { setResults(null); setSearching(false); return; }
    setSearching(true);
    const seq = ++searchSeq.current;
    const t = setTimeout(() => {
      searchUsersByHandle(q)
        .then((r) => { if (seq === searchSeq.current) setResults(r); })
        .catch(() => { if (seq === searchSeq.current) setResults([]); })
        .finally(() => { if (seq === searchSeq.current) setSearching(false); });
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  async function addFriend(person) {
    setBusyId(person.id);
    try {
      const status = await sendFriendRequest(person.id);
      setResults((rs) => rs && rs.map((r) => (r.id === person.id ? { ...r, friendship_status: status, friendship_direction: status === "accepted" ? r.friendship_direction : "outgoing" } : r)));
      flash(status === "accepted" ? `You and ${displayName(person)} are friends` : "Request sent");
      reload();
    } catch (e) {
      flash(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function respond(row, accept) {
    setBusyId(row.friendship_id);
    try { await respondFriendRequest(row.friendship_id, accept); await reload(); }
    catch (e) { flash(e.message); }
    finally { setBusyId(null); }
  }

  async function remove(row) {
    setBusyId(row.friendship_id);
    try { await removeFriendship(row.friendship_id); setConfirmRemove(null); await reload(); }
    catch (e) { flash(e.message); }
    finally { setBusyId(null); }
  }

  async function copyId() {
    try { await navigator.clipboard.writeText(`@${me.handle}`); flash("ID copied"); } catch { flash("Couldn't copy"); }
  }
  async function shareId() {
    const r = await shareDeltaLog({ text: inviteText(me && me.handle) });
    if (r === "copied") flash("Invite link copied");
  }
  async function inviteFromContacts() {
    try {
      const picked = await pickContacts();
      const numbers = picked.flatMap((c) => (c.tel || []).slice(0, 1)).filter(Boolean);
      if (numbers.length === 0) { if (picked.length) flash("No phone numbers on those contacts"); return; }
      const body = encodeURIComponent(`${inviteText(me && me.handle)} ${APP_URL}`);
      window.location.href = `sms:${numbers.join(",")}?&body=${body}`;
    } catch { /* picker dismissed */ }
  }

  function searchAction(r) {
    if (r.friendship_status === "accepted") return <span style={{ fontSize: 13, color: T.green, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}><IconCheck size={14} /> Friends</span>;
    if (r.friendship_status === "pending" && r.friendship_direction === "outgoing") return <span style={{ fontSize: 13, color: T.dim, whiteSpace: "nowrap" }}>Requested</span>;
    if (r.friendship_status === "pending" && r.friendship_direction === "incoming") return <PillButton primary onClick={() => addFriend(r)} disabled={busyId === r.id}>Accept</PillButton>;
    return <PillButton primary onClick={() => addFriend(r)} disabled={busyId === r.id || !(me && me.handle)}>Add</PillButton>;
  }

  const hasHandle = me && me.handle;

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 25, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 400, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <ScreenHeader title="Friends" eyebrow="Settings" onBack={onClose} />
        <div style={{ padding: "4px 16px 32px", display: "flex", flexDirection: "column", gap: 20 }}>

          {me === null ? null : !hasHandle || editingHandle ? (
            <HandleSetupCard
              initial={(me && me.handle) || ""}
              title={hasHandle ? "Change your ID" : "Pick your ID"}
              onSaved={(h) => { setMe((m) => ({ ...m, handle: h })); setEditingHandle(false); flash("ID saved"); }}
            />
          ) : (
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setEditingHandle(true)} aria-label="Change your ID" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2, background: "none", border: "none", padding: 0, textAlign: "left" }}>
                <span style={eyebrow}>Your ID</span>
                <span style={{ fontFamily: condensed, fontSize: 24, fontWeight: 700, color: T.text, ...oneLine }}>@{me.handle}</span>
              </button>
              <button onClick={copyId} aria-label="Copy your ID" style={{ width: 44, height: 44, borderRadius: 10, border: "none", background: T.surface2, color: T.text, display: "flex", alignItems: "center", justifyContent: "center" }}><IconCopy size={18} /></button>
              <button onClick={shareId} aria-label="Share your ID" style={{ width: 44, height: 44, borderRadius: 10, border: "none", background: T.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><IconShare size={18} /></button>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SettingsSectionLabel>Find by ID</SettingsSectionLabel>
            <label style={{ display: "flex", alignItems: "center", gap: 10, height: 48, padding: "0 14px", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, color: T.dim }}>
              <IconSearch size={18} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="@username"
                aria-label="Find by ID"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: T.text, fontSize: 16 }}
              />
              {query && <button onClick={() => setQuery("")} aria-label="Clear search" style={{ background: "none", border: "none", color: T.dim, width: 32, height: 32 }}><IconX size={14} /></button>}
            </label>
            {!hasHandle && query && <div style={{ fontSize: 12, color: T.dim }}>Pick your ID first so people know who's adding them.</div>}
            {results && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {results.length === 0 && !searching && <div style={{ fontSize: 13, color: T.dim, padding: "8px 2px" }}>No one with that ID yet.</div>}
                {results.map((r) => (
                  <PersonRow key={r.id} person={r} sub={`@${r.handle}`} right={searchAction(r)} />
                ))}
              </div>
            )}
          </div>

          {lists && lists.incoming.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <SettingsSectionLabel>Requests · {lists.incoming.length}</SettingsSectionLabel>
              {lists.incoming.map((r) => (
                <PersonRow key={r.friendship_id} person={r} sub={r.handle ? `@${r.handle}` : ""} right={
                  <div style={{ display: "flex", gap: 6 }}>
                    <PillButton primary onClick={() => respond(r, true)} disabled={busyId === r.friendship_id}>Accept</PillButton>
                    <PillButton onClick={() => respond(r, false)} disabled={busyId === r.friendship_id} ariaLabel="Decline request"><IconX size={14} /></PillButton>
                  </div>
                } />
              ))}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <SettingsSectionLabel>Friends{lists ? ` · ${lists.friends.length}` : ""}</SettingsSectionLabel>
            {lists && lists.friends.length === 0 && (
              <div style={{ fontSize: 13, color: T.dim, padding: "4px 2px" }}>Search an ID above or invite someone below.</div>
            )}
            {lists && lists.friends.map((f) => (
              <PersonRow key={f.friendship_id} person={f} sub={[f.handle && `@${f.handle}`, lastLiftedLabel(f.last_workout_at)].filter(Boolean).join(" · ")} right={
                confirmRemove === f.friendship_id ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <PillButton onClick={() => setConfirmRemove(null)}>Keep</PillButton>
                    <PillButton primary onClick={() => remove(f)} disabled={busyId === f.friendship_id}>Remove</PillButton>
                  </div>
                ) : (
                  <button onClick={() => setConfirmRemove(f.friendship_id)} aria-label={`Remove ${displayName(f)}`} style={{ width: 36, height: 36, borderRadius: 9, border: "none", background: "transparent", color: T.dim, display: "flex", alignItems: "center", justifyContent: "center" }}><IconX size={14} /></button>
                )
              } />
            ))}
            {lists && lists.outgoing.map((r) => (
              <PersonRow key={r.friendship_id} person={r} sub="Request sent" right={
                <PillButton onClick={() => remove(r)} disabled={busyId === r.friendship_id}>Cancel</PillButton>
              } />
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SettingsSectionLabel>Invite to DeltaLog</SettingsSectionLabel>
            <button onClick={shareId} style={{ height: 52, borderRadius: 12, border: `1px solid ${T.line}`, background: T.surface, color: T.text, fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <IconShare size={16} /> Send an invite
            </button>
            {contactsSupported() && (
              <button onClick={inviteFromContacts} style={{ height: 52, borderRadius: 12, border: `1px solid ${T.line}`, background: T.surface, color: T.text, fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <IconUsers size={16} /> Invite from contacts
              </button>
            )}
          </div>
        </div>
      </div>
      {toast && (
        <div style={{ position: "fixed", left: "50%", bottom: "calc(24px + env(safe-area-inset-bottom, 0px))", transform: "translateX(-50%)", background: T.surface2, border: `1px solid ${T.line}`, color: T.text, borderRadius: 999, padding: "10px 16px", fontSize: 13, zIndex: 40, whiteSpace: "nowrap" }}>{toast}</div>
      )}
    </div>
  );
}
