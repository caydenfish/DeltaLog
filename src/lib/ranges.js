// Shared Training Range options for Home's charts (Volume, Bodyweight,
// Workout Time, Muscle breakdown) -- each chart now keeps its own
// independent selection (see getChartRange/setChartRange in prefs.js),
// but they all pick from this same list.
export const RANGES = [
  { key: "7d", label: "7 Days", days: 7 },
  { key: "30d", label: "30 Days", days: 30 },
  { key: "90d", label: "90 Days", days: 90 },
  { key: "365d", label: "1 Year", days: 365 },
];
