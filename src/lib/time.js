// Formats a Date (or anything the Date constructor accepts) as a
// clock-time string honoring the person's 12h/24h preference. Kept
// separate from weight.js's unit conversion helpers since this is a
// display-only formatting concern, not a stored-value conversion.
export function formatClockTime(dateInput, timeFormat) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: timeFormat !== "24h",
  });
}

// Formats a Date (or a timestamptz string from Supabase, which is always
// UTC) as a YYYY-MM-DD string in the *local* calendar day, not UTC.
// completed_at, taken_on, and "today" all need to agree on what day a
// late-evening workout falls on — using toISOString().slice(0, 10) here
// was the source of a whole family of off-by-one-day bugs (calendar
// highlighting, volume/weight charts, progress photos) for anyone west of
// UTC, since a workout finished at 8pm Mountain is already "tomorrow" in
// UTC.
export function toLocalDateStr(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
