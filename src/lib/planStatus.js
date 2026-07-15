// Shared status-color logic for "My Plan" (weekly set targets per muscle
// group) -- used by both MyPlan.jsx (the sliders/progress list) and
// BodyMap.jsx (the "My Plan" body-map coloring mode), so the two always
// agree on what counts as gray/orange/green.
export const PLAN_NEUTRAL = "#3A404B";
export const PLAN_ORANGE = "#E8752E";
export const PLAN_GREEN = "#3BA55D";

// gray: nothing logged yet this week: orange: some sets in, short of
// target; green: target met or beaten. No target set (0) falls back to
// a dim neutral rather than false-green/false-orange.
export function statusColorFor(total, target, dimColor = "#8B919D") {
  if (!target) return dimColor;
  if (total <= 0) return PLAN_NEUTRAL;
  if (total < target) return PLAN_ORANGE;
  return PLAN_GREEN;
}
