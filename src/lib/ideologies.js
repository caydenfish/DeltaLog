// Shared with Preferences.jsx (default training focus setting) and
// SetLogger.jsx (per-exercise/per-workout rep-range targeting). Single
// source of truth so the numbers and descriptions can't drift apart.
export const IDEOLOGIES = {
  Strength: { low: 3, high: 5, desc: "Low reps, heavy loads (85-100% of your max). Builds maximal force and neural efficiency." },
  Hypertrophy: { low: 8, high: 12, desc: "Moderate reps and loads (65-85% of your max). Maximizes muscle growth." },
  Endurance: { low: 15, high: 20, desc: "High reps, lighter loads (under 60% of your max). Builds work capacity and stamina." },
};
