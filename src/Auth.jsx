import { useState } from "react";
import { supabase } from "./lib/supabaseClient";
import Logo, { Wordmark } from "./Logo";

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

export default function Auth() {
  const [mode, setMode] = useState("password"); // "password" | "magiclink" | "forgot"
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState("");

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    }
    // On success, Supabase redirects to Google, then back to the app —
    // nothing else to do here.
  }

  async function sendLink(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setStatus("sending");
    setErrorMsg("");
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        setStatus("error");
        setErrorMsg(error.message);
      } else {
        setStatus("sent"); // Supabase requires email confirmation by default
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setStatus("error");
        setErrorMsg(error.message);
      }
      // On success, the auth listener in App.jsx picks up the new session
      // automatically — nothing else to do here.
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setErrorMsg("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
    }
  }

  function switchMode(next) {
    setMode(next);
    setStatus("idle");
    setErrorMsg("");
    setPassword("");
  }

  return (
    <div style={{ height: "100vh", background: T.bg, display: "flex", flexDirection: "column", padding: 24, boxSizing: "border-box", overflow: "hidden" }}>
      <div style={{ flex: 1.3, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <Logo size={120} />
        <Wordmark size={40} />
        <div style={{ color: T.dim, fontSize: 13, fontWeight: 600, letterSpacing: 0.3, textAlign: "center", marginTop: -4 }}>
          No macros. No streak badges. Just weight going up.
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", width: "100%", maxWidth: 360, margin: "0 auto", overflowY: "auto" }}>
        <div style={{ color: T.dim, fontSize: 14, marginBottom: 20, textAlign: "center" }}>
          Sign in to sync your sets across sessions.
        </div>

        {status === "sent" ? (
          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16 }}>
            <div style={{ color: T.green, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Check your email</div>
            <div style={{ color: T.dim, fontSize: 13, lineHeight: 1.5 }}>
              {mode === "forgot"
                ? <>Sent a password reset link to <span style={{ color: T.text }}>{email}</span>. Open it on this device to set a new password.</>
                : mode === "magiclink"
                ? <>Sent a sign-in link to <span style={{ color: T.text }}>{email}</span>. Open it on this device to get in.</>
                : <>Sent a confirmation link to <span style={{ color: T.text }}>{email}</span>. Open it to activate your account, then come back and sign in.</>}
            </div>
            <button
              onClick={() => switchMode(mode === "forgot" ? "password" : mode)}
              style={{ marginTop: 12, background: "none", border: "none", color: T.dim, fontSize: 13, textDecoration: "underline", padding: 0 }}
            >
              {mode === "forgot" ? "Back to sign in" : "Use a different email"}
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={signInWithGoogle}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "13px 0", borderRadius: 12, border: `1px solid ${T.line}`, background: T.surface, color: T.text, fontSize: 15, fontWeight: 600, marginBottom: 18 }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>
              Continue with Google
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <div style={{ flex: 1, height: 1, background: T.line }} />
              <div style={{ color: T.dim, fontSize: 12 }}>or</div>
              <div style={{ flex: 1, height: 1, background: T.line }} />
            </div>

            {mode === "forgot" ? (
              <form onSubmit={handleForgotPassword}>
                <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Email</div>
                <input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={inputStyle}
                />
                <button
                  type="submit"
                  disabled={status === "sending" || !email.trim()}
                  style={{
                    width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
                    background: status === "sending" || !email.trim() ? T.surface2 : T.accent,
                    color: status === "sending" || !email.trim() ? T.dim : "#fff",
                    fontSize: 16, fontWeight: 700, marginBottom: 12,
                  }}
                >
                  {status === "sending" ? "Sending…" : "Send reset link"}
                </button>
                {status === "error" && <div style={{ color: T.accent, fontSize: 13, marginBottom: 10 }}>{errorMsg}</div>}
                <button type="button" onClick={() => switchMode("password")} style={{ width: "100%", background: "none", border: "none", color: T.dim, fontSize: 13, textDecoration: "underline", padding: 0 }}>
                  Back to sign in
                </button>
              </form>
            ) : mode === "magiclink" ? (
              <form onSubmit={sendLink}>
                <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Email</div>
                <input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={inputStyle}
                />
                <button
                  type="submit"
                  disabled={status === "sending" || !email.trim()}
                  style={{
                    width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
                    background: status === "sending" || !email.trim() ? T.surface2 : T.accent,
                    color: status === "sending" || !email.trim() ? T.dim : "#fff",
                    fontSize: 16, fontWeight: 700, marginBottom: 12,
                  }}
                >
                  {status === "sending" ? "Sending…" : "Send magic link"}
                </button>
                {status === "error" && <div style={{ color: T.accent, fontSize: 13, marginBottom: 10 }}>{errorMsg}</div>}
                <button type="button" onClick={() => switchMode("password")} style={{ width: "100%", background: "none", border: "none", color: T.dim, fontSize: 13, textDecoration: "underline", padding: 0 }}>
                  Use a password instead
                </button>
              </form>
            ) : (
              <form onSubmit={handlePasswordSubmit}>
                <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Email</div>
                <input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={inputStyle}
                />
                <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Password</div>
                <input
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignUp ? "At least 6 characters" : "••••••••"}
                  style={inputStyle}
                />
                {!isSignUp && (
                  <button type="button" onClick={() => switchMode("forgot")} style={{ display: "block", marginBottom: 12, marginTop: -6, background: "none", border: "none", color: T.dim, fontSize: 12.5, textDecoration: "underline", padding: 0 }}>
                    Forgot password?
                  </button>
                )}
                <button
                  type="submit"
                  disabled={status === "sending" || !email.trim() || !password}
                  style={{
                    width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
                    background: status === "sending" || !email.trim() || !password ? T.surface2 : T.accent,
                    color: status === "sending" || !email.trim() || !password ? T.dim : "#fff",
                    fontSize: 16, fontWeight: 700, marginBottom: 12,
                  }}
                >
                  {status === "sending" ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
                </button>
                {status === "error" && <div style={{ color: T.accent, fontSize: 13, marginBottom: 10 }}>{errorMsg}</div>}
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <button type="button" onClick={() => { setIsSignUp(!isSignUp); setStatus("idle"); setErrorMsg(""); }} style={{ background: "none", border: "none", color: T.dim, fontSize: 12.5, textDecoration: "underline", padding: 0 }}>
                    {isSignUp ? "Already have an account? Sign in" : "New here? Create an account"}
                  </button>
                  <button type="button" onClick={() => switchMode("magiclink")} style={{ background: "none", border: "none", color: T.dim, fontSize: 12.5, textDecoration: "underline", padding: 0 }}>
                    Use a magic link instead
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
