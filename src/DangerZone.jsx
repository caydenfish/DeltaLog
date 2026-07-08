import { useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { resetAllUserData, deleteOwnAccount } from "./lib/queries";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

export default function DangerZone({ user, onClose, onDataReset }) {
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [error, setError] = useState(null);

  async function handleResetData() {
    setResetting(true);
    setError(null);
    try {
      await resetAllUserData(user.id);
      onDataReset();
    } catch (err) {
      setError(err.message);
      setResetting(false);
    }
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    setError(null);
    try {
      await deleteOwnAccount(user.id);
      await supabase.auth.signOut();
      // signOut flips the auth listener in App.jsx back to the sign-in
      // screen — nothing else to do here, the account is fully gone.
    } catch (err) {
      setError(err.message);
      setDeletingAccount(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 25, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 400, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 13 }}>‹</button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: T.accent, textAlign: "center" }}>DANGER ZONE</div>
          <div style={{ width: 26 }} />
        </div>

        <div style={{ padding: 16, flex: 1 }}>
          <div style={{ color: T.dim, fontSize: 12.5, marginBottom: 16, lineHeight: 1.4 }}>
            Everything below is permanent and can't be undone. Each action needs its own confirmation before anything actually happens.
          </div>

          {error && <div style={{ color: T.accent, fontSize: 13, marginBottom: 16 }}>{error}</div>}

          <div style={{ background: T.surface, border: `1px solid ${T.accent}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
            {!resetConfirm ? (
              <>
                <div style={{ color: T.text, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Reset all data</div>
                <div style={{ color: T.dim, fontSize: 12, marginBottom: 12, lineHeight: 1.4 }}>
                  Permanently deletes every workout, template, and favorite, plus your profile. You'll be taken back through setup and asked to re-enter your gender, date of birth, weight, and height.
                </div>
                <button onClick={() => setResetConfirm(true)} style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: `1px solid ${T.accent}`, background: "none", color: T.accent, fontSize: 14, fontWeight: 700 }}>
                  Reset All Data
                </button>
              </>
            ) : (
              <>
                <div style={{ color: T.accent, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Are you sure?</div>
                <div style={{ color: T.dim, fontSize: 13, marginBottom: 12 }}>
                  This can't be undone. All workout history, templates, favorites, and profile info will be gone for good.
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setResetConfirm(false)} disabled={resetting} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 15 }}>Cancel</button>
                  <button onClick={handleResetData} disabled={resetting} style={{ flex: 2, padding: "12px 0", borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontSize: 15, fontWeight: 700 }}>
                    {resetting ? "Resetting…" : "Yes, delete everything"}
                  </button>
                </div>
              </>
            )}
          </div>

          <div style={{ background: T.surface, border: `1px solid ${T.accent}`, borderRadius: 12, padding: 14 }}>
            {!deleteAccountConfirm ? (
              <>
                <div style={{ color: T.text, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Delete account</div>
                <div style={{ color: T.dim, fontSize: 12, marginBottom: 12, lineHeight: 1.4 }}>
                  Permanently deletes your account and every piece of data tied to it — workouts, templates, custom exercises, progress photos, and your login itself. You won't be able to sign back in with this email afterward.
                </div>
                <button onClick={() => { setDeleteAccountConfirm(true); setDeleteConfirmText(""); }} style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: `1px solid ${T.accent}`, background: "none", color: T.accent, fontSize: 14, fontWeight: 700 }}>
                  Delete Account
                </button>
              </>
            ) : (
              <>
                <div style={{ color: T.accent, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>This is permanent</div>
                <div style={{ color: T.dim, fontSize: 13, marginBottom: 10, lineHeight: 1.4 }}>
                  Your account, login, and all data are gone for good — there's no recovery. Type <b style={{ color: T.text }}>DELETE</b> to confirm.
                </div>
                <input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 14, padding: "10px 12px", outline: "none", boxSizing: "border-box", marginBottom: 12 }}
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setDeleteAccountConfirm(false)} disabled={deletingAccount} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${T.line}`, background: "none", color: T.dim, fontSize: 15 }}>Cancel</button>
                  <button onClick={handleDeleteAccount} disabled={deletingAccount || deleteConfirmText !== "DELETE"} style={{ flex: 2, padding: "12px 0", borderRadius: 12, border: "none", background: deleteConfirmText === "DELETE" ? T.accent : T.surface2, color: deleteConfirmText === "DELETE" ? "#fff" : T.dim, fontSize: 15, fontWeight: 700 }}>
                    {deletingAccount ? "Deleting…" : "Delete my account"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
