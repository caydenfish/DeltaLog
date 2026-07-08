import { useState } from "react";
import { saveProfile } from "./lib/queries";
import { calculateAge } from "./lib/dots";
import { HEIGHT_UNITS, HEIGHT_UNIT_LABELS, ftInToInches, inchesToFtIn } from "./lib/height";
import { toLocalDateStr } from "./lib/time";

const T = {
  bg: "#101216",
  surface: "#1A1D23",
  surface2: "#22262E",
  line: "#2C313B",
  text: "#F2F1EC",
  dim: "#8B919D",
  accent: "#E8442E",
};

export default function ProfileEditor({ profile, units, userId, onClose, onSaved }) {
  const [firstName, setFirstName] = useState(profile?.first_name || "");
  const [lastName, setLastName] = useState(profile?.last_name || "");
  const [gender, setGender] = useState(profile?.gender || "");
  const [dob, setDob] = useState(profile?.date_of_birth || "");
  const [weight, setWeight] = useState(profile?.weight ? String(profile.weight) : "");
  const [heightUnit, setHeightUnit] = useState(profile?.height_unit || "ftin");
  const initialFtIn = profile?.height_unit === "ftin" && profile?.height ? inchesToFtIn(profile.height) : null;
  const [heightFt, setHeightFt] = useState(initialFtIn ? String(initialFtIn.ft) : "");
  const [heightIn, setHeightIn] = useState(initialFtIn ? String(initialFtIn.in) : "");
  const [height, setHeight] = useState(profile?.height_unit !== "ftin" && profile?.height ? String(profile.height) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const heightVal = heightUnit === "ftin" ? ftInToInches(heightFt, heightIn) : (parseFloat(height) || null);
      await saveProfile(userId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender,
        dateOfBirth: dob,
        weight: parseFloat(weight) || null,
        weightUnit: units,
        height: heightVal,
        heightUnit,
      });
      onSaved({ ...profile, first_name: firstName.trim(), last_name: lastName.trim(), gender, date_of_birth: dob, weight: parseFloat(weight) || null, height: heightVal, height_unit: heightUnit });
      onClose();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  const inputStyle = { width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 14, padding: "9px 10px", outline: "none", boxSizing: "border-box", marginBottom: 14 };

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 30, display: "flex", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 400, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8, position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: `1px solid ${T.line}`, color: T.dim, borderRadius: 8, padding: "4px 10px", fontSize: 13 }}>‹</button>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: T.text, textAlign: "center" }}>PROFILE</div>
          <div style={{ width: 26 }} />
        </div>

        <div style={{ padding: 16, flex: 1 }}>
          <div style={{ fontSize: 12, color: T.dim, marginBottom: 6 }}>First name</div>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />

          <div style={{ fontSize: 12, color: T.dim, marginBottom: 6 }}>Last name</div>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />

          <div style={{ fontSize: 12, color: T.dim, marginBottom: 6 }}>Gender</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {["Male", "Female", "Other"].map((g) => (
              <button key={g} onClick={() => setGender(g)} style={{
                flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: `1px solid ${gender === g ? T.accent : T.line}`,
                background: gender === g ? "rgba(232,68,46,0.12)" : T.surface2,
                color: gender === g ? T.text : T.dim,
              }}>{g}</button>
            ))}
          </div>

          <div style={{ fontSize: 12, color: T.dim, marginBottom: 6 }}>
            Date of birth {dob && <span style={{ color: T.text }}>({calculateAge(dob)} yrs)</span>}
          </div>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            max={toLocalDateStr(new Date())}
            style={{ ...inputStyle, colorScheme: "dark" }}
          />

          <div style={{ fontSize: 12, color: T.dim, marginBottom: 6 }}>Body weight ({units}) <span style={{ opacity: 0.7 }}>— optional</span></div>
          <input
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value.replace(/[^0-9.]/g, ""))}
            style={inputStyle}
          />

          <div style={{ fontSize: 12, color: T.dim, marginBottom: 6 }}>Height <span style={{ opacity: 0.7 }}>— optional</span></div>
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
            <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
              <input
                inputMode="decimal"
                value={heightFt}
                onChange={(e) => setHeightFt(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="ft"
                style={{ flex: 1, minWidth: 0, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 14, padding: "9px 10px", outline: "none", boxSizing: "border-box" }}
              />
              <input
                inputMode="decimal"
                value={heightIn}
                onChange={(e) => setHeightIn(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="in"
                style={{ flex: 1, minWidth: 0, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 14, padding: "9px 10px", outline: "none", boxSizing: "border-box" }}
              />
            </div>
          ) : (
            <input
              inputMode="decimal"
              value={height}
              onChange={(e) => setHeight(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder={heightUnit === "cm" ? "e.g. 178" : "e.g. 70"}
              style={{ width: "100%", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, fontSize: 14, padding: "9px 10px", outline: "none", boxSizing: "border-box", marginBottom: 4 }}
            />
          )}
          <div style={{ fontSize: 10, color: T.dim, marginBottom: 12 }}>Not currently used in your strength score — DOTS only factors in bodyweight and gender. Captured here for future use.</div>

          {error && <div style={{ color: T.accent, fontSize: 12.5, marginBottom: 12 }}>{error}</div>}

          <div style={{ fontSize: 10, color: T.dim, marginTop: 4 }}>Used for DOTS strength scoring and to personalize insights. Leaving weight blank uses your last recorded weight where available.</div>
        </div>

        <div style={{ position: "sticky", bottom: 0, borderTop: `1px solid ${T.line}`, background: T.bg, padding: 16 }}>
          <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: saving ? T.surface2 : T.accent, color: saving ? T.dim : "#fff", fontSize: 14, fontWeight: 700 }}>
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
