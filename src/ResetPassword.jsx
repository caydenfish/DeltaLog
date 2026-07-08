import { useState } from "react";
import { supabase } from "./lib/supabaseClient";
import Logo from "./Logo";

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

const inputStyle = { width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, color: T.text, fontSize: 16, padding: "12px 14px", outline: "none", boxSizing: "border-box", marginBottom: 12 };

// Shown when Supabase fires a PASSWORD_RECOVERY auth event — i.e. the
// person clicked the reset-password link from their email. They're
// briefly signed in via a recovery session at this point; this screen
// is the only thing standing between that and them setting an actual
// new password.
export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("idle"); // idle | saving | error
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 6) {
      setStatus("error");
      setErrorMsg("Password needs to be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setStatus("error");
      setErrorMsg("Passwords don't match.");
      return;
    }
    setStatus("saving");
    setErrorMsg("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      onDone();
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", padding: 24, boxSizing: "border-box" }}>
      <div style={{ marginTop: 60, marginBottom: 24 }}>
        <Logo size={72} />
      </div>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: T.text, textAlign: "center", marginBottom: 6 }}>
          Set a new password
        </div>
        <div style={{ color: T.dim, fontSize: 13, textAlign: "center", marginBottom: 24, lineHeight: 1.5 }}>
          Choose a new password for your account.
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>New password</div>
          <input
            type="password"
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            style={inputStyle}
          />
          <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Confirm password</div>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Type it again"
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={status === "saving"}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
              background: status === "saving" ? T.surface2 : T.accent,
              color: status === "saving" ? T.dim : "#fff",
              fontSize: 16, fontWeight: 700, marginTop: 4,
            }}
          >
            {status === "saving" ? "Saving…" : "Save new password"}
          </button>
          {status === "error" && <div style={{ color: T.accent, fontSize: 13, marginTop: 10 }}>{errorMsg}</div>}
        </form>
      </div>
    </div>
  );
}
