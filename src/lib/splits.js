// Named muscle-group groupings ("splits") used in a few places: the
// workout generator's quick-select, the exercise picker's split filter,
// and the Splits reference screen in the menu. Keeping one definition
// means all three always agree on what "Push" or "Upper" includes.
export const SPLITS = {
  Push: ["Chest", "Shoulders", "Triceps"],
  Pull: ["Back", "Biceps", "Traps", "Rear Delts", "Forearms"],
  Legs: ["Quads", "Hamstrings", "Glutes", "Calves"],
  Upper: ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Traps", "Rear Delts", "Forearms"],
  Lower: ["Quads", "Hamstrings", "Glutes", "Calves"],
  "Full Body": ["Chest", "Back", "Shoulders", "Quads", "Hamstrings", "Glutes", "Core"],
};
