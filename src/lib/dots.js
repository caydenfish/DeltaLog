// DOTS coefficients (Tim Konstantin's formula, in kg).
const COEFF = {
  male: { a: -0.000001093, b: 0.0007391293, c: -0.1918759221, d: 24.0900756, e: -307.75076 },
  female: { a: -0.0000010706, b: 0.0005158568, c: -0.1126655495, d: 13.6175032, e: 57.96288 },
};

const LB_TO_KG = 0.45359237;

// Returns a DOTS score for a given lift, given bodyweight and gender
// (both required for the formula). Inputs in lb; converts internally.
// Returns null if gender isn't male/female (DOTS has no published
// coefficients for other categories) or inputs are missing.
export function computeDOTS(liftLb, bodyweightLb, gender) {
  const g = (gender || "").toLowerCase();
  if (g !== "male" && g !== "female") return null;
  if (!liftLb || !bodyweightLb) return null;

  const bw = Math.min(Math.max(bodyweightLb * LB_TO_KG, 40), 200); // formula is only validated in this range
  const lift = liftLb * LB_TO_KG;
  const { a, b, c, d, e } = COEFF[g];
  const denom = a * bw ** 4 + b * bw ** 3 + c * bw ** 2 + d * bw + e;
  if (denom <= 0) return null;
  return Math.round((lift * 500) / denom * 10) / 10;
}

// Rough, commonly-cited qualitative bands for DOTS scores. This is NOT a
// real population percentile — we don't have a comparison dataset for
// that — just a widely-used informal reference scale, presented as such.
export function dotsBand(score) {
  if (score === null) return null;
  if (score < 250) return "Beginner";
  if (score < 350) return "Novice";
  if (score < 400) return "Intermediate";
  if (score < 450) return "Advanced";
  return "Elite";
}

export function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}
