import { useState } from "react";
import { saveProfile } from "./lib/queries";
import { setPref } from "./lib/prefs";
import { HEIGHT_UNITS, HEIGHT_UNIT_LABELS, ftInToInches, inchesToFtIn } from "./lib/height";
import { toLocalDateStr } from "./lib/time";
import OnboardingProgress from "./OnboardingProgress";
import Logo from "./Logo";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

export default function Onboarding({ user, profile, onComplete }) {
  const [firstName, setFirstName] = useState(profile?.first_name || "");
  const [lastName, setLastName] = useState(profile?.last_name || "");
  const [gender, setGender] = useState(profile?.gender || "");
  const [dob, setDob] = useState(profile?.date_of_birth || "");
  const [weight, setWeight] = useState(profile?.weight ? String(profile.weight) : "");
  const [weightUnit, setWeightUnit] = useState(profile?.weight_unit || "lb");
  const [heightUnit, setHeightUnit] = useState(profile?.height_unit || "ftin");
  const initialFtIn = profile?.height_unit === "ftin" && profile?.height ? inchesToFtIn(profile.height) : null;
  const [heightFt, setHeightFt] = useState(initialFtIn ? String(initialFtIn.ft) : "");
  const [heightIn, setHeightIn] = useState(initialFtIn ? String(initialFtIn.in) : "");
  const [height, setHeight] = useState(profile?.height_unit && profile.height_unit !== "ftin" && profile?.height ? String(profile.height) : "");
  const [heardAboutUs, setHeardAboutUs] = useState(profile?.heard_about_us || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const valid = firstName.trim() && lastName.trim() && gender && dob;

  async function handleSave() {
    if (!valid) return;
    setSaving(true);
    try {
      const heightVal = heightUnit === "ftin" ? ftInToInches(heightFt, heightIn) : (parseFloat(height) || null);
      await saveProfile(user.id, {
        firstName: firstName.trim(), lastName: lastName.trim(),
        gender, dateOfBirth: dob,
        weight: parseFloat(weight) || null, weightUnit,
        height: heightVal, heightUnit,
        heardAboutUs: heardAboutUs.trim() || null,
      });
      setPref("units", weightUnit);
      onComplete();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", padding: 24, boxSizing: "border-box" }}>
      <div style={{ marginTop: 40, marginBottom: 24 }}>
        <Logo size={64} />
      </div>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <OnboardingProgress step={1} total={7} />
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: T.text, textAlign: "center", marginBottom: 6 }}>
          A few quick details
        </div>
        <div style={{ color: T.dim, fontSize: 13, textAlign: "center", marginBottom: 28, lineHeight: 1.5 }}>
          Used for strength scoring and to personalize your experience. You can update these later in Settings.
        </div>

        <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>First name</div>
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First name"
          style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, color: T.text, fontSize: 15, padding: "12px 14px", outline: "none", boxSizing: "border-box", marginBottom: 18 }}
        />

        <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Last name</div>
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Last name"
          style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, color: T.text, fontSize: 15, padding: "12px 14px", outline: "none", boxSizing: "border-box", marginBottom: 18 }}
        />

        <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Gender</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {["Male", "Female", "Other"].map((g) => (
            <button key={g} onClick={() => setGender(g)} style={{
              flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 600,
              border: `1px solid ${gender === g ? T.accent : T.line}`,
              background: gender === g ? "rgba(232,68,46,0.12)" : T.surface,
              color: gender === g ? T.text : T.dim,
            }}>{g}</button>
          ))}
        </div>
        {gender === "Other" && (
          <div style={{ fontSize: 11, color: T.dim, marginTop: -12, marginBottom: 18, lineHeight: 1.4 }}>
            DOTS strength scoring only has published formulas for male/female bodies, so that feature won't be available, everything else works the same.
          </div>
        )}

        <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Date of birth</div>
        <input
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          max={toLocalDateStr(new Date())}
          style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, color: T.text, fontSize: 15, padding: "11px 12px", outline: "none", boxSizing: "border-box", marginBottom: 18, colorScheme: "dark" }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1 }}>Body weight <span style={{ textTransform: "none" }}>(optional)</span></div>
          <div style={{ display: "flex", gap: 4 }}>
            {["lb", "kg"].map((u) => (
              <button key={u} onClick={() => setWeightUnit(u)} style={{
                padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                border: `1px solid ${weightUnit === u ? T.accent : T.line}`,
                background: weightUnit === u ? "rgba(232,68,46,0.12)" : T.surface2,
                color: weightUnit === u ? T.text : T.dim,
              }}>{u}</button>
            ))}
          </div>
        </div>
        <input
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder={`e.g. ${weightUnit === "kg" ? "80" : "178"}`}
          style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, color: T.text, fontSize: 15, padding: "11px 12px", outline: "none", boxSizing: "border-box", marginBottom: 8 }}
        />
        <div style={{ fontSize: 11, color: T.dim, marginBottom: 24, lineHeight: 1.4 }}>
          You can skip this, but adding it now improves the accuracy of your strength score and insights. If you leave it blank later on, we'll use your last recorded weight.
        </div>

        <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Height <span style={{ textTransform: "none" }}>(optional)</span></div>
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          {HEIGHT_UNITS.map((u) => (
            <button key={u} onClick={() => setHeightUnit(u)} style={{
              flex: 1, padding: "6px 0", borderRadius: 7, fontSize: 11, fontWeight: 600, textAlign: "center",
              border: `1px solid ${heightUnit === u ? T.accent : T.line}`,
              background: heightUnit === u ? "rgba(232,68,46,0.12)" : T.surface2,
              color: heightUnit === u ? T.text : T.dim,
            }}>{HEIGHT_UNIT_LABELS[u]}</button>
          ))}
        </div>
        {heightUnit === "ftin" ? (
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              inputMode="decimal"
              value={heightFt}
              onChange={(e) => setHeightFt(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="ft"
              style={{ flex: 1, minWidth: 0, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, color: T.text, fontSize: 15, padding: "11px 12px", outline: "none", boxSizing: "border-box" }}
            />
            <input
              inputMode="decimal"
              value={heightIn}
              onChange={(e) => setHeightIn(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="in"
              style={{ flex: 1, minWidth: 0, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, color: T.text, fontSize: 15, padding: "11px 12px", outline: "none", boxSizing: "border-box" }}
            />
          </div>
        ) : (
          <input
            inputMode="decimal"
            value={height}
            onChange={(e) => setHeight(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder={`e.g. ${heightUnit === "cm" ? "178" : "70"}`}
            style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, color: T.text, fontSize: 15, padding: "11px 12px", outline: "none", boxSizing: "border-box", marginBottom: 8 }}
          />
        )}
        <div style={{ fontSize: 11, color: T.dim, marginBottom: 24, lineHeight: 1.4 }}>
          Not used in your strength score today (DOTS only factors in bodyweight and gender) — captured here for future use.
        </div>

        <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>How did you hear about us? <span style={{ textTransform: "none" }}>(optional)</span></div>
        <input
          value={heardAboutUs}
          onChange={(e) => setHeardAboutUs(e.target.value)}
          placeholder="e.g. a friend, Instagram, App Store search"
          style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, color: T.text, fontSize: 15, padding: "11px 12px", outline: "none", boxSizing: "border-box", marginBottom: 24 }}
        />

        <button onClick={handleSave} disabled={!valid || saving} style={{
          width: "100%", padding: "15px 0", borderRadius: 14, border: "none",
          background: !valid || saving ? T.surface2 : T.accent,
          color: !valid || saving ? T.dim : "#fff",
          fontSize: 16, fontWeight: 700,
        }}>
          {saving ? "Saving…" : "Continue"}
        </button>
        {error && <div style={{ color: T.accent, fontSize: 13, marginTop: 10, textAlign: "center" }}>{error}</div>}
      </div>
    </div>
  );
}
