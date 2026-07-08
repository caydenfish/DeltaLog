// Height is always stored in the profile as a single number, in either
// inches or centimeters depending on height_unit. The "ft, in" option is
// just an entry/display convenience on top of inches — feet and inches
// get combined into total inches before saving, and split back out when
// loading a profile that was saved with that unit.
export const HEIGHT_UNITS = ["ftin", "cm"];
export const HEIGHT_UNIT_LABELS = { cm: "cm", ftin: "ft, in" };

export function ftInToInches(ft, inches) {
  const f = parseFloat(ft) || 0;
  const i = parseFloat(inches) || 0;
  if (f <= 0 && i <= 0) return null;
  return f * 12 + i;
}

export function inchesToFtIn(totalIn) {
  const t = Number(totalIn) || 0;
  const ft = Math.floor(t / 12);
  const inches = Math.round((t - ft * 12) * 10) / 10;
  return { ft, in: inches };
}
